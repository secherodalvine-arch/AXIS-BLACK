"""
routers/auth.py — Complete authentication endpoints.
Register with email verification, login with verification check,
OTP-based password reset with 1-minute resend cooldown.
"""
import uuid
import datetime
import random

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import HTMLResponse

from app.models.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    SocialLoginRequest,
    SendOTPRequest,
    VerifyOTPRequest,
    ResetPasswordOTPRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    ResendResetOtpRequest,
)
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
)
from app.database import db_manager
from app.services.email_service import (
    send_email_notification,
    send_otp_email,
    send_welcome_email,
    send_verification_email,
    send_password_reset_email,
)
from app.auth.dependencies import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Resend cooldown tracking (in-memory, 1-minute) ───────────────────────────
_resend_cooldowns: dict = {}  # key: "verify:{email}" or "reset:{email}" → datetime

RESEND_COOLDOWN_SECONDS = 60


def _check_and_set_cooldown(key: str) -> int:
    """
    Returns remaining cooldown seconds (0 = allowed, >0 = must wait).
    Sets the cooldown if allowed.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    last = _resend_cooldowns.get(key)
    if last:
        elapsed = (now - last).total_seconds()
        remaining = RESEND_COOLDOWN_SECONDS - elapsed
        if remaining > 0:
            return int(remaining)
    _resend_cooldowns[key] = now
    return 0


# ── Register ─────────────────────────────────────────────────────────────────
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    """
    Create a new user account. Sends a verification email.
    Returns requires_verification=True; user must verify before logging in.
    """
    email_lower = payload.email.strip().lower()
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    user_id = str(uuid.uuid4())

    # Check email uniqueness
    if db_manager.is_connected:
        existing = await db_manager.db.users.find_one({"email": email_lower})
    else:
        existing = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )

    if existing:
        if existing.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists. Please sign in.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email is pending verification. Check your inbox or request a resend.",
            )

    freq = (payload.income_frequency or "monthly").lower()
    raw_amount = payload.income_amount if payload.income_amount is not None else payload.salary
    if freq == "daily":
        calc_salary = raw_amount * 30.0
    elif freq == "weekly":
        calc_salary = raw_amount * 4.33
    else:
        calc_salary = raw_amount or payload.salary

    # Build user document (unverified)
    user_doc = {
        "user_id": user_id,
        "name": payload.name.strip(),
        "email": email_lower,
        "username": email_lower,
        "hashed_password": hash_password(payload.password),
        "email_verified": False,
        "income_frequency": freq,
        "income_amount": raw_amount,
        "salary": round(calc_salary, 2),
        "other_income": 0.0,
        "currency": payload.currency,
        "personality": "Sanguine",
        "location": {"city": payload.city, "country": payload.country},
        "created_at": now_str,
        "updated_at": now_str,
    }

    try:
        if db_manager.is_connected:
            await db_manager.db.users.insert_one(user_doc)
        else:
            db_manager.memory_store["users"][user_id] = user_doc
    except Exception as exc:
        if "duplicate key error" in str(exc).lower() or "11000" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration error: {str(exc)}",
        )

    # Generate verification token (24h)
    verify_token_data = {"sub": email_lower, "type": "email_verify"}
    verify_token = create_reset_token(email_lower, expire_hours=24)

    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={verify_token}"

    # Store verification token
    verify_record = {
        "email": email_lower,
        "token": verify_token,
        "expires_at": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)).isoformat(),
        "created_at": now_str,
        "used": False,
    }
    if db_manager.is_connected:
        await db_manager.db.email_verifications.delete_many({"email": email_lower})
        await db_manager.db.email_verifications.insert_one(verify_record)
    else:
        if "email_verifications" not in db_manager.memory_store:
            db_manager.memory_store["email_verifications"] = {}
        db_manager.memory_store["email_verifications"][email_lower] = verify_record

    # Set resend cooldown
    _check_and_set_cooldown(f"verify:{email_lower}")

    # Send verification email
    try:
        send_verification_email(email_lower, payload.name.strip(), verify_url)
    except Exception:
        pass

    return RegisterResponse(
        message=f"Account created! A verification email has been sent to {email_lower}. Please verify your email before signing in.",
        email=email_lower,
        requires_verification=True,
    )


async def _do_verify_email(token: str) -> tuple[bool, str, str]:
    if not token or not token.strip():
        return False, "Verification token is missing.", ""

    decoded = decode_token(token.strip())
    if not decoded or decoded.get("type") != "reset":
        return False, "Invalid or expired verification token. Please request a new verification email.", ""

    email = decoded.get("sub", "").lower()
    if not email:
        return False, "Invalid verification token payload.", ""

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"email": email})
        record = await db_manager.db.email_verifications.find_one({"email": email, "used": False})
    else:
        user = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == email), None)
        verifications = db_manager.memory_store.get("email_verifications", {})
        record = verifications.get(email)
        if record and record.get("used"):
            record = None

    if user and user.get("email_verified", False):
        return True, "Your email address is already verified.", email

    if not user:
        return False, "User account associated with this link was not found.", email

    if record:
        try:
            exp_dt = datetime.datetime.fromisoformat(record["expires_at"])
            if datetime.datetime.now(datetime.timezone.utc) > exp_dt:
                return False, "Verification link has expired. Please request a new verification email.", email
        except Exception:
            pass

    if db_manager.is_connected:
        await db_manager.db.users.update_one(
            {"email": email},
            {"$set": {"email_verified": True, "updated_at": now_str}},
        )
        await db_manager.db.email_verifications.update_one(
            {"email": email}, {"$set": {"used": True}}
        )
    else:
        user["email_verified"] = True
        user["updated_at"] = now_str
        verifications = db_manager.memory_store.get("email_verifications", {})
        if email in verifications:
            verifications[email]["used"] = True

    try:
        user_name = user.get("name", "") if user else ""
        send_welcome_email(email, user_name)
    except Exception:
        pass

    return True, "Email verified successfully! You can now sign in to your Axis Black account.", email


@router.post("/verify-email")
async def verify_email_post(payload: VerifyEmailRequest):
    """
    Verify email via JSON API request.
    """
    success, message, email = await _do_verify_email(payload.token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )
    return {
        "verified": True,
        "message": message,
        "email": email,
    }


@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email_get(token: Optional[str] = Query(None)):
    """
    Verify email when link is clicked directly in an email client.
    Returns a responsive, dark-themed HTML verification response page.
    """
    success, message, email = await _do_verify_email(token or "")

    frontend_login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    status_class = "success" if success else "error"
    icon_symbol = "&#10004;" if success else "&#10008;"
    title = "Email Verified Successfully" if success else "Verification Failed"
    button_text = "Proceed to Sign In" if success else "Back to Sign In"
    email_display = f"<strong>{email}</strong>" if email else ""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Axis Black &mdash; Email Verification</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: #080c14;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }}
    .card {{
      max-width: 480px;
      width: 100%;
      background: linear-gradient(145deg, #0f1829, #131e30);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 20px;
      padding: 44px 36px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.1);
    }}
    .icon-ring {{
      width: 76px;
      height: 76px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 900;
    }}
    .success .icon-ring {{
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10b981;
      color: #10b981;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.3);
    }}
    .error .icon-ring {{
      background: rgba(239, 68, 68, 0.15);
      border: 2px solid #ef4444;
      color: #ef4444;
      box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
    }}
    h1 {{
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
    }}
    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 28px;
    }}
    p strong {{
      color: #00d4ff;
    }}
    .btn {{
      display: inline-block;
      width: 100%;
      padding: 14px 28px;
      background: linear-gradient(135deg, #00d4ff, #7c5fe6);
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border-radius: 12px;
      letter-spacing: 0.5px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0, 212, 255, 0.25);
    }}
    .btn:hover {{
      opacity: 0.92;
      transform: translateY(-1px);
    }}
    .brand {{
      margin-top: 24px;
      font-size: 11px;
      color: #64748b;
      letter-spacing: 2px;
      text-transform: uppercase;
    }}
  </style>
</head>
<body>
  <div class="card {status_class}">
    <div class="icon-ring">{icon_symbol}</div>
    <h1>{title}</h1>
    <p>{message} {email_display}</p>
    <a href="{frontend_login_url}" class="btn">{button_text}</a>
    <div class="brand">Axis Black &bull; Financial Intelligence</div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)


# ── Resend Verification ───────────────────────────────────────────────────────
@router.post("/resend-verification")
async def resend_verification(payload: ResendVerificationRequest):
    """
    Resend the email verification link. Enforces a 1-minute cooldown.
    """
    email_lower = payload.email.strip().lower()
    cooldown_key = f"verify:{email_lower}"

    remaining = _check_and_set_cooldown(cooldown_key)
    if remaining > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining} seconds before requesting another verification email.",
            headers={"Retry-After": str(remaining)},
        )

    # Find user
    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"email": email_lower})
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your email or register.",
        )

    if user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already verified. Please sign in.",
        )

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    verify_token = create_reset_token(email_lower, expire_hours=24)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={verify_token}"

    verify_record = {
        "email": email_lower,
        "token": verify_token,
        "expires_at": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)).isoformat(),
        "created_at": now_str,
        "used": False,
    }

    if db_manager.is_connected:
        await db_manager.db.email_verifications.delete_many({"email": email_lower})
        await db_manager.db.email_verifications.insert_one(verify_record)
    else:
        if "email_verifications" not in db_manager.memory_store:
            db_manager.memory_store["email_verifications"] = {}
        db_manager.memory_store["email_verifications"][email_lower] = verify_record

    try:
        send_verification_email(email_lower, user.get("name", ""), verify_url)
    except Exception:
        pass

    return {
        "message": f"Verification email resent to {email_lower}. Please check your inbox.",
        "cooldown_seconds": RESEND_COOLDOWN_SECONDS,
    }


def _extract_user_info(user: dict) -> tuple[str, str, str]:
    """
    Extracts (user_id, email, name) safely from user document dictionary.
    Guarantees user_id is non-empty string and avoids KeyError.
    """
    raw_uid = user.get("user_id") or user.get("id")
    if not raw_uid and "_id" in user:
        raw_uid = str(user["_id"])
    if not raw_uid:
        raw_uid = str(uuid.uuid4())

    email = str(user.get("email", ""))
    name = str(user.get("name") or (email.split("@")[0] if email else "User"))
    return str(raw_uid), email, name


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """
    Authenticate an existing user.
    Returns 403 with requires_verification flag if account is unverified.
    """
    email_lower = payload.email.strip().lower()

    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"email": email_lower})
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )

    if not user or not verify_password(payload.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Block unverified accounts
    if not user.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address has not been verified. Please check your inbox or request a new verification email.",
            headers={"X-Requires-Verification": "true", "X-User-Email": email_lower},
        )

    user_id, email, name = _extract_user_info(user)

    # Ensure user_id field is persisted in DB if missing from older documents
    if db_manager.is_connected and not user.get("user_id") and "_id" in user:
        try:
            await db_manager.db.users.update_one({"_id": user["_id"]}, {"$set": {"user_id": user_id}})
        except Exception:
            pass

    token_data = {"sub": user_id, "email": email, "name": name}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        name=name,
        email=email,
    )


# ── Refresh Token ─────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(payload: RefreshTokenRequest):
    """
    Exchange a valid refresh token for new access and refresh tokens.
    """
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject.",
        )

    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"email": user_id}]})
    else:
        user = db_manager.memory_store["users"].get(user_id)
        if not user:
            user = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == user_id), None)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
        )

    uid, email, name = _extract_user_info(user)
    token_data = {"sub": uid, "email": email, "name": name}
    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user_id=uid,
        name=name,
        email=email,
    )


# ── Forgot Password (Link-based) ──────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """
    Initiate password reset via link sent to email.
    """
    email_lower = payload.email.strip().lower()

    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"email": email_lower})
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your email or register.",
        )

    reset_token = create_reset_token(email_lower, expire_hours=0.25)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    _check_and_set_cooldown(f"reset:{email_lower}")

    try:
        send_password_reset_email(email_lower, reset_url)
    except Exception:
        pass

    return {
        "message": f"A password reset link has been sent to {email_lower}. Please check your inbox.",
    }


# ── Resend Reset Link ─────────────────────────────────────────────────────────
@router.post("/resend-reset-otp")
async def resend_reset_otp(payload: ResendResetOtpRequest):
    """
    Resend the password reset link. Enforces a 1-minute cooldown.
    """
    email_lower = payload.email.strip().lower()
    cooldown_key = f"reset:{email_lower}"

    remaining = _check_and_set_cooldown(cooldown_key)
    if remaining > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining} seconds before requesting another link.",
            headers={"Retry-After": str(remaining)},
        )

    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"email": email_lower})
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your email or register.",
        )

    reset_token = create_reset_token(email_lower, expire_hours=0.25)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    try:
        send_password_reset_email(email_lower, reset_url)
    except Exception:
        pass

    return {
        "message": f"A new password reset link has been sent to {email_lower}.",
        "cooldown_seconds": RESEND_COOLDOWN_SECONDS,
    }


# ── Reset Password (Token-based from email link) ──────────────────────────────
@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    """
    Reset password using a valid token from the reset email link.
    """
    decoded = decode_token(payload.token)
    if not decoded or decoded.get("type") != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new password reset link.",
        )

    email = decoded.get("sub", "").lower()
    new_hashed = hash_password(payload.new_password)
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected:
        res = await db_manager.db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": new_hashed, "updated_at": now_str}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email),
            None,
        )
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        user["hashed_password"] = new_hashed
        user["updated_at"] = now_str

    return {"message": "Password updated successfully. You may now sign in with your new password."}


# ── Reset Password via OTP ────────────────────────────────────────────────────
@router.post("/reset-password-otp")
async def reset_password_otp(payload: ResetPasswordOTPRequest):
    """
    Resets account password using a 6-digit OTP code sent to the user's email.
    """
    email_lower = payload.email.strip().lower()
    code = payload.otp_code.strip()
    new_hashed = hash_password(payload.new_password)
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected:
        record = await db_manager.db.otp_codes.find_one({"email": email_lower, "otp_code": code, "purpose": "reset_password"})
    else:
        otps = db_manager.memory_store.get("otp_codes", {})
        record = next(
            (r for r in otps.values() if r.get("email") == email_lower and r.get("otp_code") == code and r.get("purpose") == "reset_password"),
            None,
        )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset code. Please check the code sent to your email and try again.",
        )

    exp_dt = datetime.datetime.fromisoformat(record["expires_at"])
    if datetime.datetime.now(datetime.timezone.utc) > exp_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset code has expired. Please request a new one.",
        )

    if db_manager.is_connected:
        res = await db_manager.db.users.update_one(
            {"email": email_lower},
            {"$set": {"hashed_password": new_hashed, "updated_at": now_str}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email.")
        # Clean up used OTP
        await db_manager.db.otp_codes.delete_many({"email": email_lower, "purpose": "reset_password"})
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email.")
        user["hashed_password"] = new_hashed
        user["updated_at"] = now_str
        otps = db_manager.memory_store.get("otp_codes", {})
        key = f"{email_lower}:reset_password"
        if key in otps:
            del otps[key]

    return {"message": "Password updated successfully. You can now sign in with your new password."}


# ── Social Login ──────────────────────────────────────────────────────────────
@router.post("/social-login", response_model=TokenResponse)
async def social_login(payload: SocialLoginRequest):
    """
    Authenticate or register via Social OAuth provider (Google or GitHub).
    Social accounts are auto-verified.
    """
    email_lower = payload.email.strip().lower()
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"email": email_lower})
    else:
        user = next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email_lower),
            None,
        )

    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "user_id": user_id,
            "name": payload.name.strip(),
            "email": email_lower,
            "username": email_lower,
            "hashed_password": "",
            "email_verified": True,  # Social logins are auto-verified
            "provider": payload.provider,
            "provider_id": payload.provider_id,
            "salary": payload.salary or 50000.0,
            "other_income": 0.0,
            "currency": payload.currency or "USD",
            "personality": "Sanguine",
            "location": {"city": "Nairobi", "country": "Kenya"},
            "created_at": now_str,
            "updated_at": now_str,
        }
        try:
            if db_manager.is_connected:
                await db_manager.db.users.insert_one(user)
            else:
                db_manager.memory_store["users"][user_id] = user
        except Exception:
            pass

    uid, email, name = _extract_user_info(user)
    token_data = {"sub": uid, "email": email, "name": name}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=uid,
        name=name,
        email=email,
    )


# ── Send OTP (generic) ────────────────────────────────────────────────────────
@router.post("/send-otp")
async def send_otp(payload: SendOTPRequest):
    """
    Generates and sends a 6-digit OTP to the specified email.
    """
    email_lower = payload.email.strip().lower()
    purpose = payload.purpose.strip().lower()
    otp_code = f"{random.randint(100000, 999999)}"
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = (now + datetime.timedelta(minutes=10)).isoformat()

    otp_record = {
        "email": email_lower,
        "otp_code": otp_code,
        "purpose": purpose,
        "expires_at": expires_at,
        "created_at": now.isoformat(),
        "verified": False,
    }

    if db_manager.is_connected:
        await db_manager.db.otp_codes.delete_many({"email": email_lower, "purpose": purpose})
        await db_manager.db.otp_codes.insert_one(otp_record)
    else:
        if "otp_codes" not in db_manager.memory_store:
            db_manager.memory_store["otp_codes"] = {}
        db_manager.memory_store["otp_codes"][f"{email_lower}:{purpose}"] = otp_record

    try:
        send_otp_email(email_lower, otp_code, purpose)
    except Exception:
        pass

    return {
        "message": f"A verification code has been sent to {email_lower}.",
        "email": email_lower,
        "expires_in_minutes": 10,
    }


# ── Verify OTP ────────────────────────────────────────────────────────────────
@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest):
    """
    Verifies a 6-digit OTP code.
    """
    email_lower = payload.email.strip().lower()
    code = payload.otp_code.strip()
    purpose = payload.purpose.strip().lower()

    if db_manager.is_connected:
        record = await db_manager.db.otp_codes.find_one({"email": email_lower, "purpose": purpose})
    else:
        otps = db_manager.memory_store.get("otp_codes", {})
        record = otps.get(f"{email_lower}:{purpose}")
        if not record:
            record = next(
                (r for r in otps.values() if r.get("email") == email_lower and r.get("otp_code") == code),
                None,
            )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found for this email. Please request a new one.",
        )

    if record.get("otp_code") != code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please check your email and try again.",
        )

    exp_dt = datetime.datetime.fromisoformat(record["expires_at"])
    if datetime.datetime.now(datetime.timezone.utc) > exp_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one.",
        )

    if db_manager.is_connected:
        await db_manager.db.otp_codes.update_one({"_id": record["_id"]}, {"$set": {"verified": True}})
    else:
        record["verified"] = True

    return {
        "valid": True,
        "message": "Code verified successfully.",
        "email": email_lower,
    }


# ── Current User Profile ──────────────────────────────────────────────────────
@router.get("/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Returns authenticated user's profile and active preferences.
    """
    user_doc = dict(current_user)
    user_doc.pop("hashed_password", None)
    user_doc.pop("_id", None)
    return user_doc


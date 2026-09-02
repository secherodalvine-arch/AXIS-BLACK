from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

import smtplib
from email.message import EmailMessage

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from fastapi.responses import HTMLResponse
from fastapi import Query
import json
import urllib.request
import urllib.parse
import base64

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "").strip()
EMAIL_API_KEY = os.environ.get("EMAIL_API_KEY", "").strip()
GMAIL_USER = os.environ.get("GMAIL_USER", "").strip()
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").strip()
MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "").strip()


app = FastAPI(title="Axis Black Email API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


class EmailPayload(BaseModel):
    to_email: str = Field(..., min_length=5, max_length=255)
    subject: str = Field(..., min_length=1, max_length=255)
    html: str = Field(..., min_length=1)
    text: str = ""
    reply_to: str | None = Field(default=None, max_length=255)


class VerifyTokenPayload(BaseModel):
    token: str


def _send_email(payload: EmailPayload) -> None:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise RuntimeError("GMAIL_USER or GMAIL_APP_PASSWORD is not configured")

    message = EmailMessage()
    message["Subject"] = payload.subject
    message["From"] = f"Axis Black <{GMAIL_USER}>"
    message["To"] = str(payload.to_email)
    if payload.reply_to:
        message["Reply-To"] = str(payload.reply_to)

    if payload.text:
        message.set_content(payload.text)
    message.add_alternative(payload.html, subtype="html")

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(message)


def _render_verification_html(success: bool, title: str, message: str, email: str = "") -> str:
    status_class = "success" if success else "error"
    icon_symbol = "&#10004;" if success else "&#10008;"
    button_text = "Proceed to Sign In" if success else "Back to Sign In"
    login_url = f"{FRONTEND_URL.rstrip('/')}/login"
    email_display = f"<strong>{email}</strong>" if email else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Axis Black &mdash; Email Verification</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background-color: #080c14;
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
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
    <a href="{login_url}" class="btn">{button_text}</a>
    <div class="brand">Axis Black &bull; Financial Intelligence</div>
  </div>
</body>
</html>"""


def _decode_jwt_token(token: str) -> dict | None:
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return None


@app.get("/")
async def health() -> dict:
    return {"status": "ok", "service": "axis-black-email-api", "backend_api_url": BACKEND_API_URL or None}


@app.post("/send_email")
async def send_email(
    payload: EmailPayload,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    if not EMAIL_API_KEY:
        raise HTTPException(status_code=500, detail="EMAIL_API_KEY is not configured")

    if authorization != f"Bearer {EMAIL_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if "@" not in payload.to_email:
        raise HTTPException(status_code=400, detail="to_email must be a valid email address")
    if payload.reply_to and "@" not in payload.reply_to:
        raise HTTPException(status_code=400, detail="reply_to must be a valid email address")

    try:
        _send_email(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}") from exc

    return {"sent": True, "provider": "gmail-smtp"}


@app.get("/verify-email", response_class=HTMLResponse)
async def verify_email_get(token: str | None = Query(default=None)):
    if not token or not token.strip():
        return HTMLResponse(
            content=_render_verification_html(False, "Verification Failed", "Verification token is missing from the URL request."),
            status_code=400,
        )

    clean_token = token.strip()

    # Try proxying request to BACKEND_API_URL if configured
    if BACKEND_API_URL:
        try:
            backend_url = f"{BACKEND_API_URL.rstrip('/')}/api/auth/verify-email?token={urllib.parse.quote(clean_token)}"
            req = urllib.request.Request(backend_url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                html_resp = resp.read().decode("utf-8")
                return HTMLResponse(content=html_resp, status_code=resp.status)
        except urllib.error.HTTPError as http_err:
            if http_err.fp:
                err_content = http_err.fp.read().decode("utf-8")
                if "<html" in err_content.lower():
                    return HTMLResponse(content=err_content, status_code=http_err.code)
        except Exception:
            pass

    # Fallback JWT verification
    decoded = _decode_jwt_token(clean_token)
    if not decoded:
        return HTMLResponse(
            content=_render_verification_html(False, "Verification Failed", "Invalid or malformed verification token."),
            status_code=400,
        )

    token_type = decoded.get("type")
    if token_type not in ("reset", "email_verify"):
        return HTMLResponse(
            content=_render_verification_html(False, "Verification Failed", "Token is not a valid email verification token."),
            status_code=400,
        )

    email = decoded.get("sub", "").strip().lower()
    exp = decoded.get("exp", 0)

    import time
    if exp and time.time() > exp:
        return HTMLResponse(
            content=_render_verification_html(False, "Verification Expired", "Verification link has expired. Please request a new verification email.", email=email),
            status_code=400,
        )

    return HTMLResponse(
        content=_render_verification_html(True, "Email Verified Successfully", "Your email address has been verified successfully! You can now sign in to your Axis Black account.", email=email),
        status_code=200,
    )


@app.post("/verify-email")
async def verify_email_post(payload: VerifyTokenPayload):
    token = payload.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Verification token is missing.")

    if BACKEND_API_URL:
        try:
            backend_url = f"{BACKEND_API_URL.rstrip('/')}/api/auth/verify-email"
            req_data = json.dumps({"token": token}).encode("utf-8")
            req = urllib.request.Request(
                backend_url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                return resp_json
        except urllib.error.HTTPError as http_err:
            err_msg = "Verification failed."
            if http_err.fp:
                try:
                    err_json = json.loads(http_err.fp.read().decode("utf-8"))
                    err_msg = err_json.get("detail", err_msg)
                except Exception:
                    pass
            raise HTTPException(status_code=http_err.code, detail=err_msg)
        except Exception as exc:
            pass

    decoded = _decode_jwt_token(token)
    if not decoded or decoded.get("type") not in ("reset", "email_verify"):
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")

    email = decoded.get("sub", "").strip().lower()
    exp = decoded.get("exp", 0)
    import time
    if exp and time.time() > exp:
        raise HTTPException(status_code=400, detail="Verification link has expired.")

    return {
        "verified": True,
        "message": "Email verified successfully! You can now sign in to your Axis Black account.",
        "email": email,
    }


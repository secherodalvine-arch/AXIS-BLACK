"""
security.py — Password hashing and JWT token utilities.
Uses Argon2id (argon2-cffi) for modern password hashing, with legacy bcrypt fallback.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from jose import JWTError, jwt

from app.config import settings

# Initialize Argon2id hasher
_ph = PasswordHasher()


def hash_password(plain_password: str) -> str:
    """Return an Argon2id hash of the plain-text password."""
    return _ph.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Return True if the plain password matches the stored Argon2id hash.
    Includes fallback verification for legacy bcrypt hashes.
    """
    if not plain_password or not hashed_password:
        return False

    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            try:
                import bcrypt
                return bcrypt.checkpw(
                    plain_password.encode("utf-8"),
                    hashed_password.encode("utf-8")
                )
            except Exception:
                return False
        return False
    except Exception:
        return False


def create_access_token(data: Dict[str, Any]) -> str:
    """Create a signed JWT containing `data` as the payload.
    Automatically adds an `exp` (expiry) claim.
    """
    to_encode = data.copy()
    to_encode["type"] = "access"
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create a longer-lived refresh JWT (30 days expiry)."""
    to_encode = data.copy()
    to_encode["type"] = "refresh"
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_reset_token(email: str, expire_hours: float = 0.25) -> str:
    """
    Create a password reset JWT.
    expire_hours: hours until expiry (default 0.25 = 15 minutes for password reset).
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    to_encode = {"sub": email, "type": "reset", "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_verification_token(email: str, expire_hours: float = 1.0) -> str:
    """
    Create an email verification JWT.
    expire_hours: hours until expiry (default 1.0 hour).
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    to_encode = {"sub": email, "type": "email_verify", "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)



def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify a JWT. Returns the payload dict or None if invalid."""
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


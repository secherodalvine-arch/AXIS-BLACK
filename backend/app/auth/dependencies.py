"""
dependencies.py — FastAPI dependency that extracts and validates the current user
from the Authorization: Bearer <token> header on every protected route.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth.security import decode_token
from app.database import db_manager

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency injected on every protected route.

    Decodes the JWT, verifies it is not expired, then loads the full user
    document from MongoDB (or in-memory store). Raises HTTP 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    # Load user from DB / memory
    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"email": user_id}]})
        if not user:
            raise credentials_exception
        if "user_id" not in user:
            user["user_id"] = str(user.get("_id", user_id))
        user.pop("_id", None)
        return user
    else:
        user = db_manager.memory_store["users"].get(user_id)
        if not user:
            user = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == user_id), None)
        if not user:
            raise credentials_exception
        if "user_id" not in user:
            user["user_id"] = user_id
        return user


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme_optional),
) -> dict:
    """
    Optional authentication dependency. Returns current user if token is valid,
    or a default guest user dict if unauthenticated.
    """
    default_guest = {
        "user_id": "usr_guest",
        "name": "Operator",
        "email": "operator@axisblack.io",
        "currency": "USD"
    }
    if not credentials or not credentials.credentials:
        return default_guest

    payload = decode_token(credentials.credentials)
    if payload is None:
        return default_guest

    user_id: str = payload.get("sub", "usr_guest")
    if db_manager.is_connected:
        user = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"email": user_id}]})
        if user:
            if "user_id" not in user:
                user["user_id"] = str(user.get("_id", user_id))
            user.pop("_id", None)
            return user
    user = db_manager.memory_store["users"].get(user_id)
    if not user:
        user = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == user_id), None)
    if user:
        if "user_id" not in user:
            user["user_id"] = user_id
        return user

    return default_guest


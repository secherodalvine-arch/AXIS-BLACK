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


import re
from typing import Dict, Any, Optional

async def resolve_user_team_context(user: dict) -> dict:
    """
    Chains a user to the business owner account if their email or user_id has been
    registered as a team member in any business. Enforces up-to-date role permissions,
    assigned branch, company name, and suspension status so team members are never confused as owners.
    """
    email = (user.get("email") or "").strip().lower()
    user_id = user.get("user_id") or ""
    
    biz_doc = None
    sub_user_entry = None
    
    # 1. If user already recorded an owner_id, look up that business first
    owner_id = user.get("owner_id")
    if owner_id and owner_id != user_id:
        if db_manager.is_connected:
            biz_doc = await db_manager.db.businesses.find_one({"owner_id": owner_id})
            if biz_doc:
                biz_doc.pop("_id", None)
        else:
            biz_doc = db_manager.memory_store.get("businesses", {}).get(owner_id)
            
        if biz_doc:
            sub_user_entry = next((u for u in biz_doc.get("sub_users", []) if (u.get("email") or "").lower() == email or u.get("id") == user_id), None)
            
    # 2. If not found yet, scan all businesses for this email
    if not sub_user_entry and email:
        if db_manager.is_connected:
            biz_cursor = db_manager.db.businesses.find({"sub_users.email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
            async for b in biz_cursor:
                b.pop("_id", None)
                match = next((u for u in b.get("sub_users", []) if (u.get("email") or "").lower() == email), None)
                if match:
                    biz_doc = b
                    sub_user_entry = match
                    break
        else:
            for b_owner_id, b_doc in db_manager.memory_store.get("businesses", {}).items():
                match = next((u for u in b_doc.get("sub_users", []) if (u.get("email") or "").lower() == email), None)
                if match:
                    biz_doc = b_doc
                    sub_user_entry = match
                    break

    # 3. If the user is indeed a team member in an owner's business
    if sub_user_entry and biz_doc:
        user["is_sub_user"] = True
        user["owner_id"] = biz_doc.get("owner_id")
        user["branch_id"] = sub_user_entry.get("branch_id")
        user["role_id"] = sub_user_entry.get("role_id")
        
        # Check active / suspension status from the sub_user record
        sub_is_active = sub_user_entry.get("is_active", True)
        if sub_is_active is False or sub_user_entry.get("status") == "suspended":
            user["is_active"] = False
            user["status"] = "suspended"
            
        if sub_user_entry.get("is_deleted") or sub_user_entry.get("status") == "deleted":
            user["is_deleted"] = True
            user["status"] = "deleted"
            
        # Resolve role details & permissions from owner's role definition
        role_id = sub_user_entry.get("role_id")
        role_obj = next((r for r in biz_doc.get("roles", []) if r.get("id") == role_id), None)
        if role_obj:
            user["role"] = role_obj.get("role_name", "Team Member")
            user["role_name"] = role_obj.get("role_name", "Team Member")
            user["permissions"] = role_obj.get("permissions") or []
        else:
            user["role"] = "Team Member"
            user["role_name"] = "Team Member"
            user["permissions"] = ["dashboard"]
            
        # Sync Company name
        user["company"] = biz_doc.get("business_name") or "Business Team"
        
        # Sync Branch name
        branch_id = sub_user_entry.get("branch_id")
        if branch_id:
            branch_obj = next((b for b in biz_doc.get("branches", []) if b.get("id") == branch_id), None)
            user["branch_name"] = branch_obj.get("name") if branch_obj else None
        else:
            user["branch_name"] = "All Branches"
    else:
        # User is an Owner (not a sub-user)
        user["is_sub_user"] = False
        user["owner_id"] = user_id
        # Owner possesses all operational permissions
        user["permissions"] = [
            "dashboard", "inventory", "analytics", "transactions",
            "agent", "business", "activities", "forecast", "settings"
        ]

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency injected on every protected route.
    Decodes the JWT, verifies it is not expired, loads the user,
    chains team members to the owner's business, and enforces permissions and suspension status.
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
    else:
        user = db_manager.memory_store["users"].get(user_id)
        if not user:
            user = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == user_id), None)
        if not user:
            raise credentials_exception
        if "user_id" not in user:
            user["user_id"] = user_id

    # Chain team member context and synchronize permissions from owner's business
    user = await resolve_user_team_context(user)

    # Enforce suspension and deletion checks on all protected routes
    if user.get("is_deleted") or user.get("status") == "deleted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deleted by the business owner. Please contact your business administrator for assistance.",
        )
    if user.get("is_active") is False or user.get("status") == "suspended" or user.get("is_suspended") is True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended by the business owner. Please contact your business administrator for assistance.",
        )

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
        "currency": "USD",
        "is_sub_user": False,
        "permissions": ["dashboard"]
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
            return await resolve_user_team_context(user)
    user = db_manager.memory_store["users"].get(user_id)
    if not user:
        user = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == user_id), None)
    if user:
        if "user_id" not in user:
            user["user_id"] = user_id
        return await resolve_user_team_context(user)

    return default_guest


def require_owner(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures only the business owner can access the route."""
    if current_user.get("is_sub_user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the business owner has permission to perform this administrative action."
        )
    return current_user


def require_permission(perm: str):
    """Dependency factory checking that a team member has been granted the required permission."""
    def check_permission(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("is_sub_user"):
            perms = current_user.get("permissions") or []
            if perm not in perms:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Your assigned role does not have the '{perm}' privilege required for this resource."
                )
        return current_user
    return check_permission



import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.models.user import UserProfileCreate, LocationModel, UserProfileUpdate
from app.database import db_manager
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["User Profile"])

@router.get("/me", response_model=Dict[str, Any])
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    user_copy = dict(current_user)
    user_copy.pop("_id", None)
    user_copy.pop("hashed_password", None)
    return user_copy

    return {
        "user_id": current_user.get("user_id", "usr_active"),
        "name": current_user.get("name", "Dalvine"),
        "email": current_user.get("email", "secherodalvine@gmail.com"),
        "role": current_user.get("role", "Chief Financial Officer"),
        "company": current_user.get("company", "Axis Black Inc."),
        "currency": current_user.get("currency", "KES"),
        "salary": current_user.get("salary", 150000.0),
        "income_frequency": current_user.get("income_frequency", "monthly"),
        "income_amount": current_user.get("income_amount", 150000.0),
        "location": current_user.get("location", {"city": "Nairobi", "country": "Kenya"}),
        "avatar_url": current_user.get("avatar_url", ""),
        "personality": current_user.get("personality", "Precision-Driven"),
        "theme": current_user.get("theme", "dark"),
        "notification_settings": current_user.get("notification_settings", {
            "enabled": True,
            "frequency": "daily",
            "time": "18:00",
            "topics": {"performance": True, "stock": True, "ledger": True},
            "channels": {"in_app": True, "email": True, "sms": False},
            "email_mode": "profile",
            "custom_email": "",
            "phone_number": ""
        })
    }

@router.put("/me", response_model=Dict[str, Any])
async def update_user_profile(payload: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    email = current_user.get("email", "")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    # If user is an assigned team member, lock down role, company, and business fields
    if current_user.get("is_sub_user"):
        for forbidden in ["role", "company", "role_id", "branch_id", "is_sub_user", "owner_id", "salary", "income_frequency"]:
            updates.pop(forbidden, None)

    if "city" in updates or "country" in updates:
        current_loc = current_user.get("location")
        if not isinstance(current_loc, dict):
            current_loc = {"city": "Nairobi", "country": "Kenya"}
        if "city" in updates and updates["city"] is not None:
            current_loc["city"] = updates.pop("city")
        if "country" in updates and updates["country"] is not None:
            current_loc["country"] = updates.pop("country")
        updates["location"] = current_loc

    updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected and (user_id or email):
        query = {"$or": [{"user_id": user_id}, {"email": email}]} if user_id and email else ({"user_id": user_id} if user_id else {"email": email})
        await db_manager.db.users.update_one(query, {"$set": updates})
        updated_doc = await db_manager.db.users.find_one(query)
        if updated_doc:
            updated_doc.pop("_id", None)
            updated_doc.pop("hashed_password", None)
            return updated_doc

    current_user.update(updates)
    if user_id:
        db_manager.memory_store["users"][user_id] = current_user
    if email:
        for u_key, u_val in db_manager.memory_store["users"].items():
            if u_val.get("email") == email:
                u_val.update(updates)
    db_manager.save_memory_store()
    current_user.pop("hashed_password", None)
    return current_user


@router.post("/me/location", response_model=Dict[str, Any])
async def update_user_location(payload: LocationModel, current_user: dict = Depends(get_current_user)):
    return {"status": "updated", "location": payload.model_dump()}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/me/change-password", response_model=Dict[str, Any])
async def change_user_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    from app.auth.security import verify_password, hash_password
    user_id = current_user.get("user_id")
    email = current_user.get("email")

    user_doc = None
    if db_manager.is_connected:
        user_doc = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"email": email}]})
    else:
        user_doc = db_manager.memory_store["users"].get(user_id) or next(
            (u for u in db_manager.memory_store["users"].values() if u.get("email") == email), None
        )

    if not user_doc or not verify_password(payload.current_password, user_doc.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password does not match. Please verify and try again."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    new_hash = hash_password(payload.new_password)
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected:
        await db_manager.db.users.update_one(
            {"$or": [{"user_id": user_id}, {"email": email}]},
            {"$set": {"hashed_password": new_hash, "must_change_password": False, "updated_at": now_str}}
        )
    else:
        user_doc["hashed_password"] = new_hash
        user_doc["must_change_password"] = False
        user_doc["updated_at"] = now_str
        db_manager.save_memory_store()

    return {"status": "success", "message": "Password changed successfully."}


class DispatchSummaryPayload(BaseModel):
    channels: Optional[Dict[str, bool]] = None
    email_mode: Optional[str] = None
    custom_email: Optional[str] = None
    phone_number: Optional[str] = None
    frequency: Optional[str] = None
    topics: Optional[Dict[str, bool]] = None


@router.post("/me/dispatch-summary", response_model=Dict[str, Any])
async def dispatch_business_summary(
    payload: Optional[DispatchSummaryPayload] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Dispatch real summary notification across the activated mode(s) selected by the user.
    Checks user's toggled channels (in_app, email, sms) and only dispatches to those activated.
    """
    override = payload.model_dump(exclude_unset=True) if payload else {}
    from app.services.scheduler import dispatch_user_summary_notification
    return await dispatch_user_summary_notification(current_user, custom_override=override)



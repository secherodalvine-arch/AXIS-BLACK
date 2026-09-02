import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from app.models.user import UserProfileCreate, LocationModel, UserProfileUpdate
from app.database import db_manager
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["User Profile"])

@router.get("/me", response_model=Dict[str, Any])
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    email = current_user.get("email", "")

    doc = None
    if db_manager.is_connected and (user_id or email):
        doc = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"email": email}]})
    elif user_id in db_manager.memory_store["users"]:
        doc = db_manager.memory_store["users"][user_id]
    elif email:
        doc = next((u for u in db_manager.memory_store["users"].values() if u.get("email") == email), None)

    if doc:
        doc_copy = dict(doc)
        doc_copy.pop("_id", None)
        doc_copy.pop("hashed_password", None)
        return doc_copy

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
        "personality": current_user.get("personality", "Precision-Driven")
    }

@router.put("/me", response_model=Dict[str, Any])
async def update_user_profile(payload: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    email = current_user.get("email", "")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

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
    current_user.pop("hashed_password", None)
    return current_user


@router.post("/me/location", response_model=Dict[str, Any])
async def update_user_location(payload: LocationModel, current_user: dict = Depends(get_current_user)):
    return {"status": "updated", "location": payload.model_dump()}

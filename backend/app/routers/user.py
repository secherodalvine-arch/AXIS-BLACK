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


class TestNotificationPayload(BaseModel):
    channels: Optional[Dict[str, bool]] = None
    email_mode: Optional[str] = None
    custom_email: Optional[str] = None
    phone_number: Optional[str] = None
    frequency: Optional[str] = None
    topics: Optional[Dict[str, bool]] = None


@router.post("/me/test-notification", response_model=Dict[str, Any])
async def send_test_business_summary(
    payload: Optional[TestNotificationPayload] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Dispatch real summary notification across the activated mode(s) selected by the user.
    Checks user's toggled channels (in_app, email, sms) and only dispatches to those activated.
    """
    user_id = current_user.get("user_id", "")
    owner_id = current_user.get("owner_id") if current_user.get("is_sub_user") else user_id
    business_name = current_user.get("company") or "My Business"
    user_email = current_user.get("email", "")

    notif_settings = dict(current_user.get("notification_settings") or {})
    
    # Merge payload settings from current client toggles if provided
    if payload:
        if payload.channels is not None:
            notif_settings["channels"] = payload.channels
        if payload.email_mode is not None:
            notif_settings["email_mode"] = payload.email_mode
        if payload.custom_email is not None:
            notif_settings["custom_email"] = payload.custom_email
        if payload.phone_number is not None:
            notif_settings["phone_number"] = payload.phone_number
        if payload.frequency is not None:
            notif_settings["frequency"] = payload.frequency
        if payload.topics is not None:
            notif_settings["topics"] = payload.topics

    channels = notif_settings.get("channels") or {"in_app": True, "email": False, "sms": False}
    freq = notif_settings.get("frequency", "daily")

    from app.database import AxisDataStore
    from app.services.sms_service import send_sms_async
    from app.services.email_service import send_business_summary_email

    txns = await AxisDataStore.get_transactions(owner_id)
    items = await AxisDataStore.get_inventory(owner_id)

    total_revenue = float(sum(t.get("amount", 0) for t in txns if t.get("amount", 0) > 0))
    total_expenses = float(sum(abs(t.get("amount", 0)) for t in txns if t.get("amount", 0) < 0))
    net_margin = total_revenue - total_expenses
    is_profit = net_margin >= 0
    margin_percentage = ((net_margin / total_revenue) * 100) if total_revenue > 0 else 0.0

    low_stock = sum(1 for i in items if int(i.get("stock_quantity", 0)) <= int(i.get("reorder_point", 10)))
    total_products = len(items)
    txn_count = len(txns)

    summary_data = {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_margin": net_margin,
        "margin_percentage": margin_percentage,
        "is_profit": is_profit,
        "total_inventory_items": total_products,
        "low_stock_items": low_stock,
        "transactions_count": txn_count,
        "frequency": freq,
    }

    status_tag = "Net Profit" if is_profit else "Net Loss"
    sign = "+" if is_profit else "-"
    margin_text = f"{status_tag}: ${abs(net_margin):,.2f} ({sign}{abs(margin_percentage):.1f}% margin)"

    # Clean, jargon-free in-app message
    in_app_msg = (
        f"Profit & Loss: Revenue ${total_revenue:,.2f} | Expenses ${total_expenses:,.2f} | {margin_text}. "
        f"Inventory: {total_products} product items ({low_stock} low stock / need reorder). "
        f"Ledger: {txn_count} transactions recorded."
    )

    active_modes = [mode for mode, is_active in channels.items() if is_active]

    results: Dict[str, Any] = {
        "status": "dispatched" if active_modes else "no_channels_selected",
        "active_modes": active_modes,
        "channels": {},
        "summary": summary_data,
    }

    if not active_modes:
        results["message"] = "No delivery mode is currently activated. Please enable In-App, Email, or SMS."
        return results

    # 1. In-App Notification — ONLY if activated
    if channels.get("in_app") is True:
        notif = await AxisDataStore.add_notification(
            recipient_id=user_id,
            title=f"Business Summary — 6:00 PM ({business_name})",
            message=in_app_msg,
            notif_type="info",
            meta={
                "source": "scheduled_summary",
                "time": "18:00",
                "profit_margin": margin_percentage,
                "net_margin": net_margin
            }
        )
        results["channels"]["in_app"] = {"success": True, "notification_id": notif.get("id"), "message": in_app_msg}

    # 2. Email Dispatch — ONLY if activated
    if channels.get("email") is True:
        email_mode = notif_settings.get("email_mode", "profile")
        target_email = notif_settings.get("custom_email") if email_mode == "custom" and notif_settings.get("custom_email") else user_email
        if target_email:
            email_sent = send_business_summary_email(
                to_email=target_email,
                business_name=business_name,
                summary_data=summary_data
            )
            results["channels"]["email"] = {"success": email_sent, "recipient": target_email}
        else:
            results["channels"]["email"] = {"success": False, "error": "No email address configured"}

    # 3. SMS Dispatch via TalkSasa — ONLY if activated
    if channels.get("sms") is True:
        phone_number = notif_settings.get("phone_number", "").strip()
        if phone_number:
            sms_body = (
                f"[{business_name}] 6:00 PM Summary:\n"
                f"Sales: ${total_revenue:,.0f} | Exp: ${total_expenses:,.0f}\n"
                f"{status_tag}: ${abs(net_margin):,.0f} ({sign}{abs(margin_percentage):.1f}% margin)\n"
                f"Stock: {total_products} items ({low_stock} low)\n"
                f"Ledger: {txn_count} txns"
            )
            sms_res = await send_sms_async(phone=phone_number, message=sms_body)
            results["channels"]["sms"] = sms_res
        else:
            results["channels"]["sms"] = {"success": False, "error": "No phone number provided"}

    return results



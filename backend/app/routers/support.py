import uuid
import datetime
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.models.support import SupportMessageRequest, SupportMessageResponse, SupportReplyRequest
from app.services.email_service import send_support_message_email
from app.database import db_manager, AxisDataStore
from app.auth.dependencies import get_current_user, bearer_scheme_optional
from app.auth.security import decode_token
from app.routers.admin import clean_mongo_doc

router = APIRouter(prefix="/api/support", tags=["Support & Contact"])
logger = logging.getLogger("axisblack.support")


async def get_optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme_optional)) -> Optional[dict]:
    """Helper to extract user context if an Authorization bearer token is provided."""
    if not creds:
        return None
    try:
        payload = decode_token(creds.credentials)
        if not payload:
            return None
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            return None
        if db_manager.is_connected and db_manager.db is not None:
            user = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
            if user:
                return clean_mongo_doc(user)
        else:
            for u in db_manager.memory_store.get("users", {}).values():
                if u.get("user_id") == user_id or u.get("id") == user_id or u.get("email") == user_id:
                    return u
    except Exception:
        pass
    return None


@router.post("/message", response_model=SupportMessageResponse, status_code=status.HTTP_200_OK)
async def send_support_message(
    payload: SupportMessageRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Dispatches a support, inquiry, waitlist, or feedback ticket.
    Saves to the support_threads collection so it is visible in the admin platform.
    Also dispatches admin in-app notification and email notification.
    """
    name = payload.name.strip()
    email = payload.email.strip().lower()
    subject = payload.subject.strip() or "Support Request"
    label = payload.label.strip().lower() or "support"
    message = payload.message.strip()

    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address.",
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    thread_id = f"th-{uuid.uuid4().hex[:10]}"
    user_id = current_user.get("user_id") or current_user.get("id") if current_user else None

    thread_doc = {
        "id": thread_id,
        "user_id": user_id,
        "user_name": name,
        "user_email": email,
        "subject": subject,
        "label": label,
        "status": "open",
        "messages": [
            {
                "id": f"msg-{uuid.uuid4().hex[:8]}",
                "sender": "user",
                "name": name,
                "text": message,
                "timestamp": now_iso
            }
        ],
        "created_at": now_iso,
        "updated_at": now_iso
    }

    try:
        if db_manager.is_connected and db_manager.db is not None:
            await db_manager.db.support_threads.insert_one(thread_doc)
        else:
            if "support_threads" not in db_manager.memory_store:
                db_manager.memory_store["support_threads"] = {}
            db_manager.memory_store["support_threads"][thread_id] = thread_doc
            db_manager.save_memory_store()

        await AxisDataStore.record_admin_notification(
            title=f"New Support Inquiry: {name}",
            message=f"[{label.upper()}] {subject}: {message[:90]}",
            notif_type="support",
            meta={"thread_id": thread_id, "email": email, "subject": subject, "link": f"/messages?thread={thread_id}"}
        )
    except Exception as e:
        logger.warning(f"Could not persist support ticket: {e}")

    try:
        sent = send_support_message_email(
            name=name,
            email=email,
            message=message,
            subject=subject,
            label=label,
        )
        if not sent:
            logger.warning("Support message could not be delivered for %s (%s)", name, email)
    except Exception as exc:
        logger.exception("Error sending support message email for %s (%s): %s", name, email, exc)

    return SupportMessageResponse(
        message="Thank you! Your inquiry has been submitted to Axis Black customer support.",
        label=label,
        data=clean_mongo_doc(thread_doc),
    )


@router.get("/my-threads")
async def get_my_support_threads(current_user: dict = Depends(get_current_user)):
    """
    Returns all customer support threads initiated by or associated with the logged-in user.
    """
    user_id = current_user.get("user_id") or current_user.get("id") or ""
    user_email = (current_user.get("email") or "").strip().lower()

    threads = []
    if db_manager.is_connected and db_manager.db is not None:
        q = {
            "$or": [
                {"user_id": user_id},
                {"user_email": user_email}
            ]
        }
        docs = await db_manager.db.support_threads.find(q).sort("updated_at", -1).to_list(length=100)
        threads = [clean_mongo_doc(d) for d in docs]
    else:
        store = db_manager.memory_store.get("support_threads", {})
        all_t = list(store.values()) if isinstance(store, dict) else store
        filtered = [
            t for t in all_t
            if t.get("user_id") == user_id or t.get("user_email", "").lower() == user_email
        ]
        filtered.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        threads = filtered

    return clean_mongo_doc({"success": True, "data": threads})


@router.get("/threads/{thread_id}")
async def get_support_thread_detail(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns thread details and messages for an authenticated user.
    """
    user_id = current_user.get("user_id") or current_user.get("id") or ""
    user_email = (current_user.get("email") or "").strip().lower()

    thread = None
    if db_manager.is_connected and db_manager.db is not None:
        thread = await db_manager.db.support_threads.find_one({"id": thread_id})
    else:
        store = db_manager.memory_store.get("support_threads", {})
        thread = store.get(thread_id)

    if not thread:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Support conversation not found.")

    # Verify authorization
    t_uid = thread.get("user_id")
    t_email = (thread.get("user_email") or "").strip().lower()
    if t_uid != user_id and t_email != user_email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation.")

    return clean_mongo_doc({"success": True, "data": thread})


@router.post("/threads/{thread_id}/reply")
async def reply_support_thread_user(
    thread_id: str,
    body: SupportReplyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows the user to reply inside an active support thread.
    Updates the thread status to 'open' and dispatches an admin notification.
    """
    user_id = current_user.get("user_id") or current_user.get("id") or ""
    user_email = (current_user.get("email") or "").strip().lower()
    user_name = current_user.get("name") or user_email.split("@")[0]

    reply_text = body.reply.strip()
    if not reply_text:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reply cannot be empty.")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    msg_id = f"msg-{uuid.uuid4().hex[:8]}"

    new_msg = {
        "id": msg_id,
        "sender": "user",
        "name": user_name,
        "text": reply_text,
        "timestamp": now_iso
    }

    if db_manager.is_connected and db_manager.db is not None:
        thread = await db_manager.db.support_threads.find_one({"id": thread_id})
        if not thread:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Support conversation not found.")

        t_uid = thread.get("user_id")
        t_email = (thread.get("user_email") or "").strip().lower()
        if t_uid != user_id and t_email != user_email:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation.")

        await db_manager.db.support_threads.update_one(
            {"id": thread_id},
            {
                "$push": {"messages": new_msg},
                "$set": {"updated_at": now_iso, "status": "open"}
            }
        )

        # Notify admin console
        await AxisDataStore.record_admin_notification(
            title=f"User Reply: {user_name}",
            message=f"[{thread.get('subject', 'Support')}] {reply_text[:100]}",
            notif_type="support",
            meta={"thread_id": thread_id, "email": user_email, "link": f"/messages?thread={thread_id}"}
        )
    else:
        store = db_manager.memory_store.get("support_threads", {})
        thread = store.get(thread_id)
        if not thread:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Support conversation not found.")
        t_uid = thread.get("user_id")
        t_email = (thread.get("user_email") or "").strip().lower()
        if t_uid != user_id and t_email != user_email:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation.")

        thread.setdefault("messages", []).append(new_msg)
        thread["updated_at"] = now_iso
        thread["status"] = "open"
        db_manager.save_memory_store()

    return {"success": True, "message": "Reply sent successfully", "data": new_msg}

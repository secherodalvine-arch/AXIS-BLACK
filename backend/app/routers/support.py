import logging
from fastapi import APIRouter, HTTPException, status

from app.models.support import SupportMessageRequest, SupportMessageResponse
from app.services.email_service import send_support_message_email

router = APIRouter(prefix="/api/support", tags=["Support & Contact"])
logger = logging.getLogger("axisblack.support")


@router.post("/message", response_model=SupportMessageResponse, status_code=status.HTTP_200_OK)
async def send_support_message(payload: SupportMessageRequest):
    """
    Dispatches a support, inquiry, waitlist, or feedback email to secherodalvine@gmail.com
    with Reply-To set to the sender's email address.
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

    import uuid
    import datetime
    from app.database import db_manager

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    thread_id = f"th-{uuid.uuid4().hex[:10]}"
    thread_doc = {
        "id": thread_id,
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
            # Create admin notification
            await db_manager.db.admin_notifications.insert_one({
                "id": f"notif-{uuid.uuid4().hex[:10]}",
                "title": f"New Support Ticket: {name}",
                "message": f"[{label.upper()}] {subject}: {message[:90]}",
                "type": "support",
                "timestamp": now_iso,
                "read": False,
                "link": f"/messages?thread={thread_id}"
            })
        else:
            if "support_threads" not in db_manager.memory_store:
                db_manager.memory_store["support_threads"] = {}
            db_manager.memory_store["support_threads"][thread_id] = thread_doc
            
            if "admin_notifications" not in db_manager.memory_store:
                db_manager.memory_store["admin_notifications"] = []
            db_manager.memory_store["admin_notifications"].insert(0, {
                "id": f"notif-{uuid.uuid4().hex[:10]}",
                "title": f"New Support Ticket: {name}",
                "message": f"[{label.upper()}] {subject}: {message[:90]}",
                "type": "support",
                "timestamp": now_iso,
                "read": False,
                "link": f"/messages?thread={thread_id}"
            })
            db_manager.save_memory_store()
    except Exception as e:
        logger.warning(f"Could not persist support ticket locally: {e}")

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
        message="Thank you! Your message has been sent to Axis Black support.",
        label=label,
    )


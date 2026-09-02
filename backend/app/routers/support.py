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
        logger.exception("Error processing support message for %s (%s): %s", name, email, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We could not send your message right now. Please try again later.",
        ) from exc

    return SupportMessageResponse(
        message="Thank you! Your message has been sent to Axis Black support.",
        label=label,
    )

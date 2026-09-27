import os
import re
import httpx
import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger("axisblack.sms")

TALKSASA_KEY = getattr(settings, "TALKSASA_API_KEY", "") or os.getenv("TALKSASA_API_KEY", "4310|Doz00xhJWd1U1LzI8ayNCSZ5h47AyWeUurAuI5Ud963dd83f")
TALKSASA_SENDER = getattr(settings, "TALKSASA_SENDER_ID", "") or os.getenv("TALKSASA_SENDER_ID", "TALKSASA")
TALKSASA_URL = getattr(settings, "TALKSASA_API_URL", "") or os.getenv("TALKSASA_API_URL", "https://bulksms.talksasa.com/api/v3/sms/send")


async def send_sms_async(phone: str, message: str) -> Dict[str, Any]:
    """
    Send SMS via TalkSasa API asynchronously (mirrored from HOUSEKONECT).
    Supports international and Kenyan formats (e.g., 2547..., 07...).
    """
    api_key = getattr(settings, "TALKSASA_API_KEY", "") or os.getenv("TALKSASA_API_KEY", TALKSASA_KEY)
    sender_id = getattr(settings, "TALKSASA_SENDER_ID", "") or os.getenv("TALKSASA_SENDER_ID", TALKSASA_SENDER)
    base_url = getattr(settings, "TALKSASA_API_URL", "") or os.getenv("TALKSASA_API_URL", TALKSASA_URL)
    base_url = base_url.rstrip("/").removesuffix("/sms/send")
    url = f"{base_url}/sms/send"

    if not api_key:
        logger.warning("[TALKSASA] TALKSASA_API_KEY not configured — skipping SMS dispatch.")
        return {"success": False, "error": "TALKSASA_API_KEY not configured"}
    if not sender_id:
        logger.warning("[TALKSASA] TALKSASA_SENDER_ID not configured — skipping SMS dispatch.")
        return {"success": False, "error": "TALKSASA_SENDER_ID not configured"}

    # Format phone number: strip whitespace, plus sign, and non-digits
    recipient = re.sub(r"[^\d]", "", (phone or "").lstrip("+"))
    if recipient.startswith("0"):
        recipient = "254" + recipient[1:]
    elif recipient.startswith("7") or recipient.startswith("1"):
        recipient = "254" + recipient

    if not recipient or len(recipient) < 9:
        logger.warning(f"[TALKSASA] Invalid phone number provided: {phone}")
        return {"success": False, "error": f"Invalid phone format: {phone}. Use format: +2547XXXXXXXX or international number with country code."}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "recipient": recipient,
        "message": message[:480],
        "sender_id": sender_id,
    }

    logger.info(f"[TALKSASA] Dispatching SMS to {recipient} | Sender: {sender_id}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            logger.info(f"[TALKSASA] Response status code: {r.status_code}")

            if r.status_code in (200, 201):
                try:
                    data = r.json()
                    sms_id = data.get("id") or data.get("message_id")
                    status = str(data.get("status", "")).lower()
                    if status in ("success", "sent", "queued", ""):
                        logger.info(f"[TALKSASA] SMS successfully sent to {recipient} (ID: {sms_id})")
                        return {"success": True, "message": "SMS sent successfully", "id": sms_id, "recipient": recipient}
                    else:
                        err = data.get("message") or data.get("error") or str(data)
                        logger.warning(f"[TALKSASA] Provider returned status '{status}': {err}")
                        return {"success": False, "error": err}
                except Exception:
                    return {"success": True, "message": "SMS sent successfully", "recipient": recipient}
            else:
                err_text = r.text[:300]
                logger.error(f"[TALKSASA] HTTP {r.status_code} Error: {err_text}")
                return {"success": False, "error": f"HTTP {r.status_code}: {err_text}"}
    except Exception as e:
        logger.error(f"[TALKSASA] Network error while sending SMS: {e}")
        return {"success": False, "error": str(e)}

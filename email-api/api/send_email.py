from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

import smtplib
from email.message import EmailMessage

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "").strip()
EMAIL_API_KEY = os.environ.get("EMAIL_API_KEY", "").strip()
GMAIL_USER = os.environ.get("GMAIL_USER", "").strip()
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "").strip()


app = FastAPI(title="Axis Black Email API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


class EmailPayload(BaseModel):
    to_email: str = Field(..., min_length=5, max_length=255)
    subject: str = Field(..., min_length=1, max_length=255)
    html: str = Field(..., min_length=1)
    text: str = ""
    reply_to: str | None = Field(default=None, max_length=255)


def _send_email(payload: EmailPayload) -> None:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise RuntimeError("GMAIL_USER or GMAIL_APP_PASSWORD is not configured")

    message = EmailMessage()
    message["Subject"] = payload.subject
    message["From"] = f"Axis Black <{GMAIL_USER}>"
    message["To"] = str(payload.to_email)
    if payload.reply_to:
        message["Reply-To"] = str(payload.reply_to)

    if payload.text:
        message.set_content(payload.text)
    message.add_alternative(payload.html, subtype="html")

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.send_message(message)


@app.get("/")
async def health() -> dict:
    return {"status": "ok", "service": "axis-black-email-api", "backend_api_url": BACKEND_API_URL or None}


@app.post("/send_email")
async def send_email(
    payload: EmailPayload,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    if not EMAIL_API_KEY:
        raise HTTPException(status_code=500, detail="EMAIL_API_KEY is not configured")

    if authorization != f"Bearer {EMAIL_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if "@" not in payload.to_email:
        raise HTTPException(status_code=400, detail="to_email must be a valid email address")
    if payload.reply_to and "@" not in payload.reply_to:
        raise HTTPException(status_code=400, detail="reply_to must be a valid email address")

    try:
        _send_email(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}") from exc

    return {"sent": True, "provider": "gmail-smtp"}

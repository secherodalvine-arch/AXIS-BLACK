"""
services/email_service.py — Axis Black email delivery service.
Sends emails via Gmail SMTP with automatic fallback to local logging.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger("axisblack.email")

# In-memory log of sent emails (useful for local dev verification)
sent_emails_log: List[Dict[str, Any]] = []

_EMAIL_BASE_STYLE = """
  body { margin: 0; padding: 0; background-color: #080c14; font-family: 'Segoe UI', Arial, sans-serif; color: #e2e8f0; }
  .wrapper { max-width: 560px; margin: 40px auto; padding: 20px; }
  .card { background: linear-gradient(145deg, #0f1829, #131e30); border: 1px solid rgba(0, 212, 255, 0.15); border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #020810 0%, #0a1628 60%, #0d1f3c 100%); padding: 32px 36px 24px; text-align: center; border-bottom: 1px solid rgba(0, 212, 255, 0.1); }
  .brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .brand-icon { width: 40px; height: 40px; }
  .brand-name { font-size: 20px; font-weight: 800; letter-spacing: 3px; color: #ffffff; }
  .brand-name span { color: #00d4ff; }
  .header-title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 16px 0 6px; }
  .header-sub { font-size: 14px; color: #94a3b8; margin: 0; }
  .body { padding: 32px 36px; }
  .body p { font-size: 14px; line-height: 1.7; color: #cbd5e1; margin: 0 0 16px; }
  .otp-box { text-align: center; margin: 24px 0; padding: 20px; background: rgba(0, 212, 255, 0.05); border: 1px solid rgba(0, 212, 255, 0.2); border-radius: 12px; }
  .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #00d4ff; font-family: 'Courier New', monospace; }
  .otp-hint { font-size: 12px; color: #64748b; margin-top: 8px; }
  .btn-wrap { text-align: center; margin: 28px 0 20px; }
  .btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #00d4ff, #7c5fe6); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.5px; }
  .link-fallback { font-size: 12px; color: #64748b; text-align: center; margin-top: 8px; word-break: break-all; }
  .link-fallback a { color: #00d4ff; text-decoration: none; }
  .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 20px 0; }
  .footer { padding: 20px 36px 28px; text-align: center; font-size: 12px; color: #475569; }
  .footer strong { color: #64748b; }
"""


def send_email_notification(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """
    Sends an email via Gmail SMTP. Falls back to local logging if SMTP not available.
    """
    to_email = to_email.strip().lower()
    if not body_text:
        import re
        body_text = re.sub(r"<[^>]+>", "", body_html).strip()

    record: Dict[str, Any] = {
        "to_email": to_email,
        "subject": subject,
        "sent_via": "simulated",
    }

    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
            msg["To"] = to_email

            msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                if settings.SMTP_TLS:
                    server.starttls()
                    server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM_EMAIL, [to_email], msg.as_string())

            record["sent_via"] = "smtp"
            logger.info(f"[SMTP] Email sent to {to_email} | Subject: {subject}")
        except Exception as exc:
            logger.error(f"[SMTP ERROR] Failed to send to {to_email}: {exc}")
            record["sent_via"] = "smtp_failed"
            record["error"] = str(exc)
    else:
        logger.warning(f"[EMAIL SIM] SMTP not configured. Would send to {to_email}: {subject}")

    sent_emails_log.append(record)
    return True


def send_verification_email(to_email: str, user_name: str, verify_url: str) -> bool:
    """
    Sends an email verification link after registration.
    Contains both a clickable button and a plain URL.
    """
    subject = "Verify Your Axis Black Account"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>{_EMAIL_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS<span>BLACK</span></span>
        </div>
        <h1 class="header-title">Verify Your Email Address</h1>
        <p class="header-sub">One step left to activate your account</p>
      </div>
      <div class="body">
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Welcome to <strong>Axis Black</strong> — your AI-powered business intelligence platform. To complete your registration and access your dashboard, please verify your email address.</p>
        <div class="btn-wrap">
          <a href="{verify_url}" class="btn">✓ Verify My Account</a>
        </div>
        <p class="link-fallback">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="{verify_url}">{verify_url}</a>
        </p>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">This verification link expires in <strong>24 hours</strong>. If you didn't create an Axis Black account, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> — Business Intelligence Command Center<br>
        Nairobi, Kenya · Lagos, Nigeria
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Axis Black — Verify Your Email\n\n"
        f"Hi {user_name},\n\n"
        f"Please verify your email address by clicking the link below:\n{verify_url}\n\n"
        f"This link expires in 24 hours. If you didn't sign up, ignore this email."
    )
    return send_email_notification(to_email, subject, html, text)


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """
    Sends a password reset email with a clickable button and direct link.
    """
    subject = "Reset Your Axis Black Password"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>{_EMAIL_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS<span>BLACK</span></span>
        </div>
        <h1 class="header-title">Reset Your Password</h1>
        <p class="header-sub">Request received to reset your account password</p>
      </div>
      <div class="body">
        <p>Hello,</p>
        <p>We received a request to reset the password for your Axis Black account (<strong>{to_email}</strong>). Click the button below to choose a new password:</p>
        <div class="btn-wrap">
          <a href="{reset_url}" class="btn">🔑 Reset My Password</a>
        </div>
        <p class="link-fallback">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="{reset_url}">{reset_url}</a>
        </p>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">This password reset link expires in <strong>15 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> — Business Intelligence Command Center<br>
        Nairobi, Kenya · Lagos, Nigeria
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Axis Black — Reset Your Password\n\n"
        f"Click the link below to reset your password for {to_email}:\n{reset_url}\n\n"
        f"This link expires in 15 minutes. If you didn't request a reset, ignore this email."
    )
    return send_email_notification(to_email, subject, html, text)


def send_otp_email(to_email: str, otp_code: str, purpose: str = "verification") -> bool:
    """
    Sends a 6-digit OTP code for password reset.
    """
    if purpose == "reset_password":
        title = "Reset Your Password"
        sub = "Use the code below to reset your Axis Black password"
        note = "If you didn't request a password reset, you can safely ignore this email."
    else:
        title = "Your Verification Code"
        sub = "Use the code below to complete your action"
        note = "Do not share this code with anyone."

    subject = f"Axis Black: {otp_code} is your code"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>{_EMAIL_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS<span>BLACK</span></span>
        </div>
        <h1 class="header-title">{title}</h1>
        <p class="header-sub">{sub}</p>
      </div>
      <div class="body">
        <p>Use the following one-time code to proceed. This code is valid for <strong>10 minutes</strong>.</p>
        <div class="otp-box">
          <div class="otp-code">{otp_code}</div>
          <p class="otp-hint">Enter this 6-digit code in the Axis Black app</p>
        </div>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">{note}</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> — Business Intelligence Command Center
      </div>
    </div>
  </div>
</body>
</html>"""

    text = f"Axis Black — {title}\n\nYour code: {otp_code}\nValid for 10 minutes.\n\n{note}"
    return send_email_notification(to_email, subject, html, text)


def send_welcome_email(to_email: str, user_name: str) -> bool:
    """
    Sends a welcome email after the user verifies their account.
    """
    subject = "Welcome to Axis Black!"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>{_EMAIL_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS<span>BLACK</span></span>
        </div>
        <h1 class="header-title">Account Verified — Welcome!</h1>
        <p class="header-sub">Your Axis Black workspace is ready</p>
      </div>
      <div class="body">
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your Axis Black account has been successfully verified. You can now log in and access your full business intelligence dashboard.</p>
        <p>Here's what's waiting for you:</p>
        <ul style="color:#cbd5e1;font-size:14px;line-height:2;">
          <li>📊 Real-time financial metrics &amp; analytics</li>
          <li>📦 Inventory management &amp; reorder alerts</li>
          <li>🤖 Axis Agent — your AI financial advisor</li>
          <li>🚀 Runway Simulator &amp; scenario planning</li>
        </ul>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">If you have any questions, reach us at <a href="mailto:nairobi@axisblack.io" style="color:#00d4ff;">nairobi@axisblack.io</a></p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> — Business Intelligence Command Center<br>
        Nairobi, Kenya · Lagos, Nigeria
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Welcome to Axis Black, {user_name}!\n\n"
        f"Your account ({to_email}) has been verified and is ready to use.\n\n"
        f"Log in at your Axis Black dashboard to get started."
    )
    return send_email_notification(to_email, subject, html, text)

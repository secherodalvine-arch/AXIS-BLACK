"""
services/email_service.py — Axis Black email delivery service.
Dispatches emails via Vercel Serverless Email API.
"""
import os
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger("axisblack.email")

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


def send_via_smtp(to_email: str, subject: str, body_html: str, body_text: str, reply_to: Optional[str] = None) -> bool:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_user = getattr(settings, "SMTP_USER", "") or os.getenv("EMAIL_USER", "wizargriff@gmail.com")
    smtp_pass = getattr(settings, "SMTP_PASSWORD", "") or os.getenv("EMAIL_PASS", "kbpggaolddvlxqtq")
    smtp_host = getattr(settings, "SMTP_HOST", "smtp.gmail.com")
    smtp_port = getattr(settings, "SMTP_PORT", 587)

    if not smtp_user or not smtp_pass:
        logger.warning("[SMTP] Missing SMTP credentials, skipping SMTP fallback.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Axis Black <{smtp_user}>"
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    if body_text:
        msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        logger.info(f"[SMTP SUCCESS] Email successfully sent to {to_email} | Subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"[SMTP ERROR] Failed sending to {to_email}: {e}")
        return False


def send_email_notification(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """
    Sends an email directly via the Vercel Email API microservice with automatic SMTP fallback.
    """
    to_email = to_email.strip().lower()
    if not body_text:
        import re
        body_text = re.sub(r"<[^>]+>", "", body_html).strip()

    email_api_url = getattr(settings, "EMAIL_API_URL", "").rstrip("/")
    email_api_key = getattr(settings, "EMAIL_API_KEY", "")

    # Try standalone microservice first if configured
    if email_api_url and email_api_key and not email_api_url.startswith("http://127.0.0.1:8000"):
        endpoint = f"{email_api_url}/send_email"
        payload = {
            "to_email": to_email,
            "subject": subject,
            "html": body_html,
            "text": body_text,
        }
        if reply_to:
            payload["reply_to"] = reply_to.strip()

        headers = {
            "Authorization": f"Bearer {email_api_key}",
            "Content-Type": "application/json",
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=15) as resp:
                response_body = resp.read().decode("utf-8")
                logger.info(f"[EMAIL API SUCCESS] Email sent to {to_email} | Subject: {subject} | Response: {response_body}")
                return True
        except Exception as exc:
            logger.warning(f"[EMAIL API FAILED] Falling back to direct SMTP for {to_email}: {exc}")

    # Fallback to direct SMTP
    return send_via_smtp(to_email, subject, body_html, body_text, reply_to)


def send_business_summary_email(
    to_email: str,
    business_name: str,
    summary_data: Dict[str, Any]
) -> bool:
    """Dispatches a clean business performance, stock, and ledger summary report."""
    rev = summary_data.get("total_revenue", 0.0)
    exp = summary_data.get("total_expenses", 0.0)
    net_margin = summary_data.get("net_margin", 0.0)
    margin_pct = summary_data.get("margin_percentage", 0.0)
    is_profit = net_margin >= 0
    total_products = summary_data.get("total_inventory_items", 0)
    low_stock = summary_data.get("low_stock_items", 0)
    txn_count = summary_data.get("transactions_count", 0)
    frequency_label = str(summary_data.get("frequency", "Daily")).capitalize()

    status_color = "#4ade80" if is_profit else "#ff6b6b"
    status_label = "NET PROFIT" if is_profit else "NET LOSS"
    margin_sign = "+" if is_profit else ""

    subject = f"[{business_name}] {frequency_label} Business Summary & Performance Report (6:00 PM)"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
  <style>{_EMAIL_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS <span>BLACK</span></span>
        </div>
        <div class="header-title">{business_name} — {frequency_label} Summary</div>
        <p class="header-sub">Dispatched at 6:00 PM Executive Digest</p>
      </div>
      <div class="body">
        <h3 style="color:#ffffff;margin-top:0;font-size:16px;">Profit & Loss Margin Summary</h3>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:18px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#94a3b8;">Total Revenue (Income):</span>
            <strong style="color:#4ade80;">${rev:,.2f}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#94a3b8;">Total Expenses (Costs):</span>
            <strong style="color:#ff8e8e;">${exp:,.2f}</strong>
          </div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:12px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#ffffff;font-weight:700;">{status_label}:</span>
            <strong style="color:{status_color};font-size:18px;">${abs(net_margin):,.2f} ({margin_sign}{margin_pct:.1f}% margin)</strong>
          </div>
        </div>

        <h3 style="color:#ffffff;font-size:16px;">Inventory & Stock Health</h3>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;color:#cbd5e1;">Total Product Items in Stock: <strong style="color:#00d4ff;">{total_products} products</strong></p>
          <p style="margin:0;color:{'#fbbf24' if low_stock > 0 else '#4ade80'};">Products Needing Reorder (Low Stock): <strong>{low_stock} items</strong></p>
        </div>

        <h3 style="color:#ffffff;font-size:16px;">Ledger Transactions</h3>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;color:#cbd5e1;">Total Recorded Transactions: <strong style="color:#cebdff;">{txn_count} entries</strong></p>
        </div>

        <div class="btn-wrap">
          <a href="{settings.FRONTEND_URL}" class="btn">Open Live Business Dashboard</a>
        </div>
      </div>
      <div class="footer">
        Axis Black Business Intelligence &bull; Automated 6:00 PM Summary
      </div>
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"{business_name} - {frequency_label} Business Summary (6:00 PM)\n\n"
        f"PROFIT & LOSS SUMMARY:\n"
        f"- Total Revenue: ${rev:,.2f}\n"
        f"- Total Expenses: ${exp:,.2f}\n"
        f"- {status_label}: ${abs(net_margin):,.2f} ({margin_sign}{margin_pct:.1f}% margin)\n\n"
        f"STOCK & INVENTORY HEALTH:\n"
        f"- Total Product Items in Stock: {total_products}\n"
        f"- Products Low on Stock / Needing Reorder: {low_stock}\n\n"
        f"LEDGER TRANSACTIONS:\n"
        f"- Total Recorded Transactions: {txn_count}\n\n"
        f"Dashboard: {settings.FRONTEND_URL}\n"
    )

    return send_email_notification(
        to_email=to_email,
        subject=subject,
        body_html=html_content,
        body_text=text_content
    )



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
        <p>Welcome to <strong>Axis Black</strong>. To complete your registration and access your dashboard, please verify your email address.</p>
        <div class="btn-wrap">
          <a href="{verify_url}" class="btn">✓ Verify My Account</a>
        </div>
        <p class="link-fallback">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="{verify_url}">{verify_url}</a>
        </p>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">This verification link expires in <strong>1 hour</strong>. If you didn't create an Axis Black account, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> — Financial Workspace<br>
        Nairobi, Kenya · Ruiru, Kiambu County
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Axis Black — Verify Your Email\n\n"
        f"Hi {user_name},\n\n"
        f"Please verify your email address by clicking the link below:\n{verify_url}\n\n"
        f"This link expires in 1 hour. If you didn't sign up, ignore this email."
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
        <strong>Axis Black</strong> — Financial Workspace<br>
        Nairobi, Kenya · Ruiru, Kiambu County
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
        <strong>Axis Black</strong> — Financial Workspace
      </div>
    </div>
  </div>
</body>
</html>"""

    text = f"Axis Black — {title}\n\nYour code: {otp_code}\nValid for 10 minutes.\n\n{note}"
    return send_email_notification(to_email, subject, html, text)


def _get_role_highlights(role_name: str, permissions: Optional[List[str]] = None) -> List[str]:
    highlights = []
    r_lower = (role_name or "").lower()
    perms = set(permissions or [])
    
    if "inventory" in perms or any(k in r_lower for k in ["inventory", "stock", "warehouse", "store"]):
        highlights.append("📦 <strong>Inventory Stock Management:</strong> Real-time product counts, reorder alerts, cataloging, and stock updates.")
    if "transactions" in perms or any(k in r_lower for k in ["cashier", "account", "finance", "billing", "teller"]):
        highlights.append("💳 <strong>Ledger &amp; Transactions:</strong> Record income/expenses, reconcile receipts, and balance operational cashflow.")
    if "analytics" in perms or "forecast" in perms or any(k in r_lower for k in ["analyst", "manager", "cfo", "director"]):
        highlights.append("📈 <strong>Business Intelligence &amp; Runway:</strong> Access financial margin metrics, burn rate models, and strategic runway forecasts.")
    if "agent" in perms or any(k in r_lower for k in ["advisor", "lead", "officer", "executive"]):
        highlights.append("🤖 <strong>Axis AI Advisor:</strong> Query business telemetry, financial KPIs, and get real-time operational insights.")
    if "dashboard" in perms:
        highlights.append("📊 <strong>Executive Dashboard:</strong> Real-time overview of business revenue, profit margins, and key performance indicators.")
    if "activities" in perms:
        highlights.append("⏱️ <strong>Activity Audit Logs:</strong> Transparent history of business ledger events and operational logs.")
        
    if not highlights:
        highlights = [
            "📊 Financial metrics &amp; operational dashboard",
            "📦 Inventory management &amp; ledger records",
            "🤖 Axis AI Assistant for quick business insights"
        ]
    return highlights


def send_welcome_email(
    to_email: str,
    user_name: str,
    role_name: Optional[str] = None,
    company_name: Optional[str] = None,
    branch_name: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    is_sub_user: bool = False
) -> bool:
    """
    Sends a welcome email after the user verifies their account.
    Crafted dynamically based on whether they are a Business Owner or an Assigned Team Member.
    """
    to_email = to_email.strip().lower()
    display_role = role_name or ("Team Member" if is_sub_user else "Executive / Business Owner")
    display_company = company_name or "Axis Black Workspace"
    login_url = f"{settings.FRONTEND_URL}/login"

    if is_sub_user:
        subject = f"Welcome to {display_company} — Role: {display_role}"
        header_title = f"Welcome to the Team, {user_name}!"
        header_sub = f"You are registered as {display_role} at {display_company}"
        intro_text = (
            f"Your Axis Black account has been verified. You have joined <strong>{display_company}</strong> "
            f"as <strong>{display_role}</strong>"
            f"{f' ({branch_name})' if branch_name else ''}."
        )
    else:
        subject = f"Welcome to Axis Black — {display_company}"
        header_title = "Account Verified — Welcome!"
        header_sub = f"Your executive workspace for {display_company} is active"
        intro_text = (
            f"Your Axis Black account has been verified. As <strong>{display_role}</strong> of "
            f"<strong>{display_company}</strong>, your central financial dashboard is ready."
        )

    highlights = _get_role_highlights(display_role, permissions)
    highlights_html = "\n".join(f'<li style="margin-bottom:8px;">{item}</li>' for item in highlights)
    highlights_text = "\n".join(f"- {re_sub}" for re_sub in [h.replace('<strong>', '').replace('</strong>', '').replace('&amp;', '&') for h in highlights])

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
        <h1 class="header-title">{header_title}</h1>
        <p class="header-sub">{header_sub}</p>
      </div>
      <div class="body">
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>{intro_text}</p>
        <div style="background:rgba(0, 212, 255, 0.05);border:1px solid rgba(0, 212, 255, 0.2);border-radius:12px;padding:16px 20px;margin:20px 0;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#00d4ff;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Assigned Role &amp; Responsibilities</p>
          <p style="margin:0;font-size:15px;color:#ffffff;font-weight:700;">{display_role} &bull; {display_company}</p>
          {f'<p style="margin:4px 0 0 0;font-size:13px;color:#94a3b8;">Branch: {branch_name}</p>' if branch_name else ''}
        </div>
        <p><strong>Your Core Workspaces:</strong></p>
        <ul style="color:#cbd5e1;font-size:14px;line-height:1.7;padding-left:20px;">
          {highlights_html}
        </ul>
        <div class="btn-wrap">
          <a href="{login_url}" class="btn">🚀 Enter Workspace</a>
        </div>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">If you need assistance, contact your business administrator or reach our desk at <a href="mailto:nairobi@axisblack.io" style="color:#00d4ff;">nairobi@axisblack.io</a>.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> &bull; Business Financial Operations
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"{header_title}\n\n"
        f"Hi {user_name},\n"
        f"{intro_text.replace('<strong>', '').replace('</strong>', '')}\n\n"
        f"Assigned Role: {display_role}\n"
        f"Company: {display_company}\n"
        f"{f'Branch: {branch_name}' if branch_name else ''}\n\n"
        f"Core Workspaces:\n{highlights_text}\n\n"
        f"Login at: {login_url}\n"
    )
    return send_email_notification(to_email, subject, html, text)


def send_team_invitation_email(
    to_email: str,
    user_name: str,
    role_name: str,
    company_name: str,
    branch_name: str,
    permissions: Optional[List[str]] = None,
    temp_password: Optional[str] = None
) -> bool:
    """
    Sends an invitation and onboarding email to an appointed team member.
    Role-tailored with temporary credentials and workspace overview.
    """
    to_email = to_email.strip().lower()
    subject = f"You have been appointed as {role_name} at {company_name} — Axis Black"
    login_url = f"{settings.FRONTEND_URL}/login"
    highlights = _get_role_highlights(role_name, permissions)
    highlights_html = "\n".join(f'<li style="margin-bottom:8px;">{item}</li>' for item in highlights)
    highlights_text = "\n".join(f"- {re_sub}" for re_sub in [h.replace('<strong>', '').replace('</strong>', '').replace('&amp;', '&') for h in highlights])

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
        <h1 class="header-title">Welcome to the Team!</h1>
        <p class="header-sub">Role Assignment: {role_name} at {company_name}</p>
      </div>
      <div class="body">
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>You have been officially invited and appointed by your business owner to join <strong>{company_name}</strong> on the <strong>Axis Black</strong> platform.</p>
        
        <div style="background:rgba(0, 212, 255, 0.05);border:1px solid rgba(0, 212, 255, 0.2);border-radius:12px;padding:18px 20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;color:#e2e8f0;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;width:120px;">Role:</td>
              <td style="padding:6px 0;font-weight:700;color:#00d4ff;">{role_name}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Organization:</td>
              <td style="padding:6px 0;font-weight:700;color:#ffffff;">{company_name}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Branch:</td>
              <td style="padding:6px 0;font-weight:700;color:#cebdff;">{branch_name}</td>
            </tr>
          </table>
        </div>

        <p><strong>Your Assigned Role Responsibilities:</strong></p>
        <ul style="color:#cbd5e1;font-size:14px;line-height:1.7;padding-left:20px;">
          {highlights_html}
        </ul>

        {f'''
        <div style="background:rgba(124, 95, 230, 0.08);border:1px solid rgba(124, 95, 230, 0.3);border-radius:12px;padding:18px 20px;margin:24px 0;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🔐 Your Login Credentials</p>
          <p style="margin:4px 0;font-size:14px;color:#e2e8f0;"><strong>Email:</strong> {to_email}</p>
          <p style="margin:4px 0;font-size:14px;color:#e2e8f0;"><strong>Initial Password:</strong> <code style="background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;color:#00d4ff;font-family:monospace;font-size:15px;">{temp_password}</code></p>
          <p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;">For security, please navigate to Settings and update your password upon signing in.</p>
        </div>
        ''' if temp_password else ''}

        <div class="btn-wrap">
          <a href="{login_url}" class="btn">🔑 Sign In to Workspace</a>
        </div>

        <p class="link-fallback">
          Direct login link: <a href="{login_url}">{login_url}</a>
        </p>

        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">This notification was issued by the business owner of {company_name} on Axis Black.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> &bull; Team Operations
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Welcome to the Team, {user_name}!\n\n"
        f"You have been appointed as {role_name} at {company_name} ({branch_name}) on Axis Black.\n\n"
        f"Role Responsibilities:\n{highlights_text}\n\n"
        f"Login Email: {to_email}\n"
        f"{f'Initial Password: {temp_password}' if temp_password else ''}\n"
        f"Login URL: {login_url}\n\n"
        f"Please change your password in Settings upon your first login."
    )
    return send_email_notification(to_email, subject, html, text)


def send_team_role_update_email(
    to_email: str,
    user_name: str,
    new_role_name: str,
    company_name: str,
    branch_name: str,
    permissions: Optional[List[str]] = None
) -> bool:
    """
    Sends an update email when a team member's role or branch assignment changes.
    """
    to_email = to_email.strip().lower()
    subject = f"Role Update: You are now appointed as {new_role_name} at {company_name}"
    login_url = f"{settings.FRONTEND_URL}/login"
    highlights = _get_role_highlights(new_role_name, permissions)
    highlights_html = "\n".join(f'<li style="margin-bottom:8px;">{item}</li>' for item in highlights)
    highlights_text = "\n".join(f"- {re_sub}" for re_sub in [h.replace('<strong>', '').replace('</strong>', '').replace('&amp;', '&') for h in highlights])

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
        <h1 class="header-title">Role Assignment Updated</h1>
        <p class="header-sub">{company_name}</p>
      </div>
      <div class="body">
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your business owner has updated your role and workspace permissions at <strong>{company_name}</strong>.</p>
        
        <div style="background:rgba(0, 212, 255, 0.05);border:1px solid rgba(0, 212, 255, 0.2);border-radius:12px;padding:18px 20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;color:#e2e8f0;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;width:130px;">New Role:</td>
              <td style="padding:6px 0;font-weight:700;color:#00d4ff;">{new_role_name}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;">Operating Branch:</td>
              <td style="padding:6px 0;font-weight:700;color:#cebdff;">{branch_name}</td>
            </tr>
          </table>
        </div>

        <p><strong>Your Updated Workspace Responsibilities:</strong></p>
        <ul style="color:#cbd5e1;font-size:14px;line-height:1.7;padding-left:20px;">
          {highlights_html}
        </ul>

        <div class="btn-wrap">
          <a href="{login_url}" class="btn">🚀 Access Workspace</a>
        </div>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">These changes take effect immediately across all your active sessions.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> &bull; Team Operations
      </div>
    </div>
  </div>
</body>
</html>"""

    text = (
        f"Role Assignment Updated\n\n"
        f"Hi {user_name},\n"
        f"Your role at {company_name} has been updated to {new_role_name} ({branch_name}).\n\n"
        f"Updated Responsibilities:\n{highlights_text}\n\n"
        f"Sign in at: {login_url}\n"
    )
    return send_email_notification(to_email, subject, html, text)


def send_team_status_email(
    to_email: str,
    user_name: str,
    company_name: str,
    is_suspended: bool
) -> bool:
    """
    Sends an email when an owner pauses (suspends) or restores a team member's access.
    """
    to_email = to_email.strip().lower()
    if is_suspended:
        subject = f"Account Notice: Access to {company_name} has been paused"
        title = "Account Access Paused"
        status_color = "#ff6b6b"
        message_body = (
            f"Your access to <strong>{company_name}</strong> has been temporarily suspended by the business owner. "
            f"During this period, you will not be able to sign in or perform actions in the workspace. "
            f"Please reach out to your business owner or administrator for any questions."
        )
    else:
        subject = f"Access Restored: Your account at {company_name} is active"
        title = "Account Access Restored"
        status_color = "#4ade80"
        message_body = (
            f"Your access to <strong>{company_name}</strong> has been reactivated by the business owner. "
            f"You can now log in and continue your operational activities."
        )

    login_url = f"{settings.FRONTEND_URL}/login"

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
        <h1 class="header-title" style="color:{status_color};">{title}</h1>
        <p class="header-sub">{company_name}</p>
      </div>
      <div class="body">
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>{message_body}</p>
        {f'''
        <div class="btn-wrap">
          <a href="{login_url}" class="btn">Sign In to Account</a>
        </div>
        ''' if not is_suspended else ''}
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">Notice dispatched automatically from the Axis Black platform.</p>
      </div>
      <div class="footer">
        <strong>Axis Black</strong> &bull; Team Operations
      </div>
    </div>
  </div>
</body>
</html>"""

    text = f"{title}\n\nHi {user_name},\n\n{message_body.replace('<strong>', '').replace('</strong>', '')}\n"
    return send_email_notification(to_email, subject, html, text)


def send_support_message_email(
    name: str,
    email: str,
    message: str,
    subject: str = "New message",
    label: str = "support",
) -> bool:
    """
    Sends support, contact, inquiry, or sales message to the support team (secherodalvine@gmail.com).
    Sets Reply-To to the sender's email address so replies go directly to the user.
    """
    clean_subject = subject.strip() or "New Support Inquiry"
    clean_label = label.strip().lower() or "support"
    formatted_label = clean_label.replace("_", " ").title()
    dest_email = getattr(settings, "SUPPORT_EMAIL", "secherodalvine@gmail.com")

    email_subject = f"[Axis Black {formatted_label}] {clean_subject}"

    import html
    safe_name = html.escape(name)
    safe_email = html.escape(email)
    safe_subject = html.escape(clean_subject)
    safe_message = html.escape(message).replace("\n", "<br>")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{email_subject}</title>
  <style>{_EMAIL_BASE_STYLE}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS<span>BLACK</span></span>
        </div>
        <h1 class="header-title">New {formatted_label} Message</h1>
        <p class="header-sub">Submitted from Axis Black Platform</p>
      </div>
      <div class="body">
        <p><strong>Sender Details:</strong></p>
        <ul style="color:#cbd5e1;font-size:14px;line-height:1.8;list-style:none;padding-left:0;">
          <li>👤 <strong>Name:</strong> {safe_name}</li>
          <li>✉️ <strong>Email:</strong> <a href="mailto:{safe_email}" style="color:#00d4ff;">{safe_email}</a></li>
          <li>🏷️ <strong>Category:</strong> {clean_label.upper()}</li>
          <li>📌 <strong>Subject:</strong> {safe_subject}</li>
        </ul>
        <hr class="divider">
        <p><strong>Message Content:</strong></p>
        <div style="background:rgba(0, 212, 255, 0.05);border:1px solid rgba(0, 212, 255, 0.2);border-radius:12px;padding:20px;color:#e2e8f0;font-size:14px;line-height:1.7;">
          {safe_message}
        </div>
        <div class="btn-wrap">
          <a href="mailto:{safe_email}" class="btn">✉️ Reply to {safe_name}</a>
        </div>
        <hr class="divider">
        <p style="font-size:12px;color:#64748b;">Replying to this email will send your response directly to <strong>{safe_email}</strong>.</p>
      </div>
      <div class="footer">
        <strong>Axis Black Support Desk</strong> &bull; Automated Dispatch
      </div>
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"Axis Black {formatted_label} Message\n\n"
        f"From: {name} <{email}>\n"
        f"Category: {clean_label.upper()}\n"
        f"Subject: {clean_subject}\n\n"
        f"Message:\n{message}\n\n"
        f"Reply directly to this email to respond to {email}."
    )

    return send_email_notification(
        to_email=dest_email,
        subject=email_subject,
        body_html=html_content,
        body_text=text_content,
        reply_to=email,
    )


def send_upgrade_receipt_email(
    to_email: str,
    user_name: str,
    plan_name: str,
    plan_key: str,
    amount_kes: int,
    reference: str,
    receipt_number: str,
    payment_mode: str,
    paid_at: str,
    expires_at: str,
) -> bool:
    """
    Sends a subscription upgrade confirmation and official payment receipt email.
    Dispatched immediately after payment activation (STK push, Till approval, Paystack card/webhook, or admin assignment).
    """
    to_email = to_email.strip().lower()
    frontend_url = getattr(settings, "FRONTEND_URL", "https://axisblack.io").rstrip("/")
    duration_label = "1 Month Access" if "starter" in plan_key.lower() else "3 Months Access" if "pro" in plan_key.lower() else "Custom Subscription"

    subject = f"Subscription Activated — {plan_name} | Axis Black Receipt #{receipt_number}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>{_EMAIL_BASE_STYLE}
    .receipt-box {{
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.22);
      border-radius: 14px;
      padding: 24px;
      margin: 24px 0;
    }}
    .receipt-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }}
    .receipt-table td {{
      padding: 9px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }}
    .receipt-table tr:last-child td {{
      border-bottom: none;
    }}
    .receipt-label {{
      color: #94a3b8;
      font-weight: 500;
    }}
    .receipt-val {{
      font-weight: 700;
      color: #e2e8f0;
      text-align: right;
      font-family: 'Segoe UI', Arial, sans-serif;
    }}
    .receipt-val-code {{
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">
          <span class="brand-name">AXIS<span>BLACK</span></span>
        </div>
        <h1 class="header-title">Subscription Activated!</h1>
        <p class="header-sub">Your payment has been confirmed and plan entitlements are live</p>
      </div>
      <div class="body">
        <p>Dear <strong>{user_name}</strong>,</p>
        <p>Thank you for choosing Axis Black. Your subscription upgrade to <strong>{plan_name}</strong> ({duration_label}) has been completed successfully. Your business workspace, financial models, advanced metrics, and AI capabilities are now active.</p>

        <div class="receipt-box">
          <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #00d4ff; text-transform: uppercase;">
            Official Payment Receipt
          </p>
          <table class="receipt-table">
            <tr>
              <td class="receipt-label">Subscription Tier</td>
              <td class="receipt-val"><strong style="color: #ffffff;">{plan_name}</strong></td>
            </tr>
            <tr>
              <td class="receipt-label">Amount Paid</td>
              <td class="receipt-val"><span style="color: #4ade80; font-size: 15px; font-weight: 800;">KES {amount_kes:,}</span></td>
            </tr>
            <tr>
              <td class="receipt-label">Payment Mode</td>
              <td class="receipt-val">{payment_mode}</td>
            </tr>
            <tr>
              <td class="receipt-label">Receipt Number</td>
              <td class="receipt-val receipt-val-code" style="color: #00d4ff;">{receipt_number}</td>
            </tr>
            <tr>
              <td class="receipt-label">Transaction Ref</td>
              <td class="receipt-val receipt-val-code">{reference}</td>
            </tr>
            <tr>
              <td class="receipt-label">Payment Date</td>
              <td class="receipt-val">{paid_at}</td>
            </tr>
            <tr>
              <td class="receipt-label">Access Expiration</td>
              <td class="receipt-val" style="color: #fbbf24;">{expires_at}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
          Your team members attached to your business profile also now have full access to upgraded collaborative tools and permissions.
        </p>

        <div class="btn-wrap">
          <a href="{frontend_url}" class="btn">Launch Workspace Dashboard</a>
        </div>

        <hr class="divider">
        <p style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
          Need assistance or custom enterprise billing? Contact our concierge team at <a href="mailto:nairobi@axisblack.io" style="color: #00d4ff; text-decoration: none;">nairobi@axisblack.io</a>.
        </p>
        <p style="font-size: 11px; color: #475569;">
          This is an automated transaction confirmation.
        </p>
      </div>
      <div class="footer">
        <strong>Axis Black Intelligence</strong> &bull; Financial Workspace &bull; Nairobi, Kenya
      </div>
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"Axis Black — {plan_name} Subscription Activated\\n\\n"
        f"Hi {user_name},\\n\\n"
        f"Thank you for upgrading! Your {plan_name} subscription is now live.\\n\\n"
        f"PAYMENT RECEIPT DETAILS:\\n"
        f"  Tier:           {plan_name} ({duration_label})\\n"
        f"  Amount:         KES {amount_kes:,}\\n"
        f"  Payment Mode:   {payment_mode}\\n"
        f"  Receipt No.:    {receipt_number}\\n"
        f"  Reference:      {reference}\\n"
        f"  Date:           {paid_at}\\n"
        f"  Valid Until:    {expires_at}\\n\\n"
        f"Launch Workspace: {frontend_url}\\n"
        f"Customer Support: nairobi@axisblack.io\\n"
    )

    return send_email_notification(
        to_email=to_email,
        subject=subject,
        body_html=html,
        body_text=text_content,
        reply_to="nairobi@axisblack.io",
    )



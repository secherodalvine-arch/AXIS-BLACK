"""
payments.py — Complete Payment Engine, Billing & Plan Entitlements for Axis Black.
Supports:
  - Three Packages: Free, Starter (Monthly - 899 KES), Pro (Quarterly 3 Months - 2,299 KES)
  - Paystack Gateway: Card Checkout & Safaricom M-Pesa STK Push
  - Manual M-Pesa Till Verification with Admin Approval
  - Paystack Webhook Handler with HMAC-SHA512 Signature Verification
  - Usage Telemetry & Daily/Monthly Quota Tracking with Pro Extensions
  - Admin Platform Revenue, Statistics & Plan Provisioning
"""

import os
import re
import json
import uuid
import hmac
import hashlib
import logging
import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks, Query
from pydantic import BaseModel, Field
import httpx
from bson import ObjectId

from app.config import settings
from app.database import db_manager, AxisDataStore
from app.auth.dependencies import get_current_user
from app.routers.admin import get_current_admin
from app.services.email_service import send_upgrade_receipt_email

logger = logging.getLogger("axisblack.payments")

router = APIRouter(prefix="/api/payments", tags=["Payment Engine & Billing"])

# ── Config ────────────────────────────────────────────────────────────────────
PAYSTACK_SECRET = (settings.PAYSTACK_SECRET_KEY or os.getenv("PAYSTACK_SECRET_KEY", "")).strip()
PAYSTACK_BASE = (settings.PAYSTACK_BASE_URL or "https://api.paystack.co").rstrip("/")
FRONTEND_URL = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")

MPESA_TILL = (settings.MPESA_TILL_NUMBER or os.getenv("MPESA_TILL_NUMBER", "3645270")).strip()
MPESA_NAME = (settings.MPESA_BUSINESS_NAME or os.getenv("MPESA_BUSINESS_NAME", "IAN WABWIRE")).strip()

# ── Package Definitions ───────────────────────────────────────────────────────
PLANS = {
    "free": {
        "key": "free",
        "name": "Free Tier",
        "amount_kes": 0,
        "duration_days": 0,
        "billing_period": "Free forever",
        "description": "Essential runway planning and financial simulation for micro businesses.",
        "branches_limit": 1,
        "inventory_limit": 2,
        "runway_simulator": True,
        "business_summary": False,
        "voice_agent": False,
        "spreadsheet": False,
        "team_roles": False,
        "axis_agent_daily_limit": 8,
        "axis_agent_monthly_limit": 240,
        "voice_agent_daily_limit": 0,
        "voice_agent_monthly_limit": 0,
        "can_extend_agent": False,
        "can_extend_voice": False,
        "priority_support": False,
        "features": [
            "Create & manage your business profile",
            "1 branch location included",
            "Runway simulator & cash runway projection",
            "Inventory manager with up to 2 SKU items",
            "Axis AI Agent (up to 8 queries/day, 240/mo)",
            "Community platform support",
        ],
    },
    "starter": {
        "key": "starter",
        "name": "Starter",
        "amount_kes": 899,
        "duration_days": 30,
        "billing_period": "per month",
        "description": "Complete operations suite with team roles, voice AI, spreadsheet, and business summaries.",
        "branches_limit": -1,  # unlimited
        "inventory_limit": -1,  # unlimited
        "runway_simulator": True,
        "business_summary": True,
        "voice_agent": True,
        "spreadsheet": True,
        "team_roles": True,
        "axis_agent_daily_limit": 20,
        "axis_agent_monthly_limit": 600,
        "voice_agent_daily_limit": 13,
        "voice_agent_monthly_limit": 400,
        "can_extend_agent": False,
        "can_extend_voice": False,
        "priority_support": False,
        "features": [
            "Everything in Free Tier",
            "Unlimited branch locations",
            "Create team members & assign role permissions",
            "Interactive Spreadsheet (Sheets engine)",
            "Unlimited Inventory items & Ledger entries",
            "Business Summary & Automated 6 PM Reports",
            "Axis AI Agent (up to 20 queries/day, 600/mo)",
            "Axis Voice Support Agent (13 queries/day, 400/mo)",
            "Standard support via email & in-app chat",
        ],
    },
    "pro": {
        "key": "pro",
        "name": "Pro",
        "amount_kes": 2299,
        "duration_days": 90,
        "billing_period": "for 3 months",
        "description": "High-volume executive power with double daily AI extension and priority VIP support.",
        "branches_limit": -1,  # unlimited
        "inventory_limit": -1,  # unlimited
        "runway_simulator": True,
        "business_summary": True,
        "voice_agent": True,
        "spreadsheet": True,
        "team_roles": True,
        "axis_agent_daily_limit": 40,
        "axis_agent_monthly_limit": 1200,
        "voice_agent_daily_limit": 26,
        "voice_agent_monthly_limit": 800,
        "can_extend_agent": True,   # +40 extra exchanges daily when daily limit is reached
        "can_extend_voice": True,   # +7 extra exchanges daily when daily limit is reached
        "priority_support": True,
        "features": [
            "Everything in Starter Tier",
            "3 Months prepaid access (Best Value)",
            "Priority VIP Customer Support & Fast Escalation",
            "Axis AI Agent (40 queries/day, 1,200/mo)",
            "Double Daily Agent Extension (+40 extra queries daily)",
            "Axis Voice Support Agent (26 queries/day, 800/mo)",
            "Voice Agent Extension (+7 queries when limit reached)",
            "Interactive Spreadsheet (Sheets engine) unlimited",
            "Multi-branch team synchronization & audit logs",
        ],
    },
}

# ── Financial Helpers ─────────────────────────────────────────────────────────
def _paystack_fee(amount_kes: int) -> float:
    """Paystack standard fee: 1.5% + KES 30 (waived under KES 2500), capped at KES 1000."""
    fee = amount_kes * 0.015
    if amount_kes >= 2500:
        fee += 30
    return round(min(fee, 1000.0), 2)

def _net_revenue(amount_kes: int) -> float:
    return round(amount_kes - _paystack_fee(amount_kes), 2)

def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def _iso(dt: Optional[datetime.datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc).isoformat()

def _today_str() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

def _month_str() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m")

def _receipt_number(ref: str) -> str:
    token = (ref or uuid.uuid4().hex[:8]).replace("-", "").upper()
    return f"AXIS-REC-{token[-8:]}"


async def _dispatch_upgrade_receipt_and_notification(
    user_id: str,
    user_email: str,
    user_name: str,
    plan_key: str,
    amount_kes: int,
    reference: str,
    receipt_number: str,
    payment_mode: str,
    paid_at: str,
    expires_at: str,
):
    """
    Sends both an in-app notification to the user and an email receipt with full payment details.
    """
    plan = PLANS.get(plan_key, PLANS.get("starter", {}))
    plan_name = plan.get("name", plan_key.capitalize())

    # 1. In-App Notification for user
    try:
        if user_id:
            exp_date_label = expires_at.split("T")[0] if "T" in str(expires_at) else str(expires_at)
            await AxisDataStore.add_notification(
                recipient_id=user_id,
                title=f"Payment Receipt: {plan_name} Active",
                message=f"Your {plan_name} subscription has been activated! Receipt #{receipt_number} for KES {amount_kes:,} via {payment_mode}. Access valid until {exp_date_label}.",
                notif_type="success",
                meta={
                    "plan": plan_key,
                    "plan_name": plan_name,
                    "receipt_number": receipt_number,
                    "amount_kes": amount_kes,
                    "reference": reference,
                    "payment_mode": payment_mode,
                    "paid_at": paid_at,
                    "expires_at": expires_at,
                }
            )
            logger.info(f"Recorded in-app upgrade notification for user {user_id} ({plan_name})")
    except Exception as e:
        logger.warning(f"Could not record user in-app upgrade notification: {e}")

    # 2. Official Email Receipt
    try:
        if user_email and "@" in user_email:
            send_upgrade_receipt_email(
                to_email=user_email,
                user_name=user_name or "Valued Client",
                plan_name=plan_name,
                plan_key=plan_key,
                amount_kes=amount_kes,
                reference=reference,
                receipt_number=receipt_number,
                payment_mode=payment_mode,
                paid_at=paid_at,
                expires_at=expires_at,
            )
            logger.info(f"Dispatched upgrade receipt email to {user_email} for receipt {receipt_number}")
    except Exception as e:
        logger.warning(f"Could not dispatch upgrade email receipt to {user_email}: {e}")


# ── Pydantic Request / Response Schemas ────────────────────────────────────────
class InitiatePaymentReq(BaseModel):
    plan: str = Field(..., example="starter")
    phone: Optional[str] = Field(None, example="0712345678")
    channel: str = Field("card", example="card")  # card | mobile_money

class VerifyPaymentReq(BaseModel):
    reference: str

class TillSubmitReq(BaseModel):
    plan: str
    reference: str
    phone: Optional[str] = ""

class ExtendLimitReq(BaseModel):
    type: str = Field("chat", example="chat")  # chat | voice

class AssignPlanReq(BaseModel):
    user_id: str
    plan: str
    notes: Optional[str] = "Manual assignment by administrator"


# ── Storage Helpers for Payments & Usage ──────────────────────────────────────
async def _insert_payment(doc: dict) -> str:
    if db_manager.is_connected and db_manager.db is not None:
        res = await db_manager.db.payments.insert_one(doc)
        return str(res.inserted_id)
    else:
        pid = f"pay-{uuid.uuid4().hex[:12]}"
        doc["_id"] = pid
        db_manager.memory_store.setdefault("payments", {})[pid] = doc
        db_manager.save_memory_store()
        return pid

async def _find_payment_by_ref(ref: str) -> Optional[dict]:
    if db_manager.is_connected and db_manager.db is not None:
        doc = await db_manager.db.payments.find_one({"reference": ref})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc
    else:
        for p in db_manager.memory_store.get("payments", {}).values():
            if p.get("reference") == ref:
                return dict(p)
        return None

async def _find_payment_by_id(pid: str) -> Optional[dict]:
    if db_manager.is_connected and db_manager.db is not None:
        try:
            oid = ObjectId(pid)
            doc = await db_manager.db.payments.find_one({"_id": oid})
        except Exception:
            doc = await db_manager.db.payments.find_one({"_id": pid})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc
    else:
        doc = db_manager.memory_store.get("payments", {}).get(pid)
        return dict(doc) if doc else None

async def _update_payment(pid: str, update_fields: dict):
    if db_manager.is_connected and db_manager.db is not None:
        try:
            oid = ObjectId(pid)
            await db_manager.db.payments.update_one({"_id": oid}, {"$set": update_fields})
        except Exception:
            await db_manager.db.payments.update_one({"_id": pid}, {"$set": update_fields})
    if "payments" in db_manager.memory_store and pid in db_manager.memory_store["payments"]:
        db_manager.memory_store["payments"][pid].update(update_fields)
        db_manager.save_memory_store()

def _parse_expiry(exp: Any) -> Optional[datetime.datetime]:
    """Parses an expiry stored as ISO string OR datetime into an aware UTC datetime."""
    if not exp:
        return None
    try:
        if isinstance(exp, str):
            exp_dt = datetime.datetime.fromisoformat(exp.strip().replace("Z", "+00:00"))
        elif isinstance(exp, datetime.datetime):
            exp_dt = exp
        else:
            return None
    except Exception:
        return None
    if exp_dt.tzinfo is None:
        exp_dt = exp_dt.replace(tzinfo=datetime.timezone.utc)
    return exp_dt


async def _resolve_user_identifiers(user_id: str) -> List[str]:
    """
    Returns every identifier a payment may have been recorded under for this user
    (user_id, id, Mongo _id, email) so admin-assigned plans are always matched.
    """
    ids = {str(user_id)} if user_id else set()
    user = None
    try:
        if db_manager.is_connected and db_manager.db is not None:
            user = await db_manager.db.users.find_one(
                {"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]}
            )
        else:
            for u in db_manager.memory_store.get("users", {}).values():
                if user_id in (u.get("user_id"), u.get("id"), u.get("email")):
                    user = u
                    break
    except Exception as e:
        logger.warning(f"Could not resolve alternate identifiers for {user_id}: {e}")
    if user:
        for key in ("user_id", "id", "_id", "email"):
            val = user.get(key)
            if val:
                ids.add(str(val))
    return list(ids)


async def _get_active_paid_payment(user_id: str) -> Optional[dict]:
    """
    Finds the user's best currently-active paid plan (self-paid, M-Pesa, card OR admin-assigned).
    Expiry is evaluated in Python because it may be stored as an ISO string or a datetime,
    and a Mongo `$gt` datetime comparison never matches ISO-string values.
    """
    now = _now()
    identifiers = await _resolve_user_identifiers(user_id)
    if not identifiers:
        return None

    if db_manager.is_connected and db_manager.db is not None:
        cursor = db_manager.db.payments.find({
            "status": {"$in": ["paid", "PAID", "success"]},
            "$or": [{"user_id": {"$in": identifiers}}, {"user_email": {"$in": identifiers}}],
        })
        docs = await cursor.to_list(length=500)
        for d in docs:
            d["_id"] = str(d["_id"])
    else:
        docs = [
            dict(p) for p in db_manager.memory_store.get("payments", {}).values()
            if str(p.get("status", "")).lower() in ("paid", "success")
            and (p.get("user_id") in identifiers or p.get("user_email") in identifiers)
        ]

    tier_rank = {"free": 0, "starter": 1, "pro": 2}
    candidates = []
    for p in docs:
        exp_dt = _parse_expiry(p.get("expires_at"))
        if exp_dt and exp_dt > now and p.get("plan") in ("starter", "pro"):
            candidates.append((tier_rank.get(p.get("plan"), 0), exp_dt, p))

    if not candidates:
        return None
    # Highest tier first, then furthest expiry
    candidates.sort(key=lambda c: (c[0], c[1]), reverse=True)
    return dict(candidates[0][2])


# ── Telemetry & Usage Tracking ────────────────────────────────────────────────
async def _get_user_usage(user_id: str) -> dict:
    today = _today_str()
    month = _month_str()
    key = f"{user_id}_{today}"

    if db_manager.is_connected and db_manager.db is not None:
        daily_doc = await db_manager.db.usage.find_one({"key": key}) or {}
        # Count monthly usage
        monthly_docs = await db_manager.db.usage.find({"user_id": user_id, "month": month}).to_list(100)
        chat_month = sum(d.get("chat_count", 0) for d in monthly_docs)
        voice_month = sum(d.get("voice_count", 0) for d in monthly_docs)
    else:
        store = db_manager.memory_store.get("usage", {})
        daily_doc = store.get(key, {})
        chat_month = 0
        voice_month = 0
        for k, v in store.items():
            if v.get("user_id") == user_id and v.get("month") == month:
                chat_month += v.get("chat_count", 0)
                voice_month += v.get("voice_count", 0)

    return {
        "chat_today": daily_doc.get("chat_count", 0),
        "chat_month": chat_month,
        "chat_extended": daily_doc.get("chat_extended", False),
        "voice_today": daily_doc.get("voice_count", 0),
        "voice_month": voice_month,
        "voice_extended": daily_doc.get("voice_extended", False),
    }

async def record_usage(user_id: str, kind: str = "chat"):
    """Increments user query count for today and month."""
    today = _today_str()
    month = _month_str()
    key = f"{user_id}_{today}"
    inc_field = "chat_count" if kind == "chat" else "voice_count"

    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.usage.update_one(
            {"key": key},
            {
                "$set": {"user_id": user_id, "date": today, "month": month},
                "$inc": {inc_field: 1}
            },
            upsert=True
        )
    else:
        store = db_manager.memory_store.setdefault("usage", {})
        if key not in store:
            store[key] = {
                "key": key,
                "user_id": user_id,
                "date": today,
                "month": month,
                "chat_count": 0,
                "voice_count": 0,
                "chat_extended": False,
                "voice_extended": False
            }
        store[key][inc_field] = store[key].get(inc_field, 0) + 1
        db_manager.save_memory_store()


# ── Full Subscription Resolver ────────────────────────────────────────────────
async def get_user_subscription(user_id: str) -> dict:
    """Returns plan details, active status, days remaining, entitlements, and usage."""
    now = _now()
    active_pay = await _get_active_paid_payment(user_id)

    plan_key = "free"
    is_active = False
    expires_at = None
    days_left = 0
    receipt_no = None
    payment_mode = None
    payment_id = None

    if active_pay:
        plan_key = active_pay.get("plan", "free")
        raw_exp = active_pay.get("expires_at")
        if isinstance(raw_exp, str):
            exp_dt = datetime.datetime.fromisoformat(raw_exp.replace("Z", "+00:00"))
        else:
            exp_dt = raw_exp
        if exp_dt and exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=datetime.timezone.utc)

        if exp_dt and exp_dt > now:
            is_active = True
            expires_at = _iso(exp_dt)
            diff = (exp_dt - now).total_seconds()
            days_left = max(0, int(diff // 86400))
            receipt_no = active_pay.get("receipt_number") or _receipt_number(active_pay.get("reference", ""))
            payment_mode = active_pay.get("payment_mode") or active_pay.get("channel", "Card")
            payment_id = active_pay.get("_id")

    plan_info = PLANS.get(plan_key, PLANS["free"])
    usage_info = await _get_user_usage(user_id)

    # Real resource counts
    # 1. Branches count
    branches_count = 0
    if db_manager.is_connected and db_manager.db is not None:
        biz = await db_manager.db.businesses.find_one({"owner_id": user_id})
        if biz:
            branches_count = len(biz.get("branches", []))
    else:
        biz = db_manager.memory_store.get("businesses", {}).get(user_id)
        if biz:
            branches_count = len(biz.get("branches", []))

    # 2. Inventory count
    inventory_items = await AxisDataStore.get_inventory(user_id)
    inventory_count = len(inventory_items)

    # Calculate effective daily limits (accounting for Pro extensions)
    effective_agent_daily_limit = plan_info["axis_agent_daily_limit"]
    if plan_key == "pro" and usage_info["chat_extended"]:
        effective_agent_daily_limit += 40  # double daily limit for Pro

    effective_voice_daily_limit = plan_info["voice_agent_daily_limit"]
    if plan_key == "pro" and usage_info["voice_extended"]:
        effective_voice_daily_limit += 7   # extended by a quarter (~7 for 26)

    return {
        "plan": plan_key,
        "plan_key": plan_key,
        "name": plan_info["name"],
        "plan_name": plan_info["name"],
        "is_active": is_active or plan_key == "free",
        "is_paid": is_active and plan_key in ("starter", "pro"),
        "expires_at": expires_at,
        "days_left": days_left,
        "receipt_number": receipt_no,
        "payment_mode": payment_mode,
        "payment_id": payment_id,
        "amount_kes": plan_info["amount_kes"],
        "billing_period": plan_info["billing_period"],
        # Entitlements
        "entitlements": {
            "runway_simulator": plan_info["runway_simulator"],
            "business_summary": plan_info["business_summary"],
            "voice_agent": plan_info["voice_agent"],
            "spreadsheet": plan_info["spreadsheet"],
            "team_roles": plan_info["team_roles"],
            "priority_support": plan_info["priority_support"],
            "branches_limit": plan_info["branches_limit"],
            "inventory_limit": plan_info["inventory_limit"],
        },
        # Current Resource Counts
        "resources": {
            "branches_count": branches_count,
            "branches_limit": plan_info["branches_limit"],
            "can_add_branch": plan_info["branches_limit"] == -1 or branches_count < plan_info["branches_limit"],
            "inventory_count": inventory_count,
            "inventory_limit": plan_info["inventory_limit"],
            "can_add_inventory": plan_info["inventory_limit"] == -1 or inventory_count < plan_info["inventory_limit"],
        },
        # Usage Stats & Limits
        "usage": {
            "axis_agent_chat": {
                "used_today": usage_info["chat_today"],
                "daily_limit": effective_agent_daily_limit,
                "base_daily_limit": plan_info["axis_agent_daily_limit"],
                "used_month": usage_info["chat_month"],
                "monthly_limit": plan_info["axis_agent_monthly_limit"],
                "daily_limit_reached": usage_info["chat_today"] >= effective_agent_daily_limit,
                "can_extend": plan_key == "pro" and not usage_info["chat_extended"],
                "is_extended": usage_info["chat_extended"],
            },
            "voice_agent": {
                "used_today": usage_info["voice_today"],
                "daily_limit": effective_voice_daily_limit,
                "base_daily_limit": plan_info["voice_agent_daily_limit"],
                "used_month": usage_info["voice_month"],
                "monthly_limit": plan_info["voice_agent_monthly_limit"],
                "daily_limit_reached": (usage_info["voice_today"] >= effective_voice_daily_limit) if plan_info["voice_agent"] else True,
                "can_extend": plan_key == "pro" and not usage_info["voice_extended"],
                "is_extended": usage_info["voice_extended"],
            }
        }
    }


# ── Client Routes ─────────────────────────────────────────────────────────────

@router.get("/plans")
async def get_plans():
    """Returns available packages and feature matrices."""
    return {
        "status": "success",
        "plans": PLANS,
        "currency": "KES",
        "mpesa_till": MPESA_TILL,
        "mpesa_name": MPESA_NAME,
    }


@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """Returns the user's active plan, entitlements, countdown, and live usage counters."""
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    sub = await get_user_subscription(user_id)
    return {"status": "success", "data": sub}


@router.get("/history")
async def get_payment_history(current_user: dict = Depends(get_current_user)):
    """Returns user's transaction/payment history, auto-syncing recent pending Paystack payments."""
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    payments = []
    if db_manager.is_connected and db_manager.db is not None:
        cursor = db_manager.db.payments.find({"user_id": user_id}).sort("created_at", -1)
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            payments.append(doc)
    else:
        for p in db_manager.memory_store.get("payments", {}).values():
            if p.get("user_id") == user_id:
                payments.append(dict(p))
        payments.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

    # Auto-synchronize pending Paystack transactions with real gateway state
    pending_paystack = [p for p in payments if p.get("status") == "pending" and p.get("provider") == "paystack"][:6]
    if pending_paystack and PAYSTACK_SECRET:
        for p in pending_paystack:
            ref = p.get("reference")
            if not ref:
                continue
            try:
                ps_res = await _check_paystack_status(ref)
                if ps_res["status"] == "success":
                    p["status"] = "paid"
                    p["paid_at"] = _now().isoformat()
                    p["payment_mode"] = "M-Pesa" if p.get("channel") == "mobile_money" else "Card"
                    await _update_payment(p["_id"], {
                        "status": "paid",
                        "paid_at": p["paid_at"],
                        "payment_mode": p["payment_mode"],
                        "updated_at": _now().isoformat()
                    })
                elif ps_res["status"] == "failed":
                    fail_msg = ps_res.get("gateway_response") or "Payment was cancelled or failed."
                    p["status"] = "failed"
                    p["failure_reason"] = fail_msg
                    p["gateway_response"] = ps_res.get("gateway_response", "")
                    await _update_payment(p["_id"], {
                        "status": "failed",
                        "failure_reason": fail_msg,
                        "gateway_response": p["gateway_response"],
                        "updated_at": _now().isoformat()
                    })
                else:
                    # Check timeout by age
                    created_at_dt = None
                    if p.get("created_at"):
                        try:
                            created_at_dt = datetime.datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
                        except Exception:
                            pass
                    max_secs = 120 if p.get("channel") == "mobile_money" else 900
                    if created_at_dt and (_now() - created_at_dt).total_seconds() > max_secs:
                        timeout_msg = "M-Pesa STK prompt timed out." if p.get("channel") == "mobile_money" else "Payment session expired."
                        p["status"] = "failed"
                        p["failure_reason"] = timeout_msg
                        await _update_payment(p["_id"], {
                            "status": "failed",
                            "failure_reason": timeout_msg,
                            "updated_at": _now().isoformat()
                        })
            except Exception as e:
                logger.warning(f"Auto-sync history error for ref {ref}: {e}")

    return {"status": "success", "data": payments}


@router.get("/till-info")
async def get_till_info():
    """Returns M-Pesa Buy Goods Till details for manual payment flow."""
    return {
        "status": "success",
        "data": {
            "till": MPESA_TILL,
            "name": MPESA_NAME,
            "instructions": f"1. Go to M-Pesa on your phone\n2. Select Lipa na M-Pesa -> Buy Goods and Services\n3. Enter Till Number: {MPESA_TILL}\n4. Enter the plan amount (899 KES for Starter, 2299 KES for Pro)\n5. Enter your M-Pesa PIN and submit the confirmation code below."
        }
    }


@router.post("/initiate")
async def initiate_payment(
    body: InitiatePaymentReq,
    current_user: dict = Depends(get_current_user)
):
    """
    channel='card' -> Returns Paystack authorization_url (hosted checkout)
    channel='mobile_money' -> Dispatches Safaricom M-Pesa STK Push prompt to phone
    """
    plan_key = body.plan.lower().strip()
    if plan_key not in ("starter", "pro"):
        raise HTTPException(400, "Invalid plan selected for payment. Choose 'starter' or 'pro'.")

    plan = PLANS[plan_key]
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    user_email = current_user.get("email", "")
    user_name = current_user.get("name", "Axis User")

    amount_kes = plan["amount_kes"]
    ref = f"AXIS-{uuid.uuid4().hex[:10].upper()}"

    doc = {
        "user_id": user_id,
        "user_name": user_name,
        "user_email": user_email,
        "plan": plan_key,
        "amount_kes": amount_kes,
        "fee_kes": _paystack_fee(amount_kes),
        "net_kes": _net_revenue(amount_kes),
        "currency": "KES",
        "channel": body.channel,
        "status": "pending",
        "provider": "paystack",
        "reference": ref,
        "receipt_number": _receipt_number(ref),
        "description": f"{plan['name']} Subscription — Axis Black",
        "expires_at": None,
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    }
    pid = await _insert_payment(doc)

    # Convert to KES subunits (kobo/cents = KES * 100)
    paystack_amount = amount_kes * 100

    # 1. Card Checkout via Paystack
    if body.channel == "card":
        if not PAYSTACK_SECRET:
            # Resilient development fallback: activate directly in dev if no key configured
            doc["status"] = "paid"
            doc["paid_at"] = _now().isoformat()
            doc["expires_at"] = (_now() + datetime.timedelta(days=plan["duration_days"])).isoformat()
            await _update_payment(pid, doc)
            return {
                "status": "success",
                "channel": "card",
                "reference": ref,
                "payment_id": pid,
                "amount_kes": amount_kes,
                "authorization_url": f"{FRONTEND_URL}/?tab=billing&ref={ref}&auto=true",
                "message": "Payment initialized successfully."
            }

        payload = {
            "email": user_email,
            "amount": paystack_amount,
            "currency": "KES",
            "reference": ref,
            "callback_url": f"{FRONTEND_URL}/?tab=billing&ref={ref}",
            "channels": ["card"],
            "metadata": {
                "plan": plan_key,
                "payment_id": pid,
                "user_id": user_id,
                "platform": "Axis Black Financial Intelligence"
            }
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(
                    f"{PAYSTACK_BASE}/transaction/initialize",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {PAYSTACK_SECRET}",
                        "Content-Type": "application/json"
                    }
                )
            rdata = r.json()
            if not r.is_success or not rdata.get("status"):
                err_msg = rdata.get("message", "Paystack initialization failed.")
                raise HTTPException(502, f"Payment gateway error: {err_msg}")

            auth_url = rdata.get("data", {}).get("authorization_url")
            return {
                "status": "success",
                "channel": "card",
                "reference": ref,
                "payment_id": pid,
                "amount_kes": amount_kes,
                "authorization_url": auth_url,
                "access_code": rdata.get("data", {}).get("access_code"),
            }
        except httpx.RequestError as e:
            raise HTTPException(502, f"Could not reach Paystack gateway: {str(e)}")

    # 2. M-Pesa STK Push
    elif body.channel == "mobile_money":
        phone = (body.phone or "").strip().replace(" ", "").replace("-", "")
        if not phone:
            raise HTTPException(400, "Safaricom phone number is required for M-Pesa STK Push.")

        # Normalize phone to +254...
        if phone.startswith("0"):
            phone = "+254" + phone[1:]
        elif phone.startswith("254"):
            phone = "+" + phone
        elif not phone.startswith("+"):
            phone = "+254" + phone

        if not PAYSTACK_SECRET:
            # Resilient development fallback
            return {
                "status": "success",
                "channel": "mobile_money",
                "reference": ref,
                "payment_id": pid,
                "amount_kes": amount_kes,
                "message": f"M-Pesa STK prompt sent to {phone}. Enter your PIN to complete."
            }

        payload = {
            "email": user_email,
            "amount": paystack_amount,
            "currency": "KES",
            "reference": ref,
            "mobile_money": {
                "phone": phone,
                "provider": "mpesa"
            },
            "metadata": {
                "plan": plan_key,
                "payment_id": pid,
                "user_id": user_id,
                "phone": phone
            }
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                r = await client.post(
                    f"{PAYSTACK_BASE}/charge",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {PAYSTACK_SECRET}",
                        "Content-Type": "application/json"
                    }
                )
            rdata = r.json()
            charge_data = rdata.get("data", {})
            charge_status = charge_data.get("status", "")

            if not r.is_success and charge_status not in ("send_otp", "pay_offline", "pending"):
                err_msg = rdata.get("message", "M-Pesa prompt could not be dispatched.")
                raise HTTPException(502, f"M-Pesa error: {err_msg}")

            return {
                "status": "success",
                "channel": "mobile_money",
                "reference": ref,
                "payment_id": pid,
                "amount_kes": amount_kes,
                "charge_status": charge_status,
                "message": f"M-Pesa prompt dispatched to {phone}. Please enter your M-Pesa PIN on your phone."
            }
        except httpx.RequestError as e:
            raise HTTPException(502, f"Could not contact M-Pesa gateway: {str(e)}")

    else:
        raise HTTPException(400, f"Unsupported payment channel: {body.channel}")


async def _check_paystack_status(ref: str) -> dict:
    """
    Queries Paystack to determine real-time status of transaction or mobile money charge.
    Returns:
        {
            "status": "success" | "failed" | "pending",
            "gateway_response": str,
            "channel": str,
            "raw_status": str
        }
    """
    if not PAYSTACK_SECRET:
        return {
            "status": "pending",
            "gateway_response": "Gateway offline",
            "channel": "mobile_money",
            "raw_status": "pending"
        }

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Primary check: /transaction/verify/{ref}
        try:
            r1 = await client.get(
                f"{PAYSTACK_BASE}/transaction/verify/{ref}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET}"}
            )
            if r1.is_success:
                res1 = r1.json()
                data1 = res1.get("data") or {}
                raw_st = (data1.get("status") or "").lower()
                gateway_resp = data1.get("gateway_response") or data1.get("message") or ""
                channel = data1.get("channel") or ""

                if raw_st == "success":
                    return {
                        "status": "success",
                        "gateway_response": gateway_resp or "Payment successful",
                        "channel": channel,
                        "raw_status": raw_st,
                        "data": data1
                    }
                elif raw_st in ("failed", "abandoned", "timeout", "reversed"):
                    clean_msg = gateway_resp
                    if "cancel" in clean_msg.lower():
                        clean_msg = "Request Cancelled by user."
                    elif not clean_msg:
                        clean_msg = f"Transaction was {raw_st}."
                    return {
                        "status": "failed",
                        "gateway_response": clean_msg,
                        "channel": channel,
                        "raw_status": raw_st,
                        "data": data1
                    }
        except Exception as e:
            logger.warning(f"Paystack /transaction/verify error for {ref}: {e}")

        # 2. Secondary check for Mobile Money charge: /charge/{ref}
        try:
            r2 = await client.get(
                f"{PAYSTACK_BASE}/charge/{ref}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET}"}
            )
            if r2.is_success:
                res2 = r2.json()
                data2 = res2.get("data") or {}
                raw_st = (data2.get("status") or "").lower()
                gateway_resp = data2.get("gateway_response") or data2.get("message") or ""

                if raw_st == "success":
                    return {
                        "status": "success",
                        "gateway_response": gateway_resp or "Payment successful",
                        "channel": "mobile_money",
                        "raw_status": raw_st,
                        "data": data2
                    }
                elif raw_st in ("failed", "abandoned", "timeout", "reversed"):
                    clean_msg = gateway_resp or f"M-Pesa transaction was {raw_st}."
                    return {
                        "status": "failed",
                        "gateway_response": clean_msg,
                        "channel": "mobile_money",
                        "raw_status": raw_st,
                        "data": data2
                    }
        except Exception as e:
            logger.warning(f"Paystack /charge error for {ref}: {e}")

    return {
        "status": "pending",
        "gateway_response": "Awaiting customer authorization on mobile phone.",
        "channel": "mobile_money",
        "raw_status": "pending"
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentReq,
    current_user: dict = Depends(get_current_user)
):
    """
    Verifies a transaction by reference against Paystack or stored record.
    Detects success, user cancellation, decline, or prompt timeout.
    Activates the subscription and sets expiration timestamp upon success.
    """
    ref = body.reference.strip()
    payment = await _find_payment_by_ref(ref)
    if not payment:
        raise HTTPException(404, f"Payment reference '{ref}' not found.")

    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    if payment.get("user_id") != user_id:
        raise HTTPException(403, "Payment belongs to a different account.")

    # If already paid, return active subscription
    if payment.get("status") == "paid":
        sub = await get_user_subscription(user_id)
        return {
            "status": "success",
            "already_paid": True,
            "message": "Payment verified and already active.",
            "data": sub
        }

    # If already marked failed or cancelled in DB, return failed status immediately
    if payment.get("status") in ("failed", "cancelled"):
        return {
            "status": "failed",
            "message": payment.get("failure_reason") or "Payment was cancelled or could not be completed.",
            "gateway_response": payment.get("gateway_response") or payment.get("failure_reason") or "",
            "data": {
                "reference": ref,
                "status": payment.get("status"),
                "failure_reason": payment.get("failure_reason")
            }
        }

    # Query Paystack verification endpoint
    ps_result = await _check_paystack_status(ref)

    if ps_result["status"] == "success":
        # Activate Plan
        plan_key = payment.get("plan", "starter")
        plan = PLANS.get(plan_key, PLANS["starter"])
        expires_at = _now() + datetime.timedelta(days=plan["duration_days"])
        paid_at = _now()

        receipt_no = payment.get("receipt_number") or _receipt_number(ref)
        mode_label = "M-Pesa" if ps_result.get("channel") in ("mobile_money", "mpesa") or payment.get("channel") == "mobile_money" else "Card"

        update_fields = {
            "status": "paid",
            "paid_at": paid_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "receipt_number": receipt_no,
            "payment_mode": mode_label,
            "gateway_response": ps_result.get("gateway_response", ""),
            "updated_at": _now().isoformat(),
        }
        await _update_payment(payment["_id"], update_fields)

        # Audit activity
        await AxisDataStore.log_activity(
            owner_id=user_id,
            actor_id=user_id,
            actor_name=current_user.get("name", "Owner"),
            actor_role="Owner",
            action="billing.upgrade",
            details=f"Upgraded subscription to {plan['name']} (Ref: {ref}, Receipt: {receipt_no})",
            ip="127.0.0.1"
        )

        try:
            await AxisDataStore.record_admin_notification(
                title=f"{plan['name']} Subscription Activated",
                message=f"User {current_user.get('name', 'Owner')} ({payment.get('user_email', '')}) activated {plan['name']} (KES {payment.get('amount_kes', 0):,}) via {mode_label}.",
                notif_type="success",
                meta={"user_id": user_id, "plan": plan_key, "amount_kes": payment.get("amount_kes"), "ref": ref}
            )
        except Exception:
            pass

        # Dispatch user in-app notification & official email receipt
        await _dispatch_upgrade_receipt_and_notification(
            user_id=user_id,
            user_email=payment.get("user_email") or current_user.get("email", ""),
            user_name=payment.get("user_name") or current_user.get("name", "Valued Client"),
            plan_key=plan_key,
            amount_kes=int(payment.get("amount_kes", 0)),
            reference=ref,
            receipt_number=receipt_no,
            payment_mode=mode_label,
            paid_at=paid_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            expires_at=expires_at.strftime("%Y-%m-%d"),
        )

        sub = await get_user_subscription(user_id)
        return {
            "status": "success",
            "message": f"Congratulations! Your {plan['name']} subscription is now active.",
            "data": sub
        }

    elif ps_result["status"] == "failed":
        reason = ps_result.get("gateway_response") or "Payment was cancelled or failed."
        await _update_payment(payment["_id"], {
            "status": "failed",
            "failure_reason": reason,
            "gateway_response": ps_result.get("gateway_response", ""),
            "updated_at": _now().isoformat(),
        })
        return {
            "status": "failed",
            "message": reason,
            "gateway_response": ps_result.get("gateway_response", ""),
            "data": {
                "reference": ref,
                "status": "failed",
                "failure_reason": reason
            }
        }

    else:
        # Check if transaction has timed out by age (> 2 minutes for mobile money, 15 min for card)
        created_at_dt = None
        if payment.get("created_at"):
            try:
                created_at_dt = datetime.datetime.fromisoformat(payment["created_at"].replace("Z", "+00:00"))
            except Exception:
                pass

        is_stk = payment.get("channel") == "mobile_money"
        max_age_secs = 120 if is_stk else 900
        if created_at_dt and (_now() - created_at_dt).total_seconds() > max_age_secs:
            timeout_msg = "M-Pesa STK prompt timed out. No response received from phone." if is_stk else "Payment session expired."
            await _update_payment(payment["_id"], {
                "status": "failed",
                "failure_reason": timeout_msg,
                "gateway_response": "Timed out",
                "updated_at": _now().isoformat(),
            })
            return {
                "status": "failed",
                "message": timeout_msg,
                "gateway_response": "Timed out",
                "data": {
                    "reference": ref,
                    "status": "failed",
                    "failure_reason": timeout_msg
                }
            }

        return {
            "status": "pending",
            "message": "Payment is awaiting confirmation on your mobile phone.",
            "data": {
                "reference": ref,
                "status": "pending"
            }
        }


@router.post("/cancel")
async def cancel_pending_payment(
    body: VerifyPaymentReq,
    current_user: dict = Depends(get_current_user)
):
    """Allows user to cancel a pending STK prompt or card payment."""
    ref = body.reference.strip()
    payment = await _find_payment_by_ref(ref)
    if not payment:
        raise HTTPException(404, "Payment reference not found.")

    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    if payment.get("user_id") != user_id:
        raise HTTPException(403, "Payment belongs to another account.")

    if payment.get("status") == "paid":
        raise HTTPException(400, "Cannot cancel an already completed payment.")

    await _update_payment(payment["_id"], {
        "status": "cancelled",
        "failure_reason": "Prompt cancelled by user.",
        "updated_at": _now().isoformat()
    })
    return {
        "status": "success",
        "message": "Payment prompt cancelled.",
        "data": {
            "reference": ref,
            "status": "cancelled"
        }
    }


@router.post("/till-submit")
async def submit_till_payment(
    body: TillSubmitReq,
    current_user: dict = Depends(get_current_user)
):
    """User submits manual M-Pesa Till reference for administrator approval."""
    ref = body.reference.strip().upper()
    if not ref:
        raise HTTPException(400, "M-Pesa transaction reference code is required.")

    plan_key = body.plan.lower().strip()
    if plan_key not in ("starter", "pro"):
        raise HTTPException(400, "Invalid plan. Choose 'starter' or 'pro'.")

    plan = PLANS[plan_key]
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    user_email = current_user.get("email", "")
    user_name = current_user.get("name", "Axis User")

    amount_kes = plan["amount_kes"]

    # Prevent duplicate reference submission
    existing = await _find_payment_by_ref(ref)
    if existing:
        raise HTTPException(409, f"A submission with M-Pesa reference '{ref}' already exists.")

    doc = {
        "user_id": user_id,
        "user_name": user_name,
        "user_email": user_email,
        "plan": plan_key,
        "amount_kes": amount_kes,
        "fee_kes": 0.0,  # No Paystack gateway fee for direct Till payments
        "net_kes": float(amount_kes),
        "currency": "KES",
        "channel": "till",
        "status": "pending",
        "provider": "mpesa_till",
        "reference": ref,
        "receipt_number": _receipt_number(ref),
        "phone": body.phone or "",
        "description": f"{plan['name']} via M-Pesa Till {MPESA_TILL}",
        "expires_at": None,
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    }
    pid = await _insert_payment(doc)

    try:
        await AxisDataStore.record_admin_notification(
            title="Manual M-Pesa Till Submission",
            message=f"{user_name} ({user_email}) submitted Till reference {ref} for {plan['name']} (KES {amount_kes:,}). Review required.",
            notif_type="warning",
            meta={"payment_id": pid, "reference": ref, "plan": plan_key, "amount_kes": amount_kes}
        )
    except Exception:
        pass

    return {
        "status": "success",
        "payment_id": pid,
        "reference": ref,
        "message": f"M-Pesa reference {ref} submitted successfully. Our team will verify and activate your {plan['name']} plan shortly.",
    }


@router.post("/webhook/paystack")
async def paystack_webhook(request: Request, background_tasks: BackgroundTasks):
    """Paystack webhook handler for automatic charge.success events."""
    body_bytes = await request.body()
    sig = request.headers.get("x-paystack-signature", "")

    if PAYSTACK_SECRET:
        expected = hmac.new(PAYSTACK_SECRET.encode(), body_bytes, hashlib.sha512).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(400, "Invalid webhook signature")

    try:
        event = json.loads(body_bytes)
    except Exception:
        return {"received": True}

    if event.get("event") == "charge.success":
        data = event.get("data", {})
        ref = data.get("reference")
        if ref:
            payment = await _find_payment_by_ref(ref)
            if payment and payment.get("status") != "paid":
                plan_key = payment.get("plan", "starter")
                plan = PLANS.get(plan_key, PLANS["starter"])
                expires_at = _now() + datetime.timedelta(days=plan["duration_days"])
                receipt_no = payment.get("receipt_number") or _receipt_number(ref)
                channel = data.get("channel") or payment.get("channel")
                mode_label = "M-Pesa" if channel in ("mobile_money", "mpesa") else "Card"

                await _update_payment(payment["_id"], {
                    "status": "paid",
                    "paid_at": _now().isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "receipt_number": receipt_no,
                    "payment_mode": mode_label,
                    "updated_at": _now().isoformat(),
                })

                try:
                    await AxisDataStore.record_admin_notification(
                        title=f"{plan['name']} Subscription Activated",
                        message=f"User {payment.get('user_name', 'Customer')} ({payment.get('user_email', '')}) activated {plan['name']} (KES {payment.get('amount_kes', 0):,}) via Paystack Webhook ({mode_label}).",
                        notif_type="success",
                        meta={"payment_id": str(payment["_id"]), "reference": ref, "plan": plan_key}
                    )
                except Exception:
                    pass

                # Dispatch user in-app notification & official email receipt
                await _dispatch_upgrade_receipt_and_notification(
                    user_id=payment.get("user_id", ""),
                    user_email=payment.get("user_email", ""),
                    user_name=payment.get("user_name", "Valued Client"),
                    plan_key=plan_key,
                    amount_kes=int(payment.get("amount_kes", 0)),
                    reference=ref,
                    receipt_number=receipt_no,
                    payment_mode=mode_label,
                    paid_at=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                    expires_at=expires_at.strftime("%Y-%m-%d"),
                )

    return {"received": True}


@router.post("/extend-daily-limit")
async def extend_pro_daily_limit(
    body: ExtendLimitReq,
    current_user: dict = Depends(get_current_user)
):
    """
    Allows Pro tier users to extend their daily limit when reached:
      - Chat: doubles daily limit (+40 extra queries)
      - Voice: extends by a quarter (+7 extra queries)
    """
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    sub = await get_user_subscription(user_id)

    if sub["plan"] != "pro":
        raise HTTPException(403, "Daily limit extensions are exclusively available for Pro tier members.")

    today = _today_str()
    month = _month_str()
    key = f"{user_id}_{today}"
    kind = body.type.lower().strip()

    if kind == "voice":
        ext_field = "voice_extended"
        msg = "Voice agent daily quota extended by 7 queries for today."
    else:
        ext_field = "chat_extended"
        msg = "Axis Agent daily quota doubled (+40 queries) for today."

    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.usage.update_one(
            {"key": key},
            {
                "$set": {
                    "user_id": user_id,
                    "date": today,
                    "month": month,
                    ext_field: True
                }
            },
            upsert=True
        )
    else:
        store = db_manager.memory_store.setdefault("usage", {})
        if key not in store:
            store[key] = {
                "key": key,
                "user_id": user_id,
                "date": today,
                "month": month,
                "chat_count": 0,
                "voice_count": 0,
                "chat_extended": False,
                "voice_extended": False
            }
        store[key][ext_field] = True
        db_manager.save_memory_store()

    updated_sub = await get_user_subscription(user_id)
    return {
        "status": "success",
        "message": msg,
        "data": updated_sub
    }


# ── Administrator Platform Revenue & Management Endpoints ────────────────────

@router.get("/admin/stats")
async def get_admin_payment_stats(current_admin: dict = Depends(get_current_admin)):
    """Computes total gross, net platform revenue, Paystack fees, and plan distribution."""
    now = _now()
    today_prefix = now.strftime("%Y-%m-%d")
    week_start = now - datetime.timedelta(days=7)
    month_start = now - datetime.timedelta(days=30)

    payments = []
    if db_manager.is_connected and db_manager.db is not None:
        async for doc in db_manager.db.payments.find():
            doc["_id"] = str(doc["_id"])
            payments.append(doc)
    else:
        for p in db_manager.memory_store.get("payments", {}).values():
            payments.append(dict(p))

    paid_payments = [p for p in payments if p.get("status") == "paid"]
    pending_count = sum(1 for p in payments if p.get("status") == "pending")

    total_gross = sum(p.get("amount_kes", 0) for p in paid_payments)
    total_fees = sum(p.get("fee_kes", 0) for p in paid_payments)
    total_net = sum(p.get("net_kes", p.get("amount_kes", 0) - p.get("fee_kes", 0)) for p in paid_payments)

    # Time-windowed revenue
    revenue_today = 0
    revenue_week = 0
    revenue_month = 0

    active_starter = 0
    active_pro = 0
    plan_counts = {"starter": 0, "pro": 0, "free": 0}

    for p in paid_payments:
        created_str = p.get("created_at") or ""
        amt = p.get("amount_kes", 0)
        plan_k = p.get("plan", "starter")
        plan_counts[plan_k] = plan_counts.get(plan_k, 0) + 1

        # Check if active right now
        exp = p.get("expires_at")
        if exp:
            try:
                exp_dt = datetime.datetime.fromisoformat(exp.replace("Z", "+00:00"))
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=datetime.timezone.utc)
                if exp_dt > now:
                    if plan_k == "starter":
                        active_starter += 1
                    elif plan_k == "pro":
                        active_pro += 1
            except Exception:
                pass

        if created_str.startswith(today_prefix):
            revenue_today += amt

        try:
            created_dt = datetime.datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=datetime.timezone.utc)
            if created_dt >= week_start:
                revenue_week += amt
            if created_dt >= month_start:
                revenue_month += amt
        except Exception:
            pass

    return {
        "status": "success",
        "data": {
            "total_gross_kes": total_gross,
            "total_fees_kes": total_fees,
            "total_net_kes": total_net,
            "paid_count": len(paid_payments),
            "pending_count": pending_count,
            "active_starter": active_starter,
            "active_pro": active_pro,
            "plan_counts": plan_counts,
            "revenue_today_kes": revenue_today,
            "revenue_week_kes": revenue_week,
            "revenue_month_kes": revenue_month,
        }
    }


@router.get("/admin/list")
async def list_admin_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    plan: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    """Returns paginated payments with search and filtering for administrator inspection."""
    all_payments = []
    if db_manager.is_connected and db_manager.db is not None:
        async for doc in db_manager.db.payments.find().sort("created_at", -1):
            doc["_id"] = str(doc["_id"])
            all_payments.append(doc)
    else:
        for p in db_manager.memory_store.get("payments", {}).values():
            all_payments.append(dict(p))
        all_payments.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)

    # Filter
    filtered = []
    s = search.lower().strip()
    st = status.lower().strip()
    pl = plan.lower().strip()

    for p in all_payments:
        if st and p.get("status") != st:
            continue
        if pl and p.get("plan") != pl:
            continue
        if s:
            target = f"{p.get('user_name','')} {p.get('user_email','')} {p.get('reference','')} {p.get('receipt_number','')}".lower()
            if s not in target:
                continue
        filtered.append(p)

    total = len(filtered)
    start = (page - 1) * limit
    paginated = filtered[start:start + limit]

    return {
        "status": "success",
        "data": paginated,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": max(1, (total + limit - 1) // limit),
        }
    }


@router.post("/admin/{payment_id}/approve")
async def approve_admin_payment(
    payment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    """Admin approves a manual M-Pesa Till payment and immediately activates the plan."""
    payment = await _find_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(404, "Payment record not found.")

    plan_key = payment.get("plan", "starter")
    plan = PLANS.get(plan_key, PLANS["starter"])
    expires_at = _now() + datetime.timedelta(days=plan["duration_days"])
    paid_at = _now()

    receipt_no = payment.get("receipt_number") or _receipt_number(payment.get("reference", ""))

    await _update_payment(payment["_id"], {
        "status": "paid",
        "paid_at": paid_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "receipt_number": receipt_no,
        "payment_mode": "M-Pesa Till",
        "approved_by": current_admin.get("email"),
        "updated_at": _now().isoformat(),
    })

    try:
        await AxisDataStore.record_admin_notification(
            title=f"Till Payment Approved: {plan['name']}",
            message=f"Admin {current_admin.get('email')} approved {plan['name']} for {payment.get('user_email')} (Ref: {payment.get('reference')}).",
            notif_type="success",
            meta={"payment_id": payment_id, "approved_by": current_admin.get("email"), "plan": plan_key}
        )
    except Exception:
        pass

    # Dispatch user in-app notification & official email receipt
    await _dispatch_upgrade_receipt_and_notification(
        user_id=payment.get("user_id", ""),
        user_email=payment.get("user_email", ""),
        user_name=payment.get("user_name", "Valued Client"),
        plan_key=plan_key,
        amount_kes=int(payment.get("amount_kes", 0)),
        reference=payment.get("reference", ""),
        receipt_number=receipt_no,
        payment_mode="M-Pesa Till",
        paid_at=paid_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
        expires_at=expires_at.strftime("%Y-%m-%d"),
    )

    return {
        "status": "success",
        "message": f"Payment approved. {plan['name']} plan activated for {payment.get('user_email')} until {expires_at.strftime('%Y-%m-%d')}."
    }


@router.post("/admin/{payment_id}/reject")
async def reject_admin_payment(
    payment_id: str,
    body: dict = {},
    current_admin: dict = Depends(get_current_admin)
):
    payment = await _find_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(404, "Payment record not found.")

    await _update_payment(payment["_id"], {
        "status": "rejected",
        "notes": body.get("reason", "Rejected by administrator"),
        "updated_at": _now().isoformat(),
    })
    return {"status": "success", "message": "Payment rejected."}


@router.post("/admin/{payment_id}/revoke")
async def revoke_admin_payment(
    payment_id: str,
    body: dict = {},
    current_admin: dict = Depends(get_current_admin)
):
    """Revokes active subscription immediately."""
    payment = await _find_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(404, "Payment record not found.")

    await _update_payment(payment["_id"], {
        "status": "cancelled",
        "expires_at": _now().isoformat(),
        "notes": body.get("reason", "Revoked by administrator"),
        "updated_at": _now().isoformat(),
    })
    return {"status": "success", "message": "Subscription cancelled and expired."}


@router.post("/admin/assign")
async def assign_user_plan(
    body: AssignPlanReq,
    current_admin: dict = Depends(get_current_admin)
):
    """Admin manually provisions a Starter or Pro package to any registered user."""
    plan_key = body.plan.lower().strip()
    if plan_key not in ("starter", "pro"):
        raise HTTPException(400, "Invalid plan. Choose 'starter' or 'pro'.")

    # Look up user
    user = None
    if db_manager.is_connected and db_manager.db is not None:
        user = await db_manager.db.users.find_one({"$or": [{"user_id": body.user_id}, {"id": body.user_id}, {"email": body.user_id}]})
    else:
        for u in db_manager.memory_store.get("users", {}).values():
            if u.get("user_id") == body.user_id or u.get("id") == body.user_id or u.get("email") == body.user_id:
                user = u
                break

    if not user:
        raise HTTPException(404, f"User '{body.user_id}' not found.")

    target_uid = user.get("user_id") or user.get("id") or str(user.get("_id", ""))
    plan = PLANS[plan_key]
    ref = f"ADMIN-{uuid.uuid4().hex[:8].upper()}"
    expires_at = _now() + datetime.timedelta(days=plan["duration_days"])

    doc = {
        "user_id": target_uid,
        "user_name": user.get("name", "User"),
        "user_email": user.get("email", ""),
        "plan": plan_key,
        "amount_kes": plan["amount_kes"],
        "fee_kes": 0.0,
        "net_kes": float(plan["amount_kes"]),
        "currency": "KES",
        "channel": "manual",
        "status": "paid",
        "provider": "admin_provisioned",
        "reference": ref,
        "receipt_number": _receipt_number(ref),
        "payment_mode": "Admin Assignment",
        "description": f"Manual {plan['name']} assignment by {current_admin.get('email')}",
        "notes": body.notes,
        "paid_at": _now().isoformat(),
        "expires_at": expires_at.isoformat(),
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    }
    pid = await _insert_payment(doc)

    # Dispatch user in-app notification & official email receipt
    await _dispatch_upgrade_receipt_and_notification(
        user_id=target_uid,
        user_email=user.get("email", ""),
        user_name=user.get("name", "Valued Client"),
        plan_key=plan_key,
        amount_kes=int(plan["amount_kes"]),
        reference=ref,
        receipt_number=doc["receipt_number"],
        payment_mode="Admin Assignment",
        paid_at=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        expires_at=expires_at.strftime("%Y-%m-%d"),
    )

    return {
        "status": "success",
        "payment_id": pid,
        "message": f"Successfully assigned {plan['name']} to {user.get('email')} valid until {expires_at.strftime('%Y-%m-%d')}."
    }


@router.delete("/admin/{payment_id}")
async def delete_admin_payment(
    payment_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    payment = await _find_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(404, "Payment record not found.")

    if db_manager.is_connected and db_manager.db is not None:
        try:
            await db_manager.db.payments.delete_one({"_id": ObjectId(payment_id)})
        except Exception:
            await db_manager.db.payments.delete_one({"_id": payment_id})
    if "payments" in db_manager.memory_store and payment_id in db_manager.memory_store["payments"]:
        del db_manager.memory_store["payments"][payment_id]
        db_manager.save_memory_store()

    return {"status": "success", "message": "Payment record deleted."}


# ── Dedicated Admin Payments Router (Matches REINO FORMS admin client: /api/admin/payments) ──
admin_payments_router = APIRouter(prefix="/api/admin/payments", tags=["Admin Payments & Platform Revenue"])

@admin_payments_router.get("")
@admin_payments_router.get("/")
async def admin_list_payments_direct(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=5000),
    search: str = Query(""),
    status: str = Query(""),
    plan: str = Query(""),
    current_admin: dict = Depends(get_current_admin)
):
    return await list_admin_payments(page=page, limit=limit, search=search, status=status, plan=plan, current_admin=current_admin)

@admin_payments_router.get("/stats")
async def admin_stats_direct(current_admin: dict = Depends(get_current_admin)):
    return await get_admin_payment_stats(current_admin=current_admin)

@admin_payments_router.post("/assign")
async def admin_assign_direct(body: AssignPlanReq, current_admin: dict = Depends(get_current_admin)):
    return await assign_user_plan(body=body, current_admin=current_admin)

@admin_payments_router.post("/{payment_id}/approve")
async def admin_approve_direct(payment_id: str, current_admin: dict = Depends(get_current_admin)):
    return await approve_admin_payment(payment_id=payment_id, current_admin=current_admin)

@admin_payments_router.post("/{payment_id}/reject")
async def admin_reject_direct(payment_id: str, body: dict = {}, current_admin: dict = Depends(get_current_admin)):
    return await reject_admin_payment(payment_id=payment_id, body=body, current_admin=current_admin)

@admin_payments_router.post("/{payment_id}/revoke")
async def admin_revoke_direct(payment_id: str, body: dict = {}, current_admin: dict = Depends(get_current_admin)):
    return await revoke_admin_payment(payment_id=payment_id, body=body, current_admin=current_admin)

@admin_payments_router.delete("/{payment_id}")
async def admin_delete_direct(payment_id: str, current_admin: dict = Depends(get_current_admin)):
    return await delete_admin_payment(payment_id=payment_id, current_admin=current_admin)


import asyncio
import datetime
import logging
from typing import Dict, Any, Optional, List
from app.database import db_manager, AxisDataStore
from app.services.sms_service import send_sms_async
from app.services.email_service import send_business_summary_email

logger = logging.getLogger("axisblack.scheduler")

# Track dispatched notifications to avoid multiple triggers on same day
_dispatched_cache: Dict[str, str] = {}
_scheduler_task: Optional[asyncio.Task] = None


async def dispatch_user_summary_notification(
    user_doc: dict,
    custom_override: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Dispatches a real business summary notification across the activated delivery modes (in_app, email, sms).
    Only channels explicitly set to True will receive the dispatch.
    """
    user_id = user_doc.get("user_id") or user_doc.get("id") or user_doc.get("email", "")
    owner_id = user_doc.get("owner_id") if user_doc.get("is_sub_user") else user_id
    business_name = user_doc.get("company") or "My Business"
    user_email = user_doc.get("email", "")

    notif_settings = dict(user_doc.get("notification_settings") or {})
    if custom_override:
        notif_settings.update({k: v for k, v in custom_override.items() if v is not None})

    channels = notif_settings.get("channels") or {"in_app": True, "email": False, "sms": False}
    freq = notif_settings.get("frequency", "daily")

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

    # 1. In-App Notification
    if channels.get("in_app") is True:
        try:
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
        except Exception as e:
            logger.error(f"In-app notification delivery error: {e}")
            results["channels"]["in_app"] = {"success": False, "error": str(e)}

    # 2. Email Dispatch
    if channels.get("email") is True:
        email_mode = notif_settings.get("email_mode", "profile")
        target_email = notif_settings.get("custom_email") if email_mode == "custom" and notif_settings.get("custom_email") else user_email
        if target_email:
            try:
                email_sent = send_business_summary_email(
                    to_email=target_email,
                    business_name=business_name,
                    summary_data=summary_data
                )
                results["channels"]["email"] = {"success": email_sent, "recipient": target_email}
            except Exception as e:
                logger.error(f"Email delivery error to {target_email}: {e}")
                results["channels"]["email"] = {"success": False, "error": str(e)}
        else:
            results["channels"]["email"] = {"success": False, "error": "No email address configured"}

    # 3. SMS Dispatch via TalkSasa
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
            try:
                sms_res = await send_sms_async(phone=phone_number, message=sms_body)
                results["channels"]["sms"] = sms_res
            except Exception as e:
                logger.error(f"SMS delivery error to {phone_number}: {e}")
                results["channels"]["sms"] = {"success": False, "error": str(e)}
        else:
            results["channels"]["sms"] = {"success": False, "error": "No phone number provided"}

    # Record dispatch timestamp in user record
    try:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        notif_settings["last_dispatched_at"] = now_iso
        user_doc["notification_settings"] = notif_settings

        if db_manager.is_connected and db_manager.db is not None:
            await db_manager.db["users"].update_one(
                {"$or": [{"user_id": user_id}, {"email": user_email}]},
                {"$set": {"notification_settings": notif_settings}}
            )
        else:
            db_manager.memory_store.setdefault("users", {})[user_id] = user_doc
            db_manager.save_memory_store()
    except Exception as e:
        logger.warning(f"Could not persist last_dispatched_at for user {user_id}: {e}")

    return results


async def get_all_active_users() -> List[dict]:
    """Retrieve all non-deleted, active users."""
    users = []
    try:
        if db_manager.is_connected and db_manager.db is not None:
            cursor = db_manager.db["users"].find({
                "is_deleted": {"$ne": True},
                "is_active": {"$ne": False},
                "status": {"$ne": "suspended"}
            })
            async for doc in cursor:
                users.append(doc)
        else:
            for u in db_manager.memory_store.get("users", {}).values():
                if not u.get("is_deleted") and u.get("is_active", True) and u.get("status") != "suspended":
                    users.append(u)
    except Exception as e:
        logger.error(f"Error fetching active users for scheduler: {e}")
    return users


async def run_business_summary_cron_cycle():
    """
    Checks active users and dispatches business summaries at 6:00 PM (18:00 local time).
    Honors user delivery frequency:
    - daily: Dispatched daily at 18:00.
    - weekly: Dispatched on Sundays at 18:00.
    - monthly: Dispatched on the 1st of each month at 18:00.
    """
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_hour = now.hour

    # Business summaries are scheduled for 6:00 PM (18:00)
    if current_hour != 18:
        return

    active_users = await get_all_active_users()
    for user in active_users:
        user_id = user.get("user_id") or user.get("id") or user.get("email")
        if not user_id:
            continue

        cache_key = f"{user_id}:{today_str}"
        if cache_key in _dispatched_cache:
            continue

        notif_settings = user.get("notification_settings") or {}
        if not notif_settings.get("enabled", True):
            continue

        channels = notif_settings.get("channels") or {}
        if not any(channels.values()):
            continue

        frequency = notif_settings.get("frequency", "daily").lower()

        # Check frequency criteria
        should_send = False
        if frequency == "daily":
            should_send = True
        elif frequency == "weekly":
            # Sunday is weekday 6
            if now.weekday() == 6:
                should_send = True
        elif frequency == "monthly":
            # 1st day of month
            if now.day == 1:
                should_send = True
        else:
            should_send = True

        if should_send:
            _dispatched_cache[cache_key] = now.isoformat()
            logger.info(f"[CRON 6:00 PM] Dispatched business summary for user: {user_id} ({frequency})")
            asyncio.create_task(dispatch_user_summary_notification(user))


async def summary_scheduler_loop():
    """Background worker running every 60 seconds to inspect scheduled summary dispatches."""
    logger.info("Axis Black Business Summary Scheduler started (monitoring for 6:00 PM dispatches).")
    while True:
        try:
            await run_business_summary_cron_cycle()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in summary_scheduler_loop: {e}")
        await asyncio.sleep(60)


def start_scheduler():
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(summary_scheduler_loop())


def stop_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()

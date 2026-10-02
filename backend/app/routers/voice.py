import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from app.config import settings
from app.auth.dependencies import get_current_user, get_optional_current_user
from app.routers.payments import get_user_subscription, record_usage

router = APIRouter(prefix="/api/voice", tags=["Voice Support Agent"])
logger = logging.getLogger("axis.voice")

PLATFORM_GUIDE_KNOWLEDGE = {
    "dashboard": {
        "name": "Executive Dashboard",
        "route": "dashboard",
        "description": "Provides real-time visibility into total portfolio yield, ARR growth, liquidity turnover, server telemetry, and live AI advisory alerts."
    },
    "transactions": {
        "name": "Ledger",
        "route": "transactions",
        "description": "View, record, filter, and audit expenses and revenues across accounts. Allows manual entry or instant voice logging."
    },
    "inventory": {
        "name": "Inventory & Asset Warehouse",
        "route": "inventory",
        "description": "Tracks stock levels, valuation metrics, inventory turnover rates, low-stock warnings, and reorder triggers."
    },
    "analytics": {
        "name": "Business Analytics & Intelligence",
        "route": "analytics",
        "description": "Deep cash flow analytics, burn rate variance, profit margins, tax-loss harvesting recommendations, and vendor spend audits."
    },
    "runway_simulator": {
        "name": "Cash Runway & Hiring Scenario Simulator",
        "route": "forecast",
        "description": "Simulate hiring software engineers, major capital expenditure, or revenue drops to model cash runway in months."
    },
    "agent": {
        "name": "Axis AI Advisory Agent",
        "route": "agent",
        "description": "Interactive AI intelligence stream, custom financial prompts, strategic planning templates, and voice support."
    },
    "settings": {
        "name": "Platform Settings & Preferences",
        "route": "settings",
        "description": "Customize currency display preferences (USD, KSH, EUR, GBP), security credentials, profile information, and system notifications."
    }
}

@router.get("/config")
async def get_voice_config(current_user: dict = Depends(get_optional_current_user)):
    """
    Get ElevenLabs Agent ID, subscription entitlements, and Axis Black Platform knowledge guide.
    """
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id", "usr_guest")
    sub = await get_user_subscription(user_id) if user_id != "usr_guest" else {"plan": "free", "entitlements": {"voice_agent": False}}

    has_agent_id = bool(settings.ELEVENLABS_AGENT_ID)
    has_api_key = bool(settings.ELEVENLABS_API_KEY)
    
    return {
        "status": "success",
        "agent_id": settings.ELEVENLABS_AGENT_ID if has_agent_id else None,
        "is_configured": has_agent_id and has_api_key,
        "is_entitled": bool(sub.get("entitlements", {}).get("voice_agent")),
        "plan": sub.get("plan", "free"),
        "platform_knowledge": PLATFORM_GUIDE_KNOWLEDGE,
        "capabilities": [
            "Platform Navigation & Feature Walkthroughs",
            "Voice-Activated Transaction Guidance",
            "Burn Rate & Cash Runway Explanations",
            "Inventory & Asset Telemetry Guidance"
        ]
    }

@router.get("/signed-url")
async def get_elevenlabs_signed_url(current_user: dict = Depends(get_current_user)):
    """
    Fetches a secure, temporary signed WebSocket URL from ElevenLabs for the voice agent.
    Requires Starter or Pro tier subscription.
    """
    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id")
    sub = await get_user_subscription(user_id)

    if not sub.get("entitlements", {}).get("voice_agent"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The Axis Voice Support Agent is an exclusive feature of the Starter and Pro packages. Upgrade to unlock interactive voice intelligence."
        )

    voice_usage = sub.get("usage", {}).get("voice_agent", {})
    daily_used = voice_usage.get("used_today", 0)
    daily_limit = voice_usage.get("daily_limit", 13)
    monthly_used = voice_usage.get("used_month", 0)
    monthly_limit = voice_usage.get("monthly_limit", 400)
    can_extend = voice_usage.get("can_extend", False)

    if daily_used >= daily_limit:
        extend_hint = " As a Pro member, you can extend your daily limit by 7 extra queries in Billing." if can_extend else " Upgrade to Pro for higher daily voice exchange capacity."
        raise HTTPException(
            status_code=429,
            detail=f"Daily Voice Agent exchange limit reached ({daily_used}/{daily_limit} on {sub.get('name')}).{extend_hint} Quota resets at midnight UTC."
        )

    if monthly_used >= monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly Voice Agent exchange limit reached ({monthly_used}/{monthly_limit} on {sub.get('name')}). Upgrade to Pro for 800 monthly voice exchanges."
        )

    # Record voice usage
    await record_usage(user_id, "voice")

    if not settings.ELEVENLABS_AGENT_ID or not settings.ELEVENLABS_API_KEY:
        return {
            "status": "unconfigured",
            "signed_url": None,
            "agent_id": settings.ELEVENLABS_AGENT_ID or None,
            "quota": {
                "used_today": daily_used + 1,
                "daily_limit": daily_limit,
                "used_month": monthly_used + 1,
                "monthly_limit": monthly_limit
            }
        }

    try:
        url = f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={settings.ELEVENLABS_AGENT_ID}"
        headers = {"xi-api-key": settings.ELEVENLABS_API_KEY}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "success",
                    "signed_url": data.get("signed_url"),
                    "agent_id": settings.ELEVENLABS_AGENT_ID,
                    "quota": {
                        "used_today": daily_used + 1,
                        "daily_limit": daily_limit,
                        "used_month": monthly_used + 1,
                        "monthly_limit": monthly_limit
                    }
                }
            else:
                logger.warning(f"Voice signed URL fetch returned {resp.status_code} — falling back to public agent ID")
                return {
                    "status": "fallback",
                    "signed_url": None,
                    "agent_id": settings.ELEVENLABS_AGENT_ID,
                    "quota": {
                        "used_today": daily_used + 1,
                        "daily_limit": daily_limit,
                        "used_month": monthly_used + 1,
                        "monthly_limit": monthly_limit
                    }
                }
    except Exception as e:
        logger.warning(f"Voice signed URL fetch failed: {str(e)} — falling back to public agent ID")
        return {
            "status": "fallback",
            "signed_url": None,
            "agent_id": settings.ELEVENLABS_AGENT_ID,
            "quota": {
                "used_today": daily_used + 1,
                "daily_limit": daily_limit,
                "used_month": monthly_used + 1,
                "monthly_limit": monthly_limit
            }
        }



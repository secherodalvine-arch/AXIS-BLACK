import logging
from fastapi import APIRouter
from app.config import settings

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
async def get_voice_config():
    """
    Get ElevenLabs Agent ID and Axis Black Platform knowledge guide.
    """
    has_agent_id = bool(settings.ELEVENLABS_AGENT_ID)
    has_api_key = bool(settings.ELEVENLABS_API_KEY)
    
    return {
        "status": "success",
        "agent_id": settings.ELEVENLABS_AGENT_ID if has_agent_id else None,
        "is_configured": has_agent_id and has_api_key,
        "platform_knowledge": PLATFORM_GUIDE_KNOWLEDGE,
        "capabilities": [
            "Platform Navigation & Feature Walkthroughs",
            "Voice-Activated Transaction Guidance",
            "Burn Rate & Cash Runway Explanations",
            "Inventory & Asset Telemetry Guidance"
        ]
    }

@router.get("/signed-url")
async def get_elevenlabs_signed_url():
    """
    Returns the voice agent ID for the frontend widget.
    The widget uses the public agent ID directly — no signed URL required.
    """
    return {
        "status": "success",
        "signed_url": None,
        "agent_id": settings.ELEVENLABS_AGENT_ID or None
    }


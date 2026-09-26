import logging
import httpx
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
        "name": "Multi-Currency Ledger",
        "route": "transactions",
        "description": "View, record, filter, and audit expenses and revenues across USD, KSh, EUR, and GBP. Allows manual entry or instant voice logging."
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
    Generate a secure, temporary WebSocket URL for ElevenLabs Conversational AI Agent.
    This prevents exposing private ElevenLabs API key on the frontend.
    """
    if not settings.ELEVENLABS_AGENT_ID or not settings.ELEVENLABS_API_KEY:
        return {
            "status": "unconfigured",
            "message": "ElevenLabs ELEVENLABS_AGENT_ID or ELEVENLABS_API_KEY is not set in backend environment variables.",
            "signed_url": None,
            "agent_id": settings.ELEVENLABS_AGENT_ID or None
        }

    try:
        url = f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={settings.ELEVENLABS_AGENT_ID}"
        headers = {
            "xi-api-key": settings.ELEVENLABS_API_KEY
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "success",
                    "signed_url": data.get("signed_url"),
                    "agent_id": settings.ELEVENLABS_AGENT_ID
                }
            else:
                logger.error(f"ElevenLabs signed URL error {resp.status_code}: {resp.text}")
                return {
                    "status": "error",
                    "message": f"ElevenLabs API error: {resp.status_code}",
                    "signed_url": None,
                    "agent_id": settings.ELEVENLABS_AGENT_ID
                }
    except Exception as e:
        logger.exception("Failed to fetch ElevenLabs signed URL")
        return {
            "status": "error",
            "message": f"Exception occurred: {str(e)}",
            "signed_url": None,
            "agent_id": settings.ELEVENLABS_AGENT_ID
        }


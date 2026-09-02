import re
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.config import settings
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user

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

class VoiceProcessRequest(BaseModel):
    transcript: str
    active_tab: Optional[str] = "dashboard"

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
            "Voice-Activated Transaction Logging",
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

@router.post("/process", response_model=Dict[str, Any])
async def process_voice_command(
    payload: VoiceProcessRequest,
    current_user: Any = Depends(get_current_user)
):
    text = payload.transcript.lower().strip()
    if not isinstance(current_user, dict):
        current_user = {"user_id": "test_user_id"}
    user_id = current_user.get("user_id", "test_user_id")

    # 1. Navigation & Support Queries
    if any(k in text for k in ["how do i navigate", "where is", "show me", "take me to", "open", "what is"]):
        target_tab = None
        guide_msg = ""

        if any(k in text for k in ["dashboard", "home", "overview"]):
            target_tab = "dashboard"
            guide_msg = "The Executive Dashboard displays your top financial metrics, revenue velocity, live AI insights, and system performance telemetry."
        elif any(k in text for k in ["transaction", "ledger", "expense", "revenue"]):
            target_tab = "transactions"
            guide_msg = "The Multi-Currency Ledger lets you track all company revenue and expenses, search entries, and record new transactions."
        elif any(k in text for k in ["inventory", "stock", "warehouse", "asset"]):
            target_tab = "inventory"
            guide_msg = "Inventory view tracks warehouse stock, turnover ratios, asset valuations, and automated reorder alerts."
        elif any(k in text for k in ["analytics", "chart", "burn rate", "tax", "report"]):
            target_tab = "analytics"
            guide_msg = "Business Analytics provides deep cash flow analysis, margin variance, SaaS audit logs, and tax optimization recommendations."
        elif any(k in text for k in ["runway", "simulator", "forecast", "hiring", "scenario"]):
            target_tab = "forecast"
            guide_msg = "The Runway Simulator lets you model hiring engineering teams, capital expenses, or market drops to project cash runway in months."
        elif any(k in text for k in ["agent", "ai", "advisor", "intelligence"]):
            target_tab = "agent"
            guide_msg = "Axis Agent Workspace is your AI business intelligence co-pilot for automated strategy, spend audits, and voice command actions."
        elif any(k in text for k in ["settings", "currency", "profile", "password"]):
            target_tab = "settings"
            guide_msg = "Settings lets you toggle base currencies (KSH, USD, EUR, GBP), update profile security, and configure notifications."

        if target_tab:
            return {
                "status": "navigation",
                "target_tab": target_tab,
                "spoken_response": guide_msg,
                "extracted_data": None
            }

    # 2. Extract Amount for Transaction Logging (e.g. 500 shillings, KSh 500, $500)
    amount_match = re.search(r'(\d+[\d,.]*)', text)
    amount = float(amount_match.group(1).replace(',', '')) if amount_match else 0.0
    
    # 3. Categorize expense/income based on keywords
    category = "other"
    txn_type = "expense"
    
    if any(k in text for k in ["lunch", "dinner", "breakfast", "food", "grocery", "groceries", "supper", "snack", "bread", "milk", "naivas", "carrefour"]):
        category = "food"
    elif any(k in text for k in ["matatu", "bus", "uber", "bolt", "cab", "fare", "fuel", "petrol", "diesel", "transport", "commute"]):
        category = "transport"
    elif any(k in text for k in ["rent", "house", "shelter", "mortgage"]):
        category = "shelter"
    elif any(k in text for k in ["token", "electricity", "water", "internet", "wifi", "kplc", "utility", "utilities"]):
        category = "utilities"
    elif any(k in text for k in ["movie", "game", "party", "drink", "fun", "entertainment", "club"]):
        category = "entertainment"
    elif any(k in text for k in ["school", "fee", "fees", "book", "tuition", "education"]):
        category = "education"
    elif any(k in text for k in ["hospital", "doctor", "medicine", "pharmacy", "clinic", "healthcare", "health"]):
        category = "healthcare"
    elif any(k in text for k in ["salary", "paid", "earned", "income", "received", "gift", "deposit"]):
        category = "income"
        txn_type = "income"

    # Extract title description
    title = payload.transcript.capitalize()
    
    if amount > 0:
        # Save transaction
        txn_doc = await AxisDataStore.add_transaction(user_id, {
            "counterparty": title,
            "amount": amount if txn_type == "income" else -amount,
            "category": category.capitalize(),
            "type": "Revenue" if txn_type == "income" else "Expense",
            "notes": f"Voice logged: {payload.transcript}"
        })
        
        spoken_response = f"Got it. Recorded {category.capitalize()} transaction of {amount:,.0f}."
        
        return {
            "status": "success",
            "extracted_data": {
                "amount": amount,
                "category": category,
                "type": txn_type,
                "title": title
            },
            "spoken_response": spoken_response,
            "transaction": txn_doc
        }
    else:
        return {
            "status": "support_response",
            "extracted_data": None,
            "spoken_response": f"Axis Voice Support here! I can guide you through the platform, explain features, or log transactions. How can I help you today?"
        }

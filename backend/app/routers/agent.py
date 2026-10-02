import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from app.agent.axis_agent import AxisAgent
from app.auth.dependencies import get_current_user, get_optional_current_user
from app.database import AxisDataStore, db_manager

router = APIRouter(prefix="/api/agent", tags=["Axis Agent"])

class AgentQueryRequest(BaseModel):
    query: str
    advisor_type: Optional[str] = None

class ChatMessageModel(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str
    suggestions: Optional[List[str]] = None

class ChatSessionSaveModel(BaseModel):
    id: str
    title: str
    timestamp: str
    messages: List[ChatMessageModel]

@router.post("/query", response_model=Dict[str, Any])
async def query_axis_agent(
    payload: AgentQueryRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    """
    Query Axis Agent powered by Gemini GenAI SDK.
    Processes business telemetry data and user strategic inquiries.
    """
    if current_user.get("is_sub_user"):
        perms = current_user.get("permissions") or []
        if "agent" not in perms:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Your assigned role does not have permission to consult Axis Agent."
            )

    user_id = current_user.get("owner_id") if current_user.get("is_sub_user") else current_user.get("user_id", "usr_guest")

    # Enforce Tier Usage Limits (Free: 8 daily / 240 mo; Starter: 20 daily / 600 mo; Pro: 40-80 daily / 1200 mo)
    from app.routers.payments import get_user_subscription, record_usage
    sub = await get_user_subscription(user_id)
    chat_usage = sub.get("usage", {}).get("axis_agent_chat", {})

    daily_used = chat_usage.get("used_today", 0)
    daily_limit = chat_usage.get("daily_limit", 8)
    monthly_used = chat_usage.get("used_month", 0)
    monthly_limit = chat_usage.get("monthly_limit", 240)
    plan_name = sub.get("name", "Free Tier")
    can_extend = chat_usage.get("can_extend", False)

    if daily_used >= daily_limit:
        extend_hint = " As a Pro member, you can double your daily limit by clicking 'Extend Daily Limit' in Billing." if can_extend else " Upgrade your package for higher daily capacity."
        raise HTTPException(
            status_code=429,
            detail=f"Daily Axis Agent query limit reached ({daily_used}/{daily_limit} on {plan_name}).{extend_hint} Quota resets at midnight UTC."
        )

    if monthly_used >= monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly Axis Agent query limit reached ({monthly_used}/{monthly_limit} on {plan_name}). Upgrade to Starter or Pro for expanded monthly exchanges."
        )

    metrics = await AxisDataStore.get_dashboard_metrics(user_id)
    txns = await AxisDataStore.get_transactions(user_id)
    inventory = await AxisDataStore.get_inventory(user_id)
    
    response = await AxisAgent.process_query(
        query=payload.query,
        context={
            "user": current_user,
            "metrics": metrics,
            "transactions": txns,
            "inventory": inventory
        },
        advisor_type=payload.advisor_type
    )

    # Record usage
    await record_usage(user_id, "chat")
    # Attach usage info to response
    response["quota"] = {
        "used_today": daily_used + 1,
        "daily_limit": daily_limit,
        "used_month": monthly_used + 1,
        "monthly_limit": monthly_limit,
        "plan": sub.get("plan", "free"),
        "can_extend": can_extend
    }
    return response


@router.get("/advisors/{advisor_type}", response_model=Dict[str, Any])
async def get_advisor_skill_telemetry(
    advisor_type: str,
    current_user: dict = Depends(get_optional_current_user)
):
    """
    Invoke subagent skill analysis for a specific "4 ADVISORS LIVE" skill (Financial, Inventory, Operations, Growth).
    """
    user_id = current_user.get("user_id", "default_user")
    metrics = await AxisDataStore.get_dashboard_metrics(user_id)
    
    skill = AxisAgent.skills.get(advisor_type.lower())
    if not skill:
        raise HTTPException(status_code=404, detail=f"Advisor subagent skill '{advisor_type}' not found.")

    target_metric = next((m for m in metrics if m.get("id") == advisor_type.lower()), metrics[0])
    return skill.analyze(target_metric, f"Telemetry check for {advisor_type}")

# ── MongoDB Chat Sessions CRUD Endpoints ──
@router.get("/sessions", response_model=List[Dict[str, Any]])
async def get_user_chat_sessions(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    if db_manager.is_connected and user_id:
        cursor = db_manager.db.chat_sessions.find({"user_id": user_id}).sort("updated_at", -1)
        sessions = await cursor.to_list(length=100)
        for s in sessions:
            s.pop("_id", None)
        if sessions:
            return sessions

    memory_sessions = db_manager.memory_store["copilot_chats"].get(user_id, [])
    return memory_sessions

@router.post("/sessions", response_model=Dict[str, Any])
async def save_user_chat_session(payload: ChatSessionSaveModel, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    session_data = payload.model_dump()
    session_data["user_id"] = user_id
    session_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if db_manager.is_connected and user_id:
        await db_manager.db.chat_sessions.update_one(
            {"id": payload.id, "user_id": user_id},
            {"$set": session_data},
            upsert=True
        )
    
    user_mem = db_manager.memory_store["copilot_chats"].setdefault(user_id, [])
    existing_idx = next((i for i, s in enumerate(user_mem) if s["id"] == payload.id), None)
    if existing_idx is not None:
        user_mem[existing_idx] = session_data
    else:
        user_mem.insert(0, session_data)
    db_manager.save_memory_store()

    return {"status": "saved", "session": session_data}

@router.delete("/sessions/{session_id}", response_model=Dict[str, Any])
async def delete_user_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    if db_manager.is_connected and user_id:
        await db_manager.db.chat_sessions.delete_one({"id": session_id, "user_id": user_id})

    user_mem = db_manager.memory_store["copilot_chats"].get(user_id, [])
    db_manager.memory_store["copilot_chats"][user_id] = [s for s in user_mem if s["id"] != session_id]
    db_manager.save_memory_store()

    return {"status": "deleted", "session_id": session_id}

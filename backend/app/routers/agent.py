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
    user_id = current_user.get("user_id", "usr_guest")
    metrics = await AxisDataStore.get_dashboard_metrics(user_id)
    
    response = await AxisAgent.process_query(
        query=payload.query,
        context={"user": current_user, "metrics": metrics},
        advisor_type=payload.advisor_type
    )
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

    return {"status": "saved", "session": session_data}

@router.delete("/sessions/{session_id}", response_model=Dict[str, Any])
async def delete_user_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    if db_manager.is_connected and user_id:
        await db_manager.db.chat_sessions.delete_one({"id": session_id, "user_id": user_id})

    user_mem = db_manager.memory_store["copilot_chats"].get(user_id, [])
    db_manager.memory_store["copilot_chats"][user_id] = [s for s in user_mem if s["id"] != session_id]

    return {"status": "deleted", "session_id": session_id}

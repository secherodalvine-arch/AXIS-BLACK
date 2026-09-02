from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Telemetry"])

@router.get("/metrics", response_model=List[Dict[str, Any]])
@router.get("/me", response_model=List[Dict[str, Any]])
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    """
    Get live dashboard metrics and advisor telemetry for current user from MongoDB.
    """
    return await AxisDataStore.get_dashboard_metrics(current_user.get("user_id", "default_user"))

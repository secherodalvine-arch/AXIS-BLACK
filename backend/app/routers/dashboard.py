from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Telemetry"])

@router.get("/metrics", response_model=List[Dict[str, Any]])
@router.get("/me", response_model=List[Dict[str, Any]])
async def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    """
    Get live dashboard metrics and advisor telemetry for current user or assigned branch.
    """
    is_sub_user = bool(current_user.get("is_sub_user"))
    if is_sub_user:
        perms = current_user.get("permissions") or []
        if "dashboard" not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Your assigned role does not have permission to view the dashboard."
            )

    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    branch_id = current_user.get("branch_id") if is_sub_user else None
    return await AxisDataStore.get_dashboard_metrics(owner_id, branch_id=branch_id)


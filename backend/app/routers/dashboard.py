from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Telemetry"])

from typing import List, Dict, Any, Optional

@router.get("/metrics", response_model=List[Dict[str, Any]])
@router.get("/me", response_model=List[Dict[str, Any]])
async def get_dashboard_data(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get live dashboard metrics and advisor telemetry for the business, with optional branch filter.
    """
    is_sub_user = bool(current_user.get("is_sub_user"))
    if is_sub_user:
        perms = current_user.get("permissions") or []
        if not any(p in perms for p in ["dashboard", "forecast", "analytics"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Your assigned role does not have permission to view the dashboard metrics."
            )

    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    if is_sub_user and current_user.get("branch_id"):
        target_branch = current_user.get("branch_id")
    else:
        target_branch = branch_id if (branch_id and branch_id.strip() and branch_id.upper() != "ALL") else None
    return await AxisDataStore.get_dashboard_metrics(owner_id, branch_id=target_branch)


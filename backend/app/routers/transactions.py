from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.models.transaction import TransactionCreate
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("/me", response_model=List[Dict[str, Any]])
async def get_user_transactions(current_user: dict = Depends(get_current_user)):
    return await AxisDataStore.get_transactions(current_user.get("user_id", "default_user"))

@router.post("/me", response_model=Dict[str, Any])
async def create_transaction(payload: TransactionCreate, current_user: dict = Depends(get_current_user)):
    return await AxisDataStore.add_transaction(current_user.get("user_id", "default_user"), payload.model_dump())

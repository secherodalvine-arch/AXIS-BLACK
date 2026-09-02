from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/inventory", tags=["Inventory Intelligence"])

class InventoryItemCreate(BaseModel):
    sku: str
    name: str
    category: str
    stock_quantity: int
    reorder_point: int
    unit_cost: float
    selling_price: float
    supplier: Optional[str] = "Global Supplier"

@router.get("/items", response_model=List[Dict[str, Any]])
async def get_inventory(current_user: dict = Depends(get_current_user)):
    """
    Get user inventory items from MongoDB with AI stock velocity analytics.
    """
    return await AxisDataStore.get_inventory(current_user.get("user_id", "default_user"))

@router.post("/items", response_model=Dict[str, Any])
async def create_inventory_item(
    payload: InventoryItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a new SKU inventory item to MongoDB.
    """
    user_id = current_user.get("user_id", "default_user")
    item_doc = await AxisDataStore.add_inventory_item(user_id, payload.model_dump())
    return {
        "status": "created",
        "item": item_doc
    }


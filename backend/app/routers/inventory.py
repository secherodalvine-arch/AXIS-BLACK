from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import csv
import io
import datetime
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
    branch_id: Optional[str] = None


@router.get("/items", response_model=List[Dict[str, Any]])
async def get_inventory(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user inventory items; filter by branch_id if provided."""
    items = await AxisDataStore.get_inventory(current_user.get("user_id", "default_user"))
    if branch_id:
        items = [i for i in items if i.get("branch_id") == branch_id]
    return items


@router.post("/items", response_model=Dict[str, Any])
async def create_inventory_item(
    payload: InventoryItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new SKU inventory item."""
    user_id = current_user.get("user_id", "default_user")
    item_doc = await AxisDataStore.add_inventory_item(user_id, payload.model_dump())
    return {"status": "created", "item": item_doc}


@router.post("/items/import-csv", response_model=Dict[str, Any])
async def import_inventory_csv(
    file: UploadFile = File(...),
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk import inventory from CSV.
    Expected columns: sku, name, category, stock_quantity, reorder_point, unit_cost, selling_price, supplier
    """
    user_id = current_user.get("user_id", "default_user")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    imported = []
    errors = []

    for i, row in enumerate(reader):
        try:
            item = {
                "sku": row.get("sku", row.get("SKU", f"SKU-{i+1}")),
                "name": row.get("name", row.get("Name", row.get("Item Name", "Unknown"))),
                "category": row.get("category", row.get("Category", "General")),
                "stock_quantity": int(float(row.get("stock_quantity", row.get("Stock Qty", row.get("Quantity", 0))))),
                "reorder_point": int(float(row.get("reorder_point", row.get("Reorder Point", 10)))),
                "unit_cost": float(str(row.get("unit_cost", row.get("Unit Cost", row.get("Cost", 0)))).replace(",", "").replace("$", "")),
                "selling_price": float(str(row.get("selling_price", row.get("Selling Price", row.get("Price", 0)))).replace(",", "").replace("$", "")),
                "supplier": row.get("supplier", row.get("Supplier", "Unknown Supplier")),
                "branch_id": branch_id or row.get("branch_id", row.get("Branch ID", None)),
            }
            result = await AxisDataStore.add_inventory_item(user_id, item)
            imported.append(result)
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})

    return {
        "status": "complete",
        "imported": len(imported),
        "errors": errors,
        "message": f"Successfully imported {len(imported)} items" + (f", {len(errors)} rows had errors" if errors else "")
    }

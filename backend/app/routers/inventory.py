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


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Optional[int] = None
    reorder_point: Optional[int] = None
    unit_cost: Optional[float] = None
    selling_price: Optional[float] = None
    supplier: Optional[str] = None
    branch_id: Optional[str] = None


@router.get("/items", response_model=List[Dict[str, Any]])
async def get_inventory(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get inventory items. If team member is assigned a branch, restrict to that branch only."""
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    if is_sub_user and current_user.get("branch_id"):
        target_branch = current_user.get("branch_id")
    else:
        target_branch = branch_id

    items = await AxisDataStore.get_inventory(owner_id)
    if target_branch:
        items = [i for i in items if i.get("branch_id") == target_branch]
    return items


@router.post("/items", response_model=Dict[str, Any])
async def create_inventory_item(
    payload: InventoryItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new SKU inventory item."""
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    data = payload.model_dump()

    # Sub-users don't have to select a branch — locked to their assigned branch automatically
    if is_sub_user and current_user.get("branch_id"):
        data["branch_id"] = current_user.get("branch_id")

    data["created_by"] = current_user.get("user_id")
    data["created_by_name"] = current_user.get("name", "User")

    item_doc = await AxisDataStore.add_inventory_item(owner_id, data)

    # Activity Logging for audit trail
    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="inventory.create",
        title=f"Created SKU {data['sku']} ({data['name']})",
        details=f"Stock: {data['stock_quantity']} units @ ${data['selling_price']:,.2f} selling price",
        branch_id=data.get("branch_id")
    )

    return {"status": "created", "item": item_doc}


@router.put("/items/{sku}", response_model=Dict[str, Any])
async def update_inventory_item(
    sku: str,
    payload: InventoryItemUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing SKU item."""
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    # If sub-user, keep to their branch
    if is_sub_user and current_user.get("branch_id"):
        updates["branch_id"] = current_user.get("branch_id")

    updated = await AxisDataStore.update_inventory_item(owner_id, sku, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="inventory.update",
        title=f"Updated SKU {sku} ({updated.get('name')})",
        details=f"Modified fields: {', '.join(updates.keys())}",
        branch_id=updated.get("branch_id")
    )

    return {"status": "updated", "item": updated}


@router.delete("/items/{sku}")
async def delete_inventory_item(
    sku: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an inventory item."""
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    success = await AxisDataStore.delete_inventory_item(owner_id, sku)
    if success:
        actor_name = current_user.get("name", "User")
        actor_role = "Team Member" if is_sub_user else "Owner"
        await AxisDataStore.log_activity(
            owner_id=owner_id,
            actor_id=current_user.get("user_id", ""),
            actor_name=actor_name,
            actor_role=actor_role,
            action="inventory.delete",
            title=f"Deleted inventory SKU {sku}",
            details=f"Item {sku} was removed from inventory.",
            branch_id=current_user.get("branch_id")
        )
        return {"status": "deleted", "sku": sku}
    raise HTTPException(status_code=404, detail="Item not found")


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
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    if is_sub_user and current_user.get("branch_id"):
        branch_id = current_user.get("branch_id")

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
                "created_by": current_user.get("user_id"),
                "created_by_name": current_user.get("name", "User")
            }
            result = await AxisDataStore.add_inventory_item(owner_id, item)
            imported.append(result)
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})

    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="inventory.import",
        title=f"Imported {len(imported)} inventory SKUs from CSV",
        details=f"File: {file.filename} • {len(imported)} items imported" + (f", {len(errors)} errors" if errors else ""),
        branch_id=branch_id
    )

    return {
        "status": "complete",
        "imported": len(imported),
        "errors": errors,
        "message": f"Successfully imported {len(imported)} items" + (f", {len(errors)} rows had errors" if errors else "")
    }

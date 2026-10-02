from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import csv
import io
import datetime
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user
from app.routers.business import get_business_doc
from app.routers.payments import get_user_subscription


router = APIRouter(prefix="/api/inventory", tags=["Inventory Intelligence"])


class InventoryItemCreate(BaseModel):
    sku: Optional[str] = None
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


def _check_inventory_permission(current_user: dict, write: bool = False):
    if current_user.get("is_sub_user"):
        perms = current_user.get("permissions") or []
        if write:
            if "inventory" not in perms:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Your assigned role does not have permission to modify inventory."
                )
        else:
            if not any(p in perms for p in ["inventory", "dashboard", "analytics"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Your assigned role does not have permission to view inventory."
                )


@router.get("/items", response_model=List[Dict[str, Any]])
async def get_inventory(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get inventory items for the business, with optional branch filter."""
    _check_inventory_permission(current_user, write=False)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    if is_sub_user and current_user.get("branch_id"):
        target_branch = current_user.get("branch_id")
    else:
        target_branch = branch_id if (branch_id and branch_id.strip() and branch_id.upper() != "ALL") else None

    items = await AxisDataStore.get_inventory(owner_id)
    if target_branch:
        doc = await get_business_doc(owner_id)
        branches = doc.get("branches", [])
        is_main_or_only = len(branches) <= 1 or (branches and (next((b for b in branches if b.get("is_main")), branches[0]).get("id") == target_branch))
        items = [i for i in items if i.get("branch_id") == target_branch or (is_main_or_only and not i.get("branch_id"))]
    return items


def _generate_smart_sku(category: str, name: str = "") -> str:
    cat = (category or "").lower()
    if "hardware" in cat or "device" in cat:
        prefix = "HW"
    elif "finish" in cat or "product" in cat:
        prefix = "FG"
    elif "raw" in cat or "part" in cat or "material" in cat:
        prefix = "RM"
    elif "office" in cat or "facilit" in cat or "equip" in cat:
        prefix = "OE"
    elif "packag" in cat or "logistic" in cat:
        prefix = "PKG"
    elif "electric" in cat or "electron" in cat:
        prefix = "ELEC"
    elif "apparel" in cat or "cloth" in cat:
        prefix = "APP"
    elif "food" in cat or "beverag" in cat:
        prefix = "FB"
    elif "chemical" in cat or "pharma" in cat:
        prefix = "CHEM"
    elif "service" in cat or "consult" in cat:
        prefix = "SRV"
    elif "general" in cat or "stock" in cat:
        prefix = "STK"
    elif len(cat) >= 3:
        clean = "".join(c for c in cat if c.isalnum())
        prefix = clean[:3].upper() if len(clean) >= 3 else "SKU"
    else:
        prefix = "SKU"
    import random
    return f"{prefix}-{random.randint(1000, 9999)}"


@router.post("/items", response_model=Dict[str, Any])
async def create_inventory_item(
    payload: InventoryItemCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new SKU inventory item. Supports custom SKU or smart auto-generated SKU."""
    _check_inventory_permission(current_user, write=True)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    # Enforce Tier Limits (Free: max 2 uploads/items, Starter & Pro: unlimited)
    sub = await get_user_subscription(owner_id)
    inv_limit = sub.get("entitlements", {}).get("inventory_limit", 2)
    if inv_limit != -1:
        current_inv = await AxisDataStore.get_inventory(owner_id)
        if len(current_inv) >= inv_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Inventory limit reached ({inv_limit} uploads max on {sub.get('name', 'Free Tier')}). Upgrade to Starter or Pro for unlimited inventory and ledger access."
            )

    data = payload.model_dump()


    # Validate or auto-generate category-aware SKU
    provided_sku = str(data.get("sku") or "").strip()
    if not provided_sku or provided_sku.lower() in ("undefined", "null", "none"):
        data["sku"] = _generate_smart_sku(data.get("category", ""), data.get("name", ""))
    else:
        data["sku"] = provided_sku

    # If branch not provided in payload and sub-user has an assigned branch, default to it
    if not data.get("branch_id") and is_sub_user and current_user.get("branch_id"):
        data["branch_id"] = current_user.get("branch_id")
    elif not data.get("branch_id"):
        try:
            doc = await get_business_doc(owner_id)
            branches = doc.get("branches", [])
            if len(branches) == 1:
                data["branch_id"] = branches[0]["id"]
            elif branches:
                main_b = next((b for b in branches if b.get("is_main")), branches[0])
                data["branch_id"] = main_b["id"]
        except Exception:
            pass

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
    """Update an existing SKU item, or upsert if not found."""
    _check_inventory_permission(current_user, write=True)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    # Normalize SKU if called with undefined/empty
    clean_sku = sku.strip() if sku else ""
    if not clean_sku or clean_sku.lower() in ("undefined", "null", "none"):
        clean_sku = _generate_smart_sku(updates.get("category", ""), updates.get("name", ""))

    # If sub-user, keep to their branch
    if is_sub_user and current_user.get("branch_id"):
        updates["branch_id"] = current_user.get("branch_id")

    updated = await AxisDataStore.update_inventory_item(owner_id, clean_sku, updates)
    if not updated:
        # Graceful upsert so it NEVER throws 404
        updates["sku"] = clean_sku
        updated = await AxisDataStore.add_inventory_item(owner_id, updates)

    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="inventory.update",
        title=f"Saved SKU {clean_sku} ({updated.get('name')})",
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
    _check_inventory_permission(current_user, write=True)
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
    _check_inventory_permission(current_user, write=True)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    # Enforce Tier Limits (Free: max 2 uploads/items, Starter & Pro: unlimited)
    sub = await get_user_subscription(owner_id)
    inv_limit = sub.get("entitlements", {}).get("inventory_limit", 2)
    if inv_limit != -1:
        current_inv = await AxisDataStore.get_inventory(owner_id)
        if len(current_inv) >= inv_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Inventory limit reached ({inv_limit} uploads max on {sub.get('name', 'Free Tier')}). Upgrade to Starter or Pro for bulk CSV import and unlimited inventory."
            )

    doc = await get_business_doc(owner_id)

    branches = doc.get("branches", [])

    if is_sub_user and current_user.get("branch_id"):
        branch_id = current_user.get("branch_id")
    elif not branch_id:
        if len(branches) == 1:
            branch_id = branches[0]["id"]
        elif branches:
            main_b = next((b for b in branches if b.get("is_main")), branches[0])
            branch_id = main_b["id"]

    branch_map = {}
    for b in branches:
        b_id = str(b.get("id", "")).strip()
        b_name = str(b.get("name", "")).strip().lower()
        if b_id:
            branch_map[b_id.lower()] = b_id
        if b_name:
            branch_map[b_name] = b_id

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
            raw_branch = (
                row.get("branch_id") or row.get("Branch ID") or
                row.get("branch") or row.get("Branch") or
                row.get("branch_name") or row.get("Branch Name") or ""
            )
            raw_branch_str = str(raw_branch).strip()
            resolved_branch = branch_map.get(raw_branch_str.lower()) if raw_branch_str else None
            assigned_branch = resolved_branch or branch_id

            item = {
                "sku": row.get("sku", row.get("SKU", f"SKU-{i+1}")),
                "name": row.get("name", row.get("Name", row.get("Item Name", "Unknown"))),
                "category": row.get("category", row.get("Category", "General")),
                "stock_quantity": int(float(row.get("stock_quantity", row.get("Stock Qty", row.get("Quantity", 0))))),
                "reorder_point": int(float(row.get("reorder_point", row.get("Reorder Point", 10)))),
                "unit_cost": float(str(row.get("unit_cost", row.get("Unit Cost", row.get("Cost", 0)))).replace(",", "").replace("$", "")),
                "selling_price": float(str(row.get("selling_price", row.get("Selling Price", row.get("Price", 0)))).replace(",", "").replace("$", "")),
                "supplier": row.get("supplier", row.get("Supplier", "Unknown Supplier")),
                "branch_id": assigned_branch,
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

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import datetime
from app.database import AxisDataStore
from app.auth.dependencies import get_current_user
from app.routers.business import get_business_doc

router = APIRouter(prefix="/api/spreadsheet", tags=["Axis Spreadsheet Engine"])


class CustomSheetPayload(BaseModel):
    id: Optional[str] = None
    title: str = "Untitled Sheet"
    description: Optional[str] = ""
    columns: List[Dict[str, Any]] = []
    rows: List[Dict[str, Any]] = []
    metadata: Optional[Dict[str, Any]] = None


class BatchSyncItem(BaseModel):
    action: str  # "create" | "update" | "delete"
    id: Optional[str] = None  # txn id or sku
    data: Dict[str, Any] = {}


class BatchSyncPayload(BaseModel):
    dataset: str  # "ledger" | "inventory" | "custom"
    sheet_id: Optional[str] = None
    branch_id: Optional[str] = None
    items: List[BatchSyncItem]


def _check_spreadsheet_permission(current_user: dict, write: bool = False):
    if current_user.get("is_sub_user"):
        perms = current_user.get("permissions") or []
        if write:
            if not any(p in perms for p in ["inventory", "transactions"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You do not have permission to edit records in the spreadsheet."
                )
        else:
            if not any(p in perms for p in ["inventory", "transactions", "dashboard", "analytics"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You do not have permission to view spreadsheet records."
                )


@router.get("/overview")
async def get_spreadsheet_overview(current_user: dict = Depends(get_current_user)):
    """Return overview summary of available business sheets."""
    _check_spreadsheet_permission(current_user, write=False)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    txns = await AxisDataStore.get_transactions(owner_id)
    inv = await AxisDataStore.get_inventory(owner_id)
    custom_sheets = await AxisDataStore.get_custom_spreadsheets(owner_id)

    total_revenue = sum(t.get("amount", 0) for t in txns if t.get("amount", 0) > 0)
    total_expense = sum(abs(t.get("amount", 0)) for t in txns if t.get("amount", 0) < 0)
    inv_value = sum(i.get("stock_quantity", 0) * i.get("unit_cost", 0) for i in inv)

    return {
        "ledger": {
            "name": "Transactions Ledger",
            "count": len(txns),
            "total_revenue": total_revenue,
            "total_expense": total_expense,
            "net_flow": total_revenue - total_expense
        },
        "inventory": {
            "name": "Inventory & SKUs",
            "count": len(inv),
            "total_valuation": inv_value,
            "total_units": sum(i.get("stock_quantity", 0) for i in inv)
        },
        "custom_sheets_count": len(custom_sheets)
    }


@router.get("/custom", response_model=List[Dict[str, Any]])
async def get_custom_sheets(current_user: dict = Depends(get_current_user)):
    """Fetch custom spreadsheets created by the user."""
    _check_spreadsheet_permission(current_user, write=False)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    sheets = await AxisDataStore.get_custom_spreadsheets(owner_id)
    return sheets


@router.post("/custom", response_model=Dict[str, Any])
async def save_custom_sheet(
    payload: CustomSheetPayload,
    current_user: dict = Depends(get_current_user)
):
    """Save or update a custom spreadsheet."""
    _check_spreadsheet_permission(current_user, write=True)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    data = payload.model_dump()
    data["created_by"] = current_user.get("user_id")
    data["created_by_name"] = current_user.get("name", "User")
    saved = await AxisDataStore.save_custom_spreadsheet(owner_id, data)

    # Activity Logging
    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="spreadsheet.save",
        title=f"Saved custom sheet '{data.get('title', 'Sheet')}'",
        details=f"Contains {len(data.get('rows', []))} rows and {len(data.get('columns', []))} columns.",
        branch_id=current_user.get("branch_id")
    )

    return saved


@router.delete("/custom/{sheet_id}")
async def delete_custom_sheet(
    sheet_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom spreadsheet."""
    _check_spreadsheet_permission(current_user, write=True)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    success = await AxisDataStore.delete_custom_spreadsheet(owner_id, sheet_id)
    if not success:
        raise HTTPException(status_code=404, detail="Custom sheet not found")
    return {"status": "deleted", "id": sheet_id}


@router.post("/batch-sync")
async def batch_sync_records(
    payload: BatchSyncPayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Sync multiple rows or edits made in the spreadsheet in a single request.
    Handles Ledger, Inventory, and Custom sheets.
    """
    _check_spreadsheet_permission(current_user, write=True)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    assigned_branch = current_user.get("branch_id") if is_sub_user else payload.branch_id

    created_count = 0
    updated_count = 0
    deleted_count = 0
    errors = []

    if payload.dataset == "ledger":
        for item in payload.items:
            try:
                if item.action == "create":
                    d = item.data.copy()
                    d["created_by"] = current_user.get("user_id")
                    d["created_by_name"] = current_user.get("name", "User")
                    if assigned_branch:
                        d["branch_id"] = assigned_branch
                    await AxisDataStore.add_transaction(owner_id, d)
                    created_count += 1
                elif item.action == "update" and item.id:
                    d = item.data.copy()
                    if assigned_branch and is_sub_user:
                        d["branch_id"] = assigned_branch
                    res = await AxisDataStore.update_transaction(owner_id, item.id, d)
                    if res:
                        updated_count += 1
                    else:
                        errors.append(f"Transaction {item.id} not found")
                elif item.action == "delete" and item.id:
                    res = await AxisDataStore.delete_transaction(owner_id, item.id)
                    if res:
                        deleted_count += 1
                    else:
                        errors.append(f"Transaction {item.id} not found")
            except Exception as e:
                errors.append(str(e))

    elif payload.dataset == "inventory":
        for item in payload.items:
            try:
                if item.action == "create":
                    d = item.data.copy()
                    d["created_by"] = current_user.get("user_id")
                    d["created_by_name"] = current_user.get("name", "User")
                    if assigned_branch:
                        d["branch_id"] = assigned_branch
                    await AxisDataStore.add_inventory_item(owner_id, d)
                    created_count += 1
                elif item.action == "update" and item.id:
                    d = item.data.copy()
                    if assigned_branch and is_sub_user:
                        d["branch_id"] = assigned_branch
                    res = await AxisDataStore.update_inventory_item(owner_id, item.id, d)
                    if res:
                        updated_count += 1
                    else:
                        errors.append(f"SKU {item.id} not found")
                elif item.action == "delete" and item.id:
                    res = await AxisDataStore.delete_inventory_item(owner_id, item.id)
                    if res:
                        deleted_count += 1
                    else:
                        errors.append(f"SKU {item.id} not found")
            except Exception as e:
                errors.append(str(e))

    # Log activity for spreadsheet batch sync
    if created_count > 0 or updated_count > 0 or deleted_count > 0:
        actor_name = current_user.get("name", "User")
        actor_role = "Team Member" if is_sub_user else "Owner"
        await AxisDataStore.log_activity(
            owner_id=owner_id,
            actor_id=current_user.get("user_id", ""),
            actor_name=actor_name,
            actor_role=actor_role,
            action="spreadsheet.sync",
            title=f"Spreadsheet Sync ({payload.dataset.title()})",
            details=f"Created: {created_count}, Updated: {updated_count}, Deleted: {deleted_count}",
            branch_id=assigned_branch
        )

    return {
        "status": "success",
        "dataset": payload.dataset,
        "created": created_count,
        "updated": updated_count,
        "deleted": deleted_count,
        "errors": errors
    }

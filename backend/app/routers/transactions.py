from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import csv
import io
import datetime
from app.database import AxisDataStore, db_manager
from app.auth.dependencies import get_current_user
from app.routers.business import get_business_doc

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


class TransactionPayload(BaseModel):
    counterparty: str
    type: str = "Expense"
    category: str = "Operations & Logistics"
    accountType: Optional[str] = None
    date: Optional[str] = None
    status: str = "Cleared"
    amount: float
    notes: Optional[str] = None
    branch_id: Optional[str] = None


def _check_txn_permission(current_user: dict):
    if current_user.get("is_sub_user"):
        perms = current_user.get("permissions") or []
        if "transactions" not in perms:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Your assigned role does not have permission to view or manage the ledger."
            )


@router.get("/me", response_model=List[Dict[str, Any]])
async def get_user_transactions(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    _check_txn_permission(current_user)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    
    if is_sub_user and current_user.get("branch_id"):
        target_branch = current_user.get("branch_id")
    else:
        target_branch = branch_id if (branch_id and branch_id.strip() and branch_id.upper() != "ALL") else None

    txns = await AxisDataStore.get_transactions(owner_id)
    if target_branch:
        txns = [t for t in txns if t.get("branch_id") == target_branch]
    return txns


@router.post("/me", response_model=Dict[str, Any])
async def create_transaction(
    payload: TransactionPayload,
    current_user: dict = Depends(get_current_user)
):
    _check_txn_permission(current_user)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    data = payload.model_dump()

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

    result = await AxisDataStore.add_transaction(owner_id, data)

    # Activity Logging for audit trail (both owner & team actions logged)
    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    amt_str = f"${abs(data['amount']):,.2f}"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="transaction.create",
        title=f"Recorded ledger {data['type']}",
        details=f"{data['type']} of {amt_str} — {data['counterparty']} ({data['category']})",
        branch_id=data.get("branch_id")
    )

    return result


@router.delete("/me/{txn_id}")
async def delete_transaction(
    txn_id: str,
    current_user: dict = Depends(get_current_user)
):
    _check_txn_permission(current_user)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    success = await AxisDataStore.delete_transaction(owner_id, txn_id)
    if success:
        actor_name = current_user.get("name", "User")
        actor_role = "Team Member" if is_sub_user else "Owner"
        await AxisDataStore.log_activity(
            owner_id=owner_id,
            actor_id=current_user.get("user_id", ""),
            actor_name=actor_name,
            actor_role=actor_role,
            action="transaction.delete",
            title="Deleted ledger transaction",
            details=f"Transaction ID {txn_id} was removed from the ledger.",
            branch_id=current_user.get("branch_id")
        )
        return {"status": "deleted", "id": txn_id}
    raise HTTPException(status_code=404, detail="Transaction not found")


@router.post("/me/import-csv", response_model=Dict[str, Any])
async def import_transactions_csv(
    file: UploadFile = File(...),
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Import transactions from a CSV file.
    Expected columns: counterparty, type, category, accountType, date, status, amount, notes
    """
    _check_txn_permission(current_user)
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")
    
    doc = await get_business_doc(owner_id)
    branches = doc.get("branches", [])

    # Sub-users locked to assigned branch
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
            amount_raw = row.get("amount", row.get("Amount", "0")).replace(",", "").replace("$", "").strip()
            amount = float(amount_raw)

            raw_branch = (
                row.get("branch_id") or row.get("Branch ID") or
                row.get("branch") or row.get("Branch") or
                row.get("branch_name") or row.get("Branch Name") or ""
            )
            raw_branch_str = str(raw_branch).strip()
            resolved_branch = branch_map.get(raw_branch_str.lower()) if raw_branch_str else None
            assigned_branch = resolved_branch or branch_id

            txn = {
                "counterparty": row.get("counterparty", row.get("Counterparty", f"Row {i+1}")),
                "type": row.get("type", row.get("Type", "Expense")),
                "category": row.get("category", row.get("Category", "Operations & Logistics")),
                "accountType": row.get("accountType", row.get("Account Type", None)),
                "date": row.get("date", row.get("Date", datetime.date.today().isoformat())),
                "status": row.get("status", row.get("Status", "Cleared")),
                "amount": amount,
                "notes": row.get("notes", row.get("Notes", "")),
                "branch_id": assigned_branch,
                "created_by": current_user.get("user_id"),
                "created_by_name": current_user.get("name", "User")
            }
            result = await AxisDataStore.add_transaction(owner_id, txn)
            imported.append(result)
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})

    # Log activity for CSV import
    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=current_user.get("user_id", ""),
        actor_name=actor_name,
        actor_role=actor_role,
        action="transaction.import",
        title=f"Imported {len(imported)} ledger transactions from CSV",
        details=f"File: {file.filename} • {len(imported)} rows imported" + (f", {len(errors)} errors" if errors else ""),
        branch_id=branch_id
    )

    return {
        "status": "complete",
        "imported": len(imported),
        "errors": errors,
        "message": f"Successfully imported {len(imported)} transactions" + (f", {len(errors)} rows had errors" if errors else "")
    }

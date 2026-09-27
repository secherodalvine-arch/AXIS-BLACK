from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import csv
import io
import datetime
from app.database import AxisDataStore, db_manager
from app.auth.dependencies import get_current_user

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


@router.get("/me", response_model=List[Dict[str, Any]])
async def get_user_transactions(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id", "default_user")
    txns = await AxisDataStore.get_transactions(user_id)
    if branch_id:
        txns = [t for t in txns if t.get("branch_id") == branch_id]
    return txns


@router.post("/me", response_model=Dict[str, Any])
async def create_transaction(
    payload: TransactionPayload,
    current_user: dict = Depends(get_current_user)
):
    return await AxisDataStore.add_transaction(
        current_user.get("user_id", "default_user"),
        payload.model_dump()
    )


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
            amount_raw = row.get("amount", row.get("Amount", "0")).replace(",", "").replace("$", "").strip()
            amount = float(amount_raw)
            txn = {
                "counterparty": row.get("counterparty", row.get("Counterparty", f"Row {i+1}")),
                "type": row.get("type", row.get("Type", "Expense")),
                "category": row.get("category", row.get("Category", "Operations & Logistics")),
                "accountType": row.get("accountType", row.get("Account Type", None)),
                "date": row.get("date", row.get("Date", datetime.date.today().isoformat())),
                "status": row.get("status", row.get("Status", "Cleared")),
                "amount": amount,
                "notes": row.get("notes", row.get("Notes", "")),
                "branch_id": branch_id or row.get("branch_id", row.get("Branch ID", None)),
            }
            result = await AxisDataStore.add_transaction(user_id, txn)
            imported.append(result)
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})

    return {
        "status": "complete",
        "imported": len(imported),
        "errors": errors,
        "message": f"Successfully imported {len(imported)} transactions" + (f", {len(errors)} rows had errors" if errors else "")
    }

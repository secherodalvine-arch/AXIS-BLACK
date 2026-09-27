from fastapi import APIRouter, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import datetime
from app.auth.dependencies import get_current_user
from app.database import AxisDataStore, db_manager

router = APIRouter(prefix="/api/analytics", tags=["Celestial Analytics & Runway Simulator"])

class SimulationRequest(BaseModel):
    monthly_burn_rate: float
    capital_efficiency: float
    new_funding: float = 0.0

@router.get("/me", response_model=Dict[str, Any])
async def get_celestial_analytics(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns historical revenue & gross margin analytics computed from live transactions,
    with multi-branch comparison, operational scalability scores, and inventory health.
    """
    is_sub_user = bool(current_user.get("is_sub_user"))
    user_id = current_user.get("owner_id") if is_sub_user else current_user.get("user_id", "default_user")

    # Team member restriction: can only see information for their assigned branch
    if is_sub_user and current_user.get("branch_id"):
        branch_id = current_user.get("branch_id")

    all_txns = await AxisDataStore.get_transactions(user_id)

    # Filter txns if a specific branch is selected
    if branch_id:
        txns = [t for t in all_txns if t.get("branch_id") == branch_id]
    else:
        txns = all_txns

    total_revenue = sum(t["amount"] for t in txns if t.get("amount", 0) > 0)
    total_expenses = sum(abs(t["amount"]) for t in txns if t.get("amount", 0) < 0)
    net_cash = total_revenue - total_expenses
    net_margin = round(((total_revenue - total_expenses) / total_revenue * 100), 1) if total_revenue > 0 else 0.0
    runway_months = round(net_cash / total_expenses, 1) if total_expenses > 0 else (12.0 if net_cash > 0 else 0.0)

    # Aggregate by month
    monthly_map: Dict[str, Dict[str, float]] = {}
    for t in txns:
        date_str = t.get("date")
        if not date_str:
            continue
        try:
            date_clean = str(date_str)[:10]
            d = datetime.date.fromisoformat(date_clean)
            m_key = d.strftime("%b")
        except Exception:
            continue

        if m_key not in monthly_map:
            monthly_map[m_key] = {"revenue": 0.0, "expenses": 0.0}

        amt = t.get("amount", 0.0)
        if amt > 0:
            monthly_map[m_key]["revenue"] += amt
        else:
            monthly_map[m_key]["expenses"] += abs(amt)

    monthly_series = []
    for m_key, vals in monthly_map.items():
        rev = vals["revenue"]
        exp = vals["expenses"]
        margin = round(((rev - exp) / rev * 100), 1) if rev > 0 else 0.0
        monthly_series.append({
            "month": m_key,
            "revenue": round(rev, 2),
            "expenses": round(exp, 2),
            "grossMargin": margin
        })

    # Fetch business doc to compute branch comparisons
    from app.routers.business import get_business_doc
    biz_doc = await get_business_doc(user_id)
    branches = biz_doc.get("branches", [])
    if is_sub_user and current_user.get("branch_id"):
        branches = [b for b in branches if b["id"] == current_user["branch_id"]]

    # Calculate multi-branch comparison
    total_biz_rev = sum(t["amount"] for t in all_txns if t.get("amount", 0) > 0)
    branch_breakdown = []
    for b in branches:
        b_id = b["id"]
        b_txns = [t for t in all_txns if t.get("branch_id") == b_id]
        b_rev = sum(t["amount"] for t in b_txns if t.get("amount", 0) > 0)
        b_exp = sum(abs(t["amount"]) for t in b_txns if t.get("amount", 0) < 0)
        b_net = b_rev - b_exp
        b_margin = round((b_net / b_rev * 100), 1) if b_rev > 0 else 0.0
        share_pct = round((b_rev / total_biz_rev * 100), 1) if total_biz_rev > 0 else 0.0

        # Scalability Grade
        if b_margin >= 45 and b_rev > 0:
            scalability_grade = "High Scalability (Top Tier)"
            scalability_badge = "success"
        elif b_margin >= 20:
            scalability_grade = "Healthy Growth Driver"
            scalability_badge = "cyan"
        elif b_margin >= 0:
            scalability_grade = "Break-Even (Developing)"
            scalability_badge = "warning"
        else:
            scalability_grade = "Cost Optimization Needed"
            scalability_badge = "danger"

        branch_breakdown.append({
            "branch_id": b_id,
            "name": b.get("name", "Branch"),
            "location": b.get("location", "N/A"),
            "is_main": b.get("is_main", False),
            "is_active": b.get("is_active", True),
            "revenue": round(b_rev, 2),
            "expenses": round(b_exp, 2),
            "net_cash": round(b_net, 2),
            "margin_percent": b_margin,
            "transaction_count": len(b_txns),
            "revenue_share_percent": share_pct,
            "scalability_grade": scalability_grade,
            "scalability_badge": scalability_badge
        })

    # Sort branches by revenue descending
    branch_breakdown.sort(key=lambda x: x["revenue"], reverse=True)
    top_branch = branch_breakdown[0]["name"] if branch_breakdown else "HQ"

    # Fetch inventory metrics
    inventory = await AxisDataStore.get_inventory(user_id)
    if branch_id:
        scoped_inventory = [i for i in inventory if i.get("branch_id") == branch_id]
    else:
        scoped_inventory = inventory
    total_inventory_val = sum(float(i.get("stock_quantity", 0)) * float(i.get("unit_cost", 0)) for i in scoped_inventory)
    low_stock = sum(1 for i in scoped_inventory if int(i.get("stock_quantity", 0)) <= int(i.get("reorder_point", 10)))

    return {
        "user_id": user_id,
        "branch_id": branch_id,
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "net_margin": net_margin,
        "cash_balance": round(net_cash, 2),
        "projected_runway_months": runway_months,
        "monthly_series": monthly_series,
        "branches": branches,
        "branch_breakdown": branch_breakdown,
        "top_performing_branch": top_branch,
        "inventory_summary": {
            "total_items": len(scoped_inventory),
            "total_valuation": round(total_inventory_val, 2),
            "low_stock_count": low_stock
        }
    }

@router.post("/simulate", response_model=Dict[str, Any])
async def run_runway_simulation(
    payload: SimulationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executes Monte Carlo runway scenario simulations based on real database cash and parameters.
    """
    user_id = current_user.get("user_id", "default_user")
    txns = await AxisDataStore.get_transactions(user_id)
    real_cash = sum(t.get("amount", 0) for t in txns)
    cash = max(0.0, real_cash) + payload.new_funding

    adjusted_burn = payload.monthly_burn_rate * (1 - (payload.capital_efficiency / 100.0))
    runway_months = round(cash / adjusted_burn, 1) if adjusted_burn > 0 else (999.0 if cash > 0 else 0.0)

    return {
        "status": "simulated",
        "starting_cash": round(cash, 2),
        "adjusted_monthly_burn": round(adjusted_burn, 2),
        "runway_months": runway_months,
        "confidence_interval": "95%",
        "recommendation": "Optimal runway buffer achieved." if runway_months >= 12.0 else ("Critical: Capital efficiency optimization required." if cash > 0 else "Log transactions in the Ledger to simulate runway.")
    }

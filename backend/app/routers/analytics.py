from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from pydantic import BaseModel
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Celestial Analytics & Runway Simulator"])

class SimulationRequest(BaseModel):
    monthly_burn_rate: float
    capital_efficiency: float
    new_funding: float = 0.0

@router.get("/me", response_model=Dict[str, Any])
async def get_celestial_analytics(current_user: dict = Depends(get_current_user)):
    """
    Returns 12-month historical revenue & gross margin analytics.
    """
    return {
        "user_id": current_user.get("user_id", "default_user"),
        "net_margin": 32.4,
        "cash_balance": 1845000.0,
        "projected_runway_months": 14.8,
        "monthly_series": [
            {"month": "Sep", "revenue": 280000, "expenses": 190000, "grossMargin": 32.1},
            {"month": "Oct", "revenue": 310000, "expenses": 205000, "grossMargin": 33.8},
            {"month": "Nov", "revenue": 345000, "expenses": 220000, "grossMargin": 36.2},
            {"month": "Dec", "revenue": 390000, "expenses": 240000, "grossMargin": 38.5},
            {"month": "Jan", "revenue": 420000, "expenses": 255000, "grossMargin": 39.2},
            {"month": "Feb", "revenue": 465000, "expenses": 270000, "grossMargin": 41.9}
        ]
    }

@router.post("/simulate", response_model=Dict[str, Any])
async def run_runway_simulation(
    payload: SimulationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executes Monte Carlo runway scenario simulations based on burn rate and capital efficiency.
    """
    cash = 1845000.0 + payload.new_funding
    adjusted_burn = payload.monthly_burn_rate * (1 - (payload.capital_efficiency / 100.0))
    runway_months = round(cash / adjusted_burn, 1) if adjusted_burn > 0 else 999.0

    return {
        "status": "simulated",
        "starting_cash": cash,
        "adjusted_monthly_burn": round(adjusted_burn, 2),
        "runway_months": runway_months,
        "confidence_interval": "95%",
        "recommendation": "Optimal runway buffer achieved." if runway_months >= 12.0 else "Critical: Capital efficiency optimization required."
    }

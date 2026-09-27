"""
routers/business.py — Business Profile, Branches & Roles management.
Owner auto-assigned on registration. Sub-users can be created with scoped access.
"""
import uuid
import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.database import db_manager
from app.auth.security import hash_password

router = APIRouter(prefix="/api/business", tags=["Business Management"])


# ── Models ────────────────────────────────────────────────────────────────────

class BranchCreate(BaseModel):
    name: str = Field(..., example="Westlands Branch")
    location: Optional[str] = Field(None, example="Westlands, Nairobi")
    manager_user_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    manager_user_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    business_category: Optional[str] = None
    industry: Optional[str] = None
    number_of_employees: Optional[int] = None
    description: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    founded_year: Optional[int] = None
    logo_url: Optional[str] = None

class RoleCreate(BaseModel):
    role_name: str = Field(..., example="Manager")
    permissions: List[str] = Field(default_factory=list,
        example=["dashboard", "inventory", "analytics", "transactions", "agent"])
    description: Optional[str] = None
    branch_id: Optional[str] = None  # restrict role to a specific branch

class SubUserCreate(BaseModel):
    name: str
    email: str
    role_id: str
    branch_id: Optional[str] = None

class SubUserUpdate(BaseModel):
    name: Optional[str] = None
    role_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: Optional[bool] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

async def get_business_doc(owner_id: str) -> Dict[str, Any]:
    """Fetch or auto-create business profile document."""
    if db_manager.is_connected:
        doc = await db_manager.db.businesses.find_one({"owner_id": owner_id})
        if doc:
            doc.pop("_id", None)
            return doc

    mem = db_manager.memory_store.get("businesses", {})
    return mem.get(owner_id, {})


async def save_business_doc(owner_id: str, doc: Dict[str, Any]):
    if db_manager.is_connected:
        await db_manager.db.businesses.update_one(
            {"owner_id": owner_id},
            {"$set": doc},
            upsert=True
        )
    if "businesses" not in db_manager.memory_store:
        db_manager.memory_store["businesses"] = {}
    db_manager.memory_store["businesses"][owner_id] = doc
    db_manager.save_memory_store()


# ── Business Profile ──────────────────────────────────────────────────────────

@router.get("/profile", response_model=Dict[str, Any])
async def get_business_profile(current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    if not doc:
        # Return empty scaffold
        return {
            "owner_id": owner_id,
            "business_name": current_user.get("company", ""),
            "business_category": "",
            "industry": "",
            "number_of_employees": 0,
            "description": "",
            "location": "",
            "phone": "",
            "email": current_user.get("email", ""),
            "website": "",
            "founded_year": None,
            "logo_url": "",
            "branches": [],
            "roles": [],
            "sub_users": [],
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
    return doc


@router.put("/profile", response_model=Dict[str, Any])
async def update_business_profile(
    payload: BusinessProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    if not doc:
        doc = {
            "owner_id": owner_id,
            "business_name": "",
            "business_category": "",
            "industry": "",
            "number_of_employees": 0,
            "description": "",
            "location": "",
            "phone": "",
            "email": current_user.get("email", ""),
            "website": "",
            "founded_year": None,
            "logo_url": "",
            "branches": [],
            "roles": [],
            "sub_users": [],
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    update = payload.model_dump(exclude_none=True)
    doc.update(update)
    doc["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await save_business_doc(owner_id, doc)
    return doc


# ── Branches ──────────────────────────────────────────────────────────────────

@router.get("/branches", response_model=List[Dict[str, Any]])
async def list_branches(current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    return doc.get("branches", [])


@router.post("/branches", response_model=Dict[str, Any], status_code=201)
async def create_branch(
    payload: BranchCreate,
    current_user: dict = Depends(get_current_user)
):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    if not doc:
        doc = {"owner_id": owner_id, "branches": [], "roles": [], "sub_users": [],
               "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}

    branch = {
        "id": f"branch-{uuid.uuid4().hex[:8]}",
        "owner_id": owner_id,
        **payload.model_dump(),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    doc.setdefault("branches", []).append(branch)
    await save_business_doc(owner_id, doc)
    return branch


@router.put("/branches/{branch_id}", response_model=Dict[str, Any])
async def update_branch(
    branch_id: str,
    payload: BranchUpdate,
    current_user: dict = Depends(get_current_user)
):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    branches = doc.get("branches", [])
    for i, b in enumerate(branches):
        if b["id"] == branch_id:
            branches[i].update({k: v for k, v in payload.model_dump().items() if v is not None})
            branches[i]["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            doc["branches"] = branches
            await save_business_doc(owner_id, doc)
            return branches[i]
    raise HTTPException(status_code=404, detail="Branch not found")


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    doc["branches"] = [b for b in doc.get("branches", []) if b["id"] != branch_id]
    await save_business_doc(owner_id, doc)
    return {"status": "deleted", "branch_id": branch_id}


# ── Roles ─────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=List[Dict[str, Any]])
async def list_roles(current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    default_roles = [
        {
            "id": "role-owner",
            "role_name": "Owner",
            "permissions": ["dashboard", "inventory", "analytics", "transactions", "agent", "business", "settings"],
            "description": "Full system access. Auto-assigned on registration.",
            "branch_id": None
        },
        {
            "id": "role-manager",
            "role_name": "Manager",
            "permissions": ["dashboard", "inventory", "analytics", "transactions", "agent", "business"],
            "description": "Can access all operational features but not Settings/User Management.",
            "branch_id": None
        }
    ]
    custom_roles = doc.get("roles", [])
    all_roles = default_roles + [r for r in custom_roles if r.get("id") not in ["role-owner", "role-manager"]]
    return all_roles


@router.post("/roles", response_model=Dict[str, Any], status_code=201)
async def create_role(
    payload: RoleCreate,
    current_user: dict = Depends(get_current_user)
):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    if not doc:
        doc = {"owner_id": owner_id, "branches": [], "roles": [], "sub_users": [],
               "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}

    role = {
        "id": f"role-{uuid.uuid4().hex[:8]}",
        **payload.model_dump(),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    doc.setdefault("roles", []).append(role)
    await save_business_doc(owner_id, doc)
    return role


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(get_current_user)):
    if role_id in ("role-owner", "role-manager"):
        raise HTTPException(status_code=400, detail="Cannot delete built-in system roles")
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    doc["roles"] = [r for r in doc.get("roles", []) if r["id"] != role_id]
    await save_business_doc(owner_id, doc)
    return {"status": "deleted", "role_id": role_id}


# ── Sub-Users / Team Members ──────────────────────────────────────────────────

@router.get("/team", response_model=List[Dict[str, Any]])
async def list_team(current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    return doc.get("sub_users", [])


@router.post("/team", response_model=Dict[str, Any], status_code=201)
async def create_sub_user(
    payload: SubUserCreate,
    current_user: dict = Depends(get_current_user)
):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    if not doc:
        doc = {"owner_id": owner_id, "branches": [], "roles": [], "sub_users": [],
               "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}

    # Check email uniqueness
    existing = doc.get("sub_users", [])
    if any(u["email"] == payload.email for u in existing):
        raise HTTPException(status_code=409, detail="A team member with this email already exists")

    # Temp password is their email; they must change on first login
    temp_password = payload.email
    hashed_pw = hash_password(temp_password)

    sub_user = {
        "id": f"usr-{uuid.uuid4().hex[:8]}",
        "owner_id": owner_id,
        "name": payload.name,
        "email": payload.email,
        "role_id": payload.role_id,
        "branch_id": payload.branch_id,
        "hashed_password": hashed_pw,
        "must_change_password": True,
        "is_active": True,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    # Also register them in the main users store so they can log in
    if db_manager.is_connected:
        existing_user = await db_manager.db.users.find_one({"email": payload.email})
        if not existing_user:
            user_doc = {
                "user_id": sub_user["id"],
                "name": payload.name,
                "email": payload.email,
                "hashed_password": hashed_pw,
                "is_verified": True,
                "is_sub_user": True,
                "owner_id": owner_id,
                "role_id": payload.role_id,
                "branch_id": payload.branch_id,
                "must_change_password": True,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            await db_manager.db.users.insert_one(user_doc)
    else:
        # Memory store fallback
        if "users" not in db_manager.memory_store:
            db_manager.memory_store["users"] = {}
        db_manager.memory_store["users"][payload.email] = {
            "user_id": sub_user["id"],
            "name": payload.name,
            "email": payload.email,
            "hashed_password": hashed_pw,
            "is_verified": True,
            "is_sub_user": True,
            "owner_id": owner_id,
            "role_id": payload.role_id,
            "branch_id": payload.branch_id,
            "must_change_password": True,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    doc.setdefault("sub_users", []).append(sub_user)
    await save_business_doc(owner_id, doc)

    # Return without hashed_password
    return {k: v for k, v in sub_user.items() if k != "hashed_password"}


@router.put("/team/{user_id}", response_model=Dict[str, Any])
async def update_sub_user(
    user_id: str,
    payload: SubUserUpdate,
    current_user: dict = Depends(get_current_user)
):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    sub_users = doc.get("sub_users", [])
    for i, u in enumerate(sub_users):
        if u["id"] == user_id:
            update = {k: v for k, v in payload.model_dump().items() if v is not None}
            sub_users[i].update(update)
            sub_users[i]["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            doc["sub_users"] = sub_users
            await save_business_doc(owner_id, doc)
            return {k: v for k, v in sub_users[i].items() if k != "hashed_password"}
    raise HTTPException(status_code=404, detail="Team member not found")


@router.delete("/team/{user_id}")
async def delete_sub_user(user_id: str, current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    doc = await get_business_doc(owner_id)
    doc["sub_users"] = [u for u in doc.get("sub_users", []) if u["id"] != user_id]
    await save_business_doc(owner_id, doc)
    return {"status": "deleted", "user_id": user_id}


# ── Branch Performance Snapshot ───────────────────────────────────────────────

@router.get("/branches/{branch_id}/performance", response_model=Dict[str, Any])
async def get_branch_performance(
    branch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns aggregate financial metrics for a specific branch."""
    owner_id = current_user["user_id"]
    # Transactions scoped to branch_id
    if db_manager.is_connected:
        cursor = db_manager.db.transactions.find({"user_id": owner_id, "branch_id": branch_id})
        txns = await cursor.to_list(length=500)
        for t in txns:
            t.pop("_id", None)
    else:
        all_txns = db_manager.memory_store.get("transactions", {}).get(owner_id, [])
        txns = [t for t in all_txns if t.get("branch_id") == branch_id]

    revenue = sum(t["amount"] for t in txns if t.get("amount", 0) > 0)
    expenses = sum(abs(t["amount"]) for t in txns if t.get("amount", 0) < 0)
    net = revenue - expenses
    margin = round((net / revenue * 100), 1) if revenue > 0 else 0.0

    return {
        "branch_id": branch_id,
        "total_revenue": round(revenue, 2),
        "total_expenses": round(expenses, 2),
        "net_cash": round(net, 2),
        "gross_margin_percent": margin,
        "transaction_count": len(txns)
    }

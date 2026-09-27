"""
routers/business.py — Business Profile, Branches & Roles management.
Owner auto-assigned on registration. Sub-users can be created with scoped access.
Audit logs and notifications for team actions and branch assignments.
"""
import uuid
import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.database import db_manager, AxisDataStore
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
    role_name: str = Field(..., example="Sales Manager")
    permissions: List[str] = Field(default_factory=list,
        example=["dashboard", "inventory", "analytics", "transactions", "agent"])
    description: Optional[str] = None
    branch_id: Optional[str] = None  # restrict role to a specific branch

class RoleUpdate(BaseModel):
    role_name: Optional[str] = None
    permissions: Optional[List[str]] = None
    description: Optional[str] = None
    branch_id: Optional[str] = None

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
    status: Optional[str] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_user_context(current_user: dict):
    is_sub_user = bool(current_user.get("is_sub_user"))
    owner_id = current_user.get("owner_id") if is_sub_user else current_user["user_id"]
    branch_id = current_user.get("branch_id") if is_sub_user else None
    actor_id = current_user.get("user_id", "")
    actor_name = current_user.get("name", "User")
    actor_role = "Team Member" if is_sub_user else "Owner"
    return owner_id, branch_id, is_sub_user, actor_id, actor_name, actor_role


def require_business_owner(current_user: dict):
    if current_user.get("is_sub_user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the business owner has permission to perform this administrative action."
        )


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
    owner_id, user_branch, is_sub_user, *_ = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    if not doc:
        # Return empty scaffold
        doc = {
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
    
    # Sub-user isolation: if sub-user has a specific branch assigned, only return that branch
    if is_sub_user and user_branch:
        doc_copy = dict(doc)
        doc_copy["branches"] = [b for b in doc.get("branches", []) if b["id"] == user_branch]
        return doc_copy

    return doc


@router.put("/profile", response_model=Dict[str, Any])
async def update_business_profile(
    payload: BusinessProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
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

    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="business.update",
        title="Updated Business Profile",
        details=f"Updated: {', '.join(update.keys())}"
    )

    return doc


# ── Branches ──────────────────────────────────────────────────────────────────

@router.get("/branches", response_model=List[Dict[str, Any]])
async def list_branches(current_user: dict = Depends(get_current_user)):
    owner_id, user_branch, is_sub_user, *_ = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    branches = doc.get("branches", [])
    if not branches:
        # Every business starts with a primary main branch/HQ
        b_name = doc.get("business_name") or current_user.get("company") or "Main Store"
        main_branch = {
            "id": f"branch-main-{owner_id[:8]}",
            "owner_id": owner_id,
            "name": f"{b_name} (HQ)",
            "location": doc.get("location") or "Headquarters",
            "manager_user_id": owner_id,
            "phone": doc.get("phone", ""),
            "email": doc.get("email", current_user.get("email", "")),
            "is_active": True,
            "is_main": True,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        doc.setdefault("branches", []).append(main_branch)
        await save_business_doc(owner_id, doc)
        branches = [main_branch]

    # Scoped access: if a team member is assigned a specific branch, they see ONLY that branch
    if is_sub_user and user_branch:
        scoped = [b for b in branches if b["id"] == user_branch]
        return scoped if scoped else branches

    return branches


@router.post("/branches", response_model=Dict[str, Any], status_code=201)
async def create_branch(
    payload: BranchCreate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
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

    # 1. Log activity for owner and audit trail
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="branch.create",
        title=f"Created branch '{payload.name}'",
        details=f"Location: {payload.location or 'N/A'}",
        branch_id=branch["id"],
        branch_name=payload.name
    )

    # 2. In-app notification for owner
    await AxisDataStore.add_notification(
        recipient_id=owner_id,
        title="Branch Created",
        message=f"New business branch '{payload.name}' has been created successfully.",
        notif_type="branch_created",
        meta={"branch_id": branch["id"], "branch_name": payload.name}
    )

    # 3. Notification to the assigned manager if specified
    if payload.manager_user_id and payload.manager_user_id not in (owner_id, "owner"):
        await AxisDataStore.add_notification(
            recipient_id=payload.manager_user_id,
            title="Assigned Branch Manager",
            message=f"You have been appointed as Branch Manager for '{payload.name}'.",
            notif_type="branch_created",
            meta={"branch_id": branch["id"], "branch_name": payload.name}
        )

    return branch


@router.put("/branches/{branch_id}", response_model=Dict[str, Any])
async def update_branch(
    branch_id: str,
    payload: BranchUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    branches = doc.get("branches", [])
    for i, b in enumerate(branches):
        if b["id"] == branch_id:
            old_manager = branches[i].get("manager_user_id")
            branches[i].update({k: v for k, v in payload.model_dump().items() if v is not None})
            branches[i]["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            doc["branches"] = branches
            await save_business_doc(owner_id, doc)

            # Audit log
            await AxisDataStore.log_activity(
                owner_id=owner_id,
                actor_id=actor_id,
                actor_name=actor_name,
                actor_role=actor_role,
                action="branch.update",
                title=f"Updated branch '{branches[i]['name']}'",
                details=f"Modifications: {', '.join(payload.model_dump(exclude_none=True).keys())}",
                branch_id=branch_id,
                branch_name=branches[i]["name"]
            )

            # Notify new manager if manager changed
            new_manager = branches[i].get("manager_user_id")
            if new_manager and new_manager != old_manager and new_manager not in (owner_id, "owner"):
                await AxisDataStore.add_notification(
                    recipient_id=new_manager,
                    title="Branch Assignment Updated",
                    message=f"You are now assigned as Manager for '{branches[i]['name']}'.",
                    notif_type="branch_created",
                    meta={"branch_id": branch_id, "branch_name": branches[i]["name"]}
                )

            return branches[i]
    raise HTTPException(status_code=404, detail="Branch not found")


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, current_user: dict = Depends(get_current_user)):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    target = next((b for b in doc.get("branches", []) if b["id"] == branch_id), None)
    doc["branches"] = [b for b in doc.get("branches", []) if b["id"] != branch_id]
    await save_business_doc(owner_id, doc)

    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="branch.delete",
        title=f"Deleted branch '{target.get('name', branch_id) if target else branch_id}'",
        details=f"Branch ID: {branch_id}",
        branch_id=branch_id
    )

    return {"status": "deleted", "branch_id": branch_id}


# ── Roles ─────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=List[Dict[str, Any]])
async def list_roles(current_user: dict = Depends(get_current_user)):
    owner_id, _, _, *_ = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    custom_roles = doc.get("roles", [])
    if not custom_roles:
        # Seed an initial editable Manager role
        initial_role = {
            "id": f"role-{uuid.uuid4().hex[:8]}",
            "role_name": "Store Manager",
            "permissions": ["dashboard", "inventory", "analytics", "transactions", "agent", "activities"],
            "description": "Operational access to branch inventory, ledger, analytics, and activities.",
            "branch_id": None,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        doc["roles"] = [initial_role]
        await save_business_doc(owner_id, doc)
        return [initial_role]
    return custom_roles


@router.post("/roles", response_model=Dict[str, Any], status_code=201)
async def create_role(
    payload: RoleCreate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
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

    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="role.create",
        title=f"Created role '{payload.role_name}'",
        details=f"Permissions: {', '.join(payload.permissions)}",
        branch_id=payload.branch_id
    )

    return role


@router.put("/roles/{role_id}", response_model=Dict[str, Any])
async def update_role(
    role_id: str,
    payload: RoleUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    roles = doc.get("roles", [])
    for i, r in enumerate(roles):
        if r["id"] == role_id:
            roles[i].update({k: v for k, v in payload.model_dump().items() if v is not None})
            roles[i]["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            doc["roles"] = roles
            await save_business_doc(owner_id, doc)

            await AxisDataStore.log_activity(
                owner_id=owner_id,
                actor_id=actor_id,
                actor_name=actor_name,
                actor_role=actor_role,
                action="role.update",
                title=f"Updated role '{roles[i]['role_name']}'",
                details=f"Updated permissions or configuration"
            )

            return roles[i]
    raise HTTPException(status_code=404, detail="Role not found")


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(get_current_user)):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    target = next((r for r in doc.get("roles", []) if r["id"] == role_id), None)
    role_name = target.get("role_name", role_id) if target else role_id

    doc["roles"] = [r for r in doc.get("roles", []) if r["id"] != role_id]

    # Clean up any team members that had this role
    reassigned_count = 0
    for u in doc.get("sub_users", []):
        if u.get("role_id") == role_id:
            u["role_id"] = None
            reassigned_count += 1
            if db_manager.is_connected:
                await db_manager.db.users.update_one({"user_id": u["id"]}, {"$set": {"role_id": None}})
            else:
                for u_data in db_manager.memory_store.get("users", {}).values():
                    if u_data.get("user_id") == u["id"]:
                        u_data["role_id"] = None

    await save_business_doc(owner_id, doc)

    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="role.delete",
        title=f"Deleted role '{role_name}'",
        details=f"Role ID: {role_id}. {reassigned_count} team member(s) unassigned." if reassigned_count else f"Role ID: {role_id}"
    )

    await AxisDataStore.add_notification(
        recipient_id=owner_id,
        title="Role Deleted",
        message=f"Custom role '{role_name}' has been deleted.",
        notif_type="system"
    )

    return {"status": "deleted", "role_id": role_id}


# ── Sub-Users / Team Members ──────────────────────────────────────────────────

@router.get("/team", response_model=List[Dict[str, Any]])
async def list_team(current_user: dict = Depends(get_current_user)):
    owner_id, _, is_sub_user, *_ = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    sub_users = doc.get("sub_users", [])
    if is_sub_user:
        # Team members can only see their own profile
        return [u for u in sub_users if u.get("id") == current_user.get("user_id") or u.get("email") == current_user.get("email")]
    return sub_users


@router.post("/team", response_model=Dict[str, Any], status_code=201)
async def create_sub_user(
    payload: SubUserCreate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
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

    # Register in users collection with email_verified=True so login works smoothly
    user_doc = {
        "user_id": sub_user["id"],
        "name": payload.name,
        "email": payload.email,
        "hashed_password": hashed_pw,
        "email_verified": True,
        "is_verified": True,
        "is_sub_user": True,
        "owner_id": owner_id,
        "role_id": payload.role_id,
        "branch_id": payload.branch_id,
        "must_change_password": True,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    if db_manager.is_connected:
        existing_user = await db_manager.db.users.find_one({"email": payload.email})
        if not existing_user:
            await db_manager.db.users.insert_one(user_doc)
    else:
        if "users" not in db_manager.memory_store:
            db_manager.memory_store["users"] = {}
        db_manager.memory_store["users"][payload.email] = user_doc

    doc.setdefault("sub_users", []).append(sub_user)
    await save_business_doc(owner_id, doc)

    # Resolve Role & Branch names for notifications & logs
    role_obj = next((r for r in doc.get("roles", []) if r["id"] == payload.role_id), None)
    role_title = role_obj["role_name"] if role_obj else "Team Member"
    branch_obj = next((b for b in doc.get("branches", []) if b["id"] == payload.branch_id), None)
    branch_title = branch_obj["name"] if branch_obj else "All Branches"

    # 1. Log Activity in business audit trail
    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="team.add",
        title=f"Added team member {payload.name}",
        details=f"Appointed as {role_title} for {branch_title} ({payload.email})",
        branch_id=payload.branch_id,
        branch_name=branch_title
    )

    # 2. In-app notification for the Owner
    await AxisDataStore.add_notification(
        recipient_id=owner_id,
        title="Role Assigned",
        message=f"{payload.name} appointed as '{role_title}' at {branch_title}.",
        notif_type="role_assigned",
        meta={"user_name": payload.name, "role_name": role_title, "branch_name": branch_title}
    )

    # 3. In-app notification for the newly appointed Team Member
    await AxisDataStore.add_notification(
        recipient_id=sub_user["id"],
        title="Welcome to Axis Black!",
        message=f"You have been assigned the role '{role_title}' for {branch_title}. Your temporary login password is your email.",
        notif_type="role_assigned",
        meta={"role_name": role_title, "branch_name": branch_title, "branch_id": payload.branch_id}
    )

    # 4. Role-tailored onboarding email to the appointed team member
    company_name = doc.get("profile", {}).get("company_name") or current_user.get("company") or "Axis Black Workspace"
    try:
        from app.services.email_service import send_team_invitation_email
        send_team_invitation_email(
            to_email=payload.email,
            user_name=payload.name,
            role_name=role_title,
            company_name=company_name,
            branch_name=branch_title,
            permissions=role_obj.get("permissions", []) if role_obj else [],
            temp_password=temp_password
        )
    except Exception as e:
        logger.warning(f"Failed to send onboarding email to {payload.email}: {e}")

    return {k: v for k, v in sub_user.items() if k != "hashed_password"}


@router.put("/team/{user_id}", response_model=Dict[str, Any])
async def update_sub_user(
    user_id: str,
    payload: SubUserUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    sub_users = doc.get("sub_users", [])
    company_name = doc.get("profile", {}).get("company_name") or current_user.get("company") or "Axis Black Workspace"

    for i, u in enumerate(sub_users):
        if u["id"] == user_id:
            old_role_id = sub_users[i].get("role_id")
            old_branch_id = sub_users[i].get("branch_id")
            old_is_active = sub_users[i].get("is_active", True)
            
            update = {k: v for k, v in payload.model_dump().items() if v is not None}
            if "is_active" in update:
                update["status"] = "active" if update["is_active"] else "suspended"
            elif "status" in update:
                update["is_active"] = (update["status"] != "suspended")

            sub_users[i].update(update)
            sub_users[i]["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            doc["sub_users"] = sub_users
            await save_business_doc(owner_id, doc)

            # Also update user document in users collection / memory store
            if db_manager.is_connected:
                await db_manager.db.users.update_one(
                    {"$or": [{"user_id": user_id}, {"email": sub_users[i].get("email")}]},
                    {"$set": {k: v for k, v in update.items() if k in ["name", "role_id", "branch_id", "is_active", "status"]}}
                )
            else:
                for k_email, u_data in db_manager.memory_store.get("users", {}).items():
                    if u_data.get("user_id") == user_id or u_data.get("email") == sub_users[i].get("email"):
                        u_data.update(update)

            # Resolve names
            role_obj = next((r for r in doc.get("roles", []) if r["id"] == sub_users[i].get("role_id")), None)
            role_title = role_obj["role_name"] if role_obj else "Team Member"
            branch_obj = next((b for b in doc.get("branches", []) if b["id"] == sub_users[i].get("branch_id")), None)
            branch_title = branch_obj["name"] if branch_obj else "All Branches"

            # Handle suspension & activation events specifically
            if update.get("is_active") is False and old_is_active:
                await AxisDataStore.log_activity(
                    owner_id=owner_id,
                    actor_id=actor_id,
                    actor_name=actor_name,
                    actor_role=actor_role,
                    action="team.suspend",
                    title=f"Suspended team member {sub_users[i]['name']}",
                    details=f"Account suspended by business owner.",
                    branch_id=sub_users[i].get("branch_id"),
                    branch_name=branch_title
                )
                await AxisDataStore.add_notification(
                    recipient_id=owner_id,
                    title="Team Member Suspended",
                    message=f"{sub_users[i]['name']} ({sub_users[i]['email']}) has been suspended from the workspace.",
                    notif_type="system"
                )
                await AxisDataStore.add_notification(
                    recipient_id=user_id,
                    title="Account Suspended",
                    message="Your team account has been suspended by the business owner. Please contact your administrator.",
                    notif_type="system"
                )
                try:
                    from app.services.email_service import send_team_status_email
                    send_team_status_email(
                        to_email=sub_users[i]["email"],
                        user_name=sub_users[i]["name"],
                        company_name=company_name,
                        is_suspended=True
                    )
                except Exception as e:
                    logger.warning(f"Failed to send suspension email: {e}")

            elif update.get("is_active") is True and not old_is_active:
                await AxisDataStore.log_activity(
                    owner_id=owner_id,
                    actor_id=actor_id,
                    actor_name=actor_name,
                    actor_role=actor_role,
                    action="team.activate",
                    title=f"Re-activated team member {sub_users[i]['name']}",
                    details=f"Account re-activated by business owner.",
                    branch_id=sub_users[i].get("branch_id"),
                    branch_name=branch_title
                )
                await AxisDataStore.add_notification(
                    recipient_id=owner_id,
                    title="Team Member Re-activated",
                    message=f"{sub_users[i]['name']} ({sub_users[i]['email']}) has been re-activated.",
                    notif_type="system"
                )
                await AxisDataStore.add_notification(
                    recipient_id=user_id,
                    title="Account Re-activated",
                    message="Your team account has been re-activated by the business owner. You may now resume your tasks.",
                    notif_type="system"
                )
                try:
                    from app.services.email_service import send_team_status_email
                    send_team_status_email(
                        to_email=sub_users[i]["email"],
                        user_name=sub_users[i]["name"],
                        company_name=company_name,
                        is_suspended=False
                    )
                except Exception as e:
                    logger.warning(f"Failed to send reactivation email: {e}")
            else:
                # General update audit log
                await AxisDataStore.log_activity(
                    owner_id=owner_id,
                    actor_id=actor_id,
                    actor_name=actor_name,
                    actor_role=actor_role,
                    action="team.update",
                    title=f"Updated team member {sub_users[i]['name']}",
                    details=f"Current assignment: {role_title} at {branch_title}",
                    branch_id=sub_users[i].get("branch_id"),
                    branch_name=branch_title
                )

            # If role or branch changed, notify the team member
            if update.get("role_id") != old_role_id or update.get("branch_id") != old_branch_id:
                await AxisDataStore.add_notification(
                    recipient_id=user_id,
                    title="Role & Branch Updated",
                    message=f"Your assignment has been updated to '{role_title}' at {branch_title}.",
                    notif_type="role_assigned",
                    meta={"role_name": role_title, "branch_name": branch_title}
                )
                await AxisDataStore.add_notification(
                    recipient_id=owner_id,
                    title="Team Assignment Updated",
                    message=f"Updated role for {sub_users[i]['name']}: {role_title} ({branch_title}).",
                    notif_type="role_assigned",
                    meta={"role_name": role_title, "branch_name": branch_title}
                )
                try:
                    from app.services.email_service import send_team_role_update_email
                    send_team_role_update_email(
                        to_email=sub_users[i]["email"],
                        user_name=sub_users[i]["name"],
                        new_role_name=role_title,
                        company_name=company_name,
                        branch_name=branch_title,
                        permissions=role_obj.get("permissions", []) if role_obj else []
                    )
                except Exception as e:
                    logger.warning(f"Failed to send role update email: {e}")

            return {k: v for k, v in sub_users[i].items() if k != "hashed_password"}
    raise HTTPException(status_code=404, detail="Team member not found")


@router.delete("/team/{user_id}")
async def delete_sub_user(user_id: str, current_user: dict = Depends(get_current_user)):
    require_business_owner(current_user)
    owner_id, _, _, actor_id, actor_name, actor_role = get_user_context(current_user)
    doc = await get_business_doc(owner_id)
    target = next((u for u in doc.get("sub_users", []) if u["id"] == user_id), None)
    target_name = target.get("name", user_id) if target else user_id
    target_email = target.get("email") if target else None

    # Remove from business doc sub_users list
    doc["sub_users"] = [u for u in doc.get("sub_users", []) if u["id"] != user_id]

    # Clean up any branch manager assignments pointing to this user
    for b in doc.get("branches", []):
        if b.get("manager_user_id") == user_id:
            b["manager_user_id"] = None

    await save_business_doc(owner_id, doc)

    # Mark user as deleted in users collection so they cannot log in and are informed accordingly
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    deletion_update = {
        "is_deleted": True,
        "is_active": False,
        "status": "deleted",
        "deleted_at": now_str
    }
    if db_manager.is_connected:
        await db_manager.db.users.update_one(
            {"$or": [{"user_id": user_id}, {"email": target_email}]},
            {"$set": deletion_update}
        )
    else:
        for k_key, u_data in list(db_manager.memory_store.get("users", {}).items()):
            if u_data.get("user_id") == user_id or (target_email and u_data.get("email") == target_email):
                u_data.update(deletion_update)

    await AxisDataStore.log_activity(
        owner_id=owner_id,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action="team.delete",
        title=f"Removed team member {target_name}",
        details=f"Account deleted by owner. Email: {target_email or user_id}"
    )

    await AxisDataStore.add_notification(
        recipient_id=owner_id,
        title="Team Member Removed",
        message=f"{target_name} ({target_email or user_id}) has been removed from your business workspace.",
        notif_type="system"
    )

    return {"status": "deleted", "user_id": user_id}


# ── Activities Audit Log Endpoint ─────────────────────────────────────────────

@router.get("/activities", response_model=List[Dict[str, Any]])
async def get_business_activities(
    branch_id: Optional[str] = None,
    limit: int = 150,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns audit logs of all actions performed across the business.
    Owner gets complete business oversight. Sub-users see only their assigned branch logs.
    """
    owner_id, user_branch, is_sub_user, *_ = get_user_context(current_user)
    if is_sub_user:
        perms = current_user.get("permissions") or []
        if "activities" not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Your assigned role has not been granted the 'activities' privilege."
            )
    target_branch = user_branch if is_sub_user else branch_id
    return await AxisDataStore.get_activities(owner_id, target_branch, limit=limit)


# ── Notifications Endpoints ───────────────────────────────────────────────────

@router.get("/notifications", response_model=List[Dict[str, Any]])
async def get_user_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Returns in-app notifications for the logged in user."""
    user_id = current_user.get("user_id", "")
    return await AxisDataStore.get_notifications(user_id, limit=limit)


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id", "")
    await AxisDataStore.mark_notification_read(user_id, notif_id)
    return {"status": "ok", "id": notif_id}


# ── Branch Performance & Details ──────────────────────────────────────────────

@router.get("/branches/{branch_id}/performance", response_model=Dict[str, Any])
async def get_branch_performance(
    branch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns aggregate financial metrics for a specific branch."""
    owner_id, user_branch, is_sub_user, *_ = get_user_context(current_user)
    if is_sub_user and user_branch and user_branch != branch_id:
        raise HTTPException(status_code=403, detail="Access denied: You can only view metrics for your assigned branch.")

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


@router.get("/branches/{branch_id}/details", response_model=Dict[str, Any])
async def get_branch_details(
    branch_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns full branch information:
    - branch profile
    - manager details (Owner or sub-user)
    - financial performance metrics
    - branch ledger transactions
    - branch inventory items
    """
    owner_id, user_branch, is_sub_user, *_ = get_user_context(current_user)
    if is_sub_user and user_branch and user_branch != branch_id:
        raise HTTPException(status_code=403, detail="Access denied: You can only view details for your assigned branch.")

    doc = await get_business_doc(owner_id)
    branches = doc.get("branches", [])
    branch = next((b for b in branches if b["id"] == branch_id), None)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Manager resolution (Owner can assign themselves!)
    manager_id = branch.get("manager_user_id")
    manager_info = None
    if manager_id:
        if manager_id in (owner_id, "owner"):
            manager_info = {
                "id": owner_id,
                "name": current_user.get("name", "Owner"),
                "email": current_user.get("email", ""),
                "is_owner": True,
                "role": "Owner"
            }
        else:
            team_member = next((u for u in doc.get("sub_users", []) if u["id"] == manager_id), None)
            if team_member:
                manager_info = {
                    "id": team_member["id"],
                    "name": team_member["name"],
                    "email": team_member["email"],
                    "is_owner": False,
                    "role": "Manager"
                }

    # Fetch branch transactions
    if db_manager.is_connected:
        cursor = db_manager.db.transactions.find({"user_id": owner_id, "branch_id": branch_id})
        txns = await cursor.to_list(length=200)
        for t in txns:
            t.pop("_id", None)
    else:
        all_txns = db_manager.memory_store.get("transactions", {}).get(owner_id, [])
        txns = [t for t in all_txns if t.get("branch_id") == branch_id]

    revenue = sum(t["amount"] for t in txns if t.get("amount", 0) > 0)
    expenses = sum(abs(t["amount"]) for t in txns if t.get("amount", 0) < 0)
    net = revenue - expenses
    margin = round((net / revenue * 100), 1) if revenue > 0 else 0.0

    # Fetch branch inventory
    inventory_items = await AxisDataStore.get_inventory(owner_id)
    branch_inventory = [i for i in inventory_items if i.get("branch_id") == branch_id]
    inv_valuation = sum(float(i.get("stock_quantity", 0)) * float(i.get("unit_cost", 0)) for i in branch_inventory)

    return {
        "branch": branch,
        "manager": manager_info,
        "performance": {
            "branch_id": branch_id,
            "total_revenue": round(revenue, 2),
            "total_expenses": round(expenses, 2),
            "net_cash": round(net, 2),
            "gross_margin_percent": margin,
            "transaction_count": len(txns),
            "inventory_count": len(branch_inventory),
            "inventory_valuation": round(inv_valuation, 2)
        },
        "transactions": txns[:50],
        "inventory": branch_inventory[:50]
    }

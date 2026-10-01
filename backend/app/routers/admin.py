"""
admin.py — Complete Administration Platform API Router for Axis Black.
Provides:
  - Admin Authentication (Argon2id + JWT) & Profile Settings
  - Client Traffic Recording, Device Telemetry & IP Geolocation Resolution
  - Real-time Live Session Monitoring (with WebSocket broadcast)
  - Platform KPIs & Traffic Analytics
  - User Directory Management & Detailed User Inspector
  - System Audit Logging
  - Database Collection Explorer & Data Exporter
  - System Broadcasts & Administrator Alerts
"""

from __future__ import annotations
import os
import re
import uuid
import datetime
import logging
from typing import Optional, List, Dict, Any

from fastapi import (
    APIRouter, Depends, HTTPException, status, Request,
    BackgroundTasks, Query, WebSocket, WebSocketDisconnect
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import httpx
from jose import JWTError, jwt
from bson import ObjectId

from app.config import settings
from app.database import db_manager, AxisDataStore

logger = logging.getLogger("axis_black.admin")

router = APIRouter(prefix="/api/admin", tags=["Admin Platform"])

# ── Admin Security Config (from backend .env via app.config.settings) ──
ADMIN_JWT_SECRET = settings.ADMIN_JWT_SECRET or "axis-black-super-secure-admin-secret-2026"
ADMIN_JWT_ALGORITHM = "HS256"
ADMIN_JWT_HOURS = settings.ADMIN_JWT_EXPIRE_HOURS or 72
ADMIN_INVITE_CODE = (settings.ADMIN_INVITE_CODE or "").strip()

admin_bearer = HTTPBearer(auto_error=False)

# Password hashing with argon2 or hashlib fallback
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
    _ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)

    def hash_password(pw: str) -> str:
        return _ph.hash(pw)

    def verify_password(plain: str, hashed: str) -> bool:
        try:
            return _ph.verify(hashed, plain)
        except Exception:
            return False
except Exception:
    import hashlib
    def hash_password(pw: str) -> str:
        salt = uuid.uuid4().hex[:16]
        h = hashlib.sha256((salt + pw).encode('utf-8')).hexdigest()
        return f"sha256${salt}${h}"

    def verify_password(plain: str, hashed: str) -> bool:
        if hashed.startswith("sha256$"):
            _, salt, h = hashed.split("$")
            return hashlib.sha256((salt + plain).encode('utf-8')).hexdigest() == h
        return plain == hashed

def create_admin_token(admin_id: str, email: str, role: str) -> str:
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=ADMIN_JWT_HOURS)
    return jwt.encode(
        {"sub": admin_id, "email": email, "role": role, "type": "admin", "exp": exp},
        ADMIN_JWT_SECRET,
        algorithm=ADMIN_JWT_ALGORITHM
    )

def decode_admin_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[ADMIN_JWT_ALGORITHM])
        if payload.get("type") != "admin":
            return None
        return payload
    except JWTError:
        return None

# ── Geo Cache ──
_geo_cache: Dict[str, Dict[str, Any]] = {}

async def _resolve_geo(ip: str) -> Dict[str, Any]:
    if not ip or ip in ('127.0.0.1', '::1', 'localhost', '0.0.0.0', ''):
        return {"city": "Local Dev", "country": "Local", "regionName": "Local"}
    if ip in _geo_cache:
        return _geo_cache[ip]
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,city,country,regionName,query,lat,lon,timezone"}
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "success":
                    _geo_cache[ip] = data
                    return data
    except Exception:
        pass
    return {}

# ── WebSocket Manager for Live Monitor ──
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, admin_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[admin_id] = websocket

    def disconnect(self, admin_id: str):
        self.active_connections.pop(admin_id, None)

    async def broadcast(self, message: Dict[str, Any]):
        dead = []
        for aid, ws in self.active_connections.items():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(aid)
        for aid in dead:
            self.disconnect(aid)

ws_manager = ConnectionManager()

# ── Default Admin Provisioning ──
async def ensure_default_admin():
    """Ensure root admin exists if configured in backend .env."""
    try:
        default_email = (settings.ADMIN_DEFAULT_EMAIL or "").strip().lower()
        default_pass = (settings.ADMIN_DEFAULT_PASSWORD or "").strip()
        default_name = (settings.ADMIN_DEFAULT_NAME or "Axis Administrator").strip()

        if not default_email or not default_pass:
            # No default admin credentials configured in backend .env
            return

        if db_manager.is_connected and db_manager.db is not None:
            existing = await db_manager.db.admins.find_one({"email": default_email})
            if not existing:
                await db_manager.db.admins.insert_one({
                    "id": "admin-root-001",
                    "name": default_name,
                    "email": default_email,
                    "password_hash": hash_password(default_pass),
                    "role": "superadmin",
                    "status": "active",
                    "theme": "dark",
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                })
                logger.info(f"Initialized root admin from backend .env: {default_email}")
        else:
            if "admins" not in db_manager.memory_store:
                db_manager.memory_store["admins"] = {}
            if default_email not in db_manager.memory_store["admins"]:
                db_manager.memory_store["admins"][default_email] = {
                    "id": "admin-root-001",
                    "name": default_name,
                    "email": default_email,
                    "password_hash": hash_password(default_pass),
                    "role": "superadmin",
                    "status": "active",
                    "theme": "dark",
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                db_manager.save_memory_store()
                logger.info(f"Initialized local memory root admin from backend .env: {default_email}")
    except Exception as e:
        logger.warning(f"Could not bootstrap default admin: {e}")

# ── Authentication Dependency ──
async def get_current_admin(
    req: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(admin_bearer)
) -> Dict[str, Any]:
    token = creds.credentials if creds else req.query_params.get("token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin authentication required")
    payload = decode_admin_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired admin token")
    aid = payload.get("sub")
    email = payload.get("email")

    admin = None
    if db_manager.is_connected and db_manager.db is not None:
        admin = await db_manager.db.admins.find_one({"$or": [{"id": aid}, {"email": email}]})
        if admin:
            admin.pop("_id", None)
    else:
        admins = db_manager.memory_store.get("admins", {})
        admin = admins.get(email) or next((a for a in admins.values() if a.get("id") == aid), None)

    if not admin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin account not found")
    if admin.get("status") != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin account is not active")

    return admin

# ── Pydantic Schemas ──
class AdminLoginReq(BaseModel):
    email: str
    password: str

class AdminRegisterReq(BaseModel):
    name: str
    email: str
    password: str
    invite_code: str
    phone: Optional[str] = None

class AdminProfileReq(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    theme: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class CaptureEventReq(BaseModel):
    user_id: Optional[str] = None
    visitor_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    event: str = "page_view"
    page: str = "/"
    data: Optional[Dict[str, Any]] = None
    device: Optional[str] = None
    device_type: Optional[str] = "Desktop"
    browser: Optional[str] = None
    os: Optional[str] = None
    ua: Optional[str] = None
    screen_resolution: Optional[str] = None
    timezone: Optional[str] = None
    local_time: Optional[str] = None
    local_date: Optional[str] = None
    local_datetime_iso: Optional[str] = None
    ip: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    location: Optional[str] = None
    referrer: Optional[str] = None

class AdminActionReq(BaseModel):
    action: str
    value: Optional[str] = None
    reason: Optional[str] = None

class BroadcastMsgReq(BaseModel):
    title: str
    message: str
    type: str = "info"
    target: str = "all"


# ── AUTH ENDPOINTS ──

@router.post("/auth/login")
async def admin_login(body: AdminLoginReq):
    await ensure_default_admin()
    email = body.email.strip().lower()
    admin = None
    if db_manager.is_connected and db_manager.db is not None:
        admin = await db_manager.db.admins.find_one({"email": email})
        if admin:
            admin.pop("_id", None)
    else:
        admin = db_manager.memory_store.get("admins", {}).get(email)

    if not admin or not verify_password(body.password, admin.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin credentials")
    if admin.get("status") != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin account suspended")

    token = create_admin_token(admin["id"], admin["email"], admin.get("role", "admin"))
    return {
        "success": True,
        "token": token,
        "admin": {
            "id": admin["id"],
            "name": admin.get("name", "Admin"),
            "email": admin["email"],
            "role": admin.get("role", "admin"),
            "theme": admin.get("theme", "dark"),
            "phone": admin.get("phone")
        }
    }

@router.post("/auth/register")
async def admin_register(body: AdminRegisterReq):
    await ensure_default_admin()
    configured_invite = (settings.ADMIN_INVITE_CODE or "").strip().lower()
    provided_invite = body.invite_code.strip().lower()

    if not configured_invite or provided_invite != configured_invite:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired admin invite code")

    email = body.email.strip().lower()
    if db_manager.is_connected and db_manager.db is not None:
        existing = await db_manager.db.admins.find_one({"email": email})
        if existing:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admin email already exists")
    else:
        if email in db_manager.memory_store.get("admins", {}):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admin email already exists")

    admin_id = f"admin-{uuid.uuid4().hex[:10]}"
    doc = {
        "id": admin_id,
        "name": body.name.strip(),
        "email": email,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "role": "admin",
        "status": "active",
        "theme": "dark",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admins.insert_one(doc)
    else:
        if "admins" not in db_manager.memory_store:
            db_manager.memory_store["admins"] = {}
        db_manager.memory_store["admins"][email] = doc
        db_manager.save_memory_store()

    token = create_admin_token(admin_id, email, "admin")
    return {
        "success": True,
        "token": token,
        "admin": {
            "id": admin_id,
            "name": doc["name"],
            "email": email,
            "role": "admin",
            "theme": "dark"
        }
    }

@router.get("/auth/me")
async def admin_me(admin: Dict[str, Any] = Depends(get_current_admin)):
    return {
        "success": True,
        "admin": {
            "id": admin["id"],
            "name": admin.get("name", "Admin"),
            "email": admin["email"],
            "role": admin.get("role", "admin"),
            "theme": admin.get("theme", "dark"),
            "phone": admin.get("phone")
        }
    }

@router.put("/auth/profile")
async def update_admin_profile(
    body: AdminProfileReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    updates: Dict[str, Any] = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.phone is not None:
        updates["phone"] = body.phone.strip()
    if body.theme is not None:
        updates["theme"] = body.theme

    if body.new_password:
        if not body.current_password or not verify_password(body.current_password, admin.get("password_hash", "")):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password incorrect")
        updates["password_hash"] = hash_password(body.new_password)

    if updates:
        if db_manager.is_connected and db_manager.db is not None:
            await db_manager.db.admins.update_one({"id": admin["id"]}, {"$set": updates})
        else:
            if admin["email"] in db_manager.memory_store.get("admins", {}):
                db_manager.memory_store["admins"][admin["email"]].update(updates)
                db_manager.save_memory_store()

    return {"success": True, "message": "Admin profile updated"}


# ── CAPTURE & TELEMETRY (Called by user frontend) ──

@router.post("/capture")
async def capture_traffic_event(
    body: CaptureEventReq,
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Captures user page navigations, action telemetry, local device date/time,
    and resolves client IP geolocation.
    """
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else "")
    )

    async def _process_capture():
        try:
            now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
            resolved_city = body.city or ""
            resolved_country = body.country or ""
            resolved_loc = body.location or ""

            if client_ip and (not resolved_city or resolved_city == "Unknown"):
                geo = await _resolve_geo(client_ip)
                resolved_city = geo.get("city", "")
                resolved_country = geo.get("country", "")
                resolved_loc = ", ".join(filter(None, [resolved_city, resolved_country]))

            identifier = body.user_id or body.visitor_id or f"ip_{client_ip}"

            session_record = {
                "identifier": identifier,
                "user_id": body.user_id,
                "visitor_id": body.visitor_id,
                "user_email": body.user_email,
                "user_name": body.user_name,
                "current_page": body.page,
                "last_seen": now_utc,
                "device": body.device,
                "device_type": body.device_type,
                "browser": body.browser,
                "os": body.os,
                "screen_resolution": body.screen_resolution,
                "timezone": body.timezone,
                "local_time": body.local_time,
                "local_date": body.local_date,
                "local_datetime_iso": body.local_datetime_iso,
                "ip": client_ip or body.ip,
                "city": resolved_city,
                "country": resolved_country,
                "location": resolved_loc,
                "referrer": body.referrer,
                "event": body.event
            }

            event_record = {
                "id": f"ev-{uuid.uuid4().hex[:12]}",
                "timestamp": now_utc,
                **session_record
            }

            if db_manager.is_connected and db_manager.db is not None:
                # Upsert active live session
                await db_manager.db.live_sessions.update_one(
                    {"identifier": identifier},
                    {"$set": session_record, "$push": {"events": {"$each": [{"e": body.event, "p": body.page, "t": now_utc}], "$slice": -25}}},
                    upsert=True
                )
                # Store historical traffic event
                await db_manager.db.traffic_events.insert_one(event_record)

                # Update user record last seen info if logged in
                if body.user_id:
                    await db_manager.db.users.update_one(
                        {"$or": [{"user_id": body.user_id}, {"id": body.user_id}]},
                        {"$set": {
                            "last_seen": now_utc,
                            "last_device": body.device,
                            "last_location": resolved_loc,
                            "last_ip": client_ip,
                            "last_local_time": body.local_time,
                            "timezone": body.timezone
                        }}
                    )
            else:
                # Local memory fallback
                if "live_sessions" not in db_manager.memory_store:
                    db_manager.memory_store["live_sessions"] = {}
                db_manager.memory_store["live_sessions"][identifier] = session_record

                if "traffic_events" not in db_manager.memory_store:
                    db_manager.memory_store["traffic_events"] = []
                db_manager.memory_store["traffic_events"].insert(0, event_record)
                if len(db_manager.memory_store["traffic_events"]) > 500:
                    db_manager.memory_store["traffic_events"] = db_manager.memory_store["traffic_events"][:500]

                if body.user_id:
                    users = db_manager.memory_store.get("users", {})
                    for u in users.values():
                        if u.get("user_id") == body.user_id or u.get("id") == body.user_id:
                            u["last_seen"] = now_utc
                            u["last_device"] = body.device
                            u["last_location"] = resolved_loc
                            u["last_ip"] = client_ip
                            u["last_local_time"] = body.local_time
                            u["timezone"] = body.timezone
                db_manager.save_memory_store()

            # Broadcast to connected admin live monitors
            await ws_manager.broadcast({
                "type": "traffic_event",
                "identifier": identifier,
                "user_name": body.user_name or "Visitor",
                "user_email": body.user_email,
                "event": body.event,
                "page": body.page,
                "device": body.device,
                "location": resolved_loc,
                "city": resolved_city,
                "country": resolved_country,
                "ip": client_ip or body.ip,
                "local_time": body.local_time,
                "timestamp": now_utc
            })
        except Exception as e:
            logger.warning(f"Error handling capture event: {e}")

    background_tasks.add_task(_process_capture)
    return {"success": True}

@router.post("/track")
@router.post("/register")
async def capture_traffic_compat(
    body: CaptureEventReq,
    request: Request,
    background_tasks: BackgroundTasks
):
    return await capture_traffic_event(body, request, background_tasks)


# ── LIVE MONITOR & REAL-TIME WEBSOCKET ──

@router.get("/live-sessions")
async def get_live_sessions(admin: Dict[str, Any] = Depends(get_current_admin)):
    """Returns sessions active within the last 15 minutes."""
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=15)).isoformat()
    sessions = []
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.live_sessions.find({"last_seen": {"$gte": cutoff}}).sort("last_seen", -1).to_list(length=100)
        sessions = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
    else:
        all_s = list(db_manager.memory_store.get("live_sessions", {}).values())
        sessions = [s for s in all_s if s.get("last_seen", "") >= cutoff]
        sessions.sort(key=lambda s: s.get("last_seen", ""), reverse=True)

    return {"success": True, "data": sessions, "count": len(sessions)}

@router.get("/traffic/events")
async def get_traffic_events(
    limit: int = 50,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    events = []
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.traffic_events.find().sort("timestamp", -1).to_list(length=limit)
        events = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
    else:
        events = db_manager.memory_store.get("traffic_events", [])[:limit]
    return {"success": True, "data": events}

@router.websocket("/ws/{admin_id}")
async def admin_websocket(websocket: WebSocket, admin_id: str, token: Optional[str] = Query(None)):
    if not token or not decode_admin_token(token):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await ws_manager.connect(admin_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "admin_id": admin_id})
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(admin_id)
    except Exception:
        ws_manager.disconnect(admin_id)


# ── DASHBOARD STATS ──

@router.get("/stats")
async def get_admin_dashboard_stats(admin: Dict[str, Any] = Depends(get_current_admin)):
    """Computes real-time platform statistics."""
    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - datetime.timedelta(days=7)).isoformat()
    active_cutoff = (now - datetime.timedelta(minutes=5)).isoformat()

    total_users = 0
    active_today = 0
    online_now = 0
    new_this_week = 0
    total_txns = 0
    total_volume = 0.0
    total_sheets = 0
    total_inventory = 0

    device_counts = {"Desktop": 0, "Mobile": 0, "Tablet": 0}

    if db_manager.is_connected and db_manager.db is not None:
        total_users = await db_manager.db.users.count_documents({})
        new_this_week = await db_manager.db.users.count_documents({"created_at": {"$gte": week_start}})
        online_now = await db_manager.db.live_sessions.count_documents({"last_seen": {"$gte": active_cutoff}})
        active_today = await db_manager.db.traffic_events.distinct("identifier", {"timestamp": {"$gte": today_start}})
        active_today_count = len(active_today)
        total_txns = await db_manager.db.transactions.count_documents({})
        total_sheets = await db_manager.db.spreadsheets.count_documents({})
        total_inventory = await db_manager.db.inventory.count_documents({})

        # Total transaction volume
        pipeline = [{"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}]
        agg = await db_manager.db.transactions.aggregate(pipeline).to_list(1)
        if agg:
            total_volume = agg[0].get("total", 0.0)

        # Device breakdown
        dev_agg = await db_manager.db.traffic_events.aggregate([
            {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
        ]).to_list(10)
        for d in dev_agg:
            dt = d.get("_id") or "Desktop"
            if dt in device_counts:
                device_counts[dt] += d.get("count", 0)
    else:
        users = list(db_manager.memory_store.get("users", {}).values())
        total_users = len(users)
        new_this_week = len([u for u in users if u.get("created_at", "") >= week_start])
        sessions = list(db_manager.memory_store.get("live_sessions", {}).values())
        online_now = len([s for s in sessions if s.get("last_seen", "") >= active_cutoff])
        events = db_manager.memory_store.get("traffic_events", [])
        today_events = [e for e in events if e.get("timestamp", "") >= today_start]
        active_today_count = len(set(e.get("identifier") for e in today_events))

        all_txns = []
        for u_txns in db_manager.memory_store.get("transactions", {}).values():
            all_txns.extend(u_txns)
        total_txns = len(all_txns)
        total_volume = sum(abs(t.get("amount", 0.0)) for t in all_txns)

        for s_list in db_manager.memory_store.get("spreadsheets", {}).values():
            total_sheets += len(s_list)
        for i_list in db_manager.memory_store.get("inventory", {}).values():
            total_inventory += len(i_list)

        for e in events:
            dt = e.get("device_type") or "Desktop"
            if dt in device_counts:
                device_counts[dt] += 1

    return {
        "success": True,
        "data": {
            "total_users": total_users,
            "active_today": active_today_count if db_manager.is_connected else active_today_count,
            "online_now": online_now,
            "new_this_week": new_this_week,
            "total_transactions": total_txns,
            "total_volume": round(total_volume, 2),
            "total_spreadsheets": total_sheets,
            "total_inventory_items": total_inventory,
            "device_breakdown": device_counts
        }
    }


# ── ANALYTICS ──

@router.get("/analytics/platform")
async def get_platform_analytics(
    days: int = 30,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    now = datetime.datetime.now(datetime.timezone.utc)
    start_date = (now - datetime.timedelta(days=days)).isoformat()

    daily_traffic: Dict[str, int] = {}
    daily_unique: Dict[str, set] = {}
    daily_registrations: Dict[str, int] = {}
    top_pages: Dict[str, int] = {}
    devices: Dict[str, int] = {}
    browsers: Dict[str, int] = {}
    os_breakdown: Dict[str, int] = {}
    locations: Dict[str, int] = {}

    for i in range(days + 1):
        d_str = (now - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        daily_traffic[d_str] = 0
        daily_registrations[d_str] = 0

    if db_manager.is_connected and db_manager.db is not None:
        events = await db_manager.db.traffic_events.find({"timestamp": {"$gte": start_date}}).to_list(length=5000)
        for e in events:
            day = (e.get("timestamp") or "")[:10]
            if day in daily_traffic:
                daily_traffic[day] += 1
                daily_unique.setdefault(day, set()).add(e.get("identifier"))
            p = e.get("page") or "/"
            top_pages[p] = top_pages.get(p, 0) + 1
            dt = e.get("device_type") or "Desktop"
            devices[dt] = devices.get(dt, 0) + 1
            br = e.get("browser") or "Other"
            browsers[br] = browsers.get(br, 0) + 1
            os_name = e.get("os") or "Other"
            os_breakdown[os_name] = os_breakdown.get(os_name, 0) + 1
            loc = e.get("location") or e.get("country") or "Unknown"
            if loc:
                locations[loc] = locations.get(loc, 0) + 1

        users = await db_manager.db.users.find({"created_at": {"$gte": start_date}}).to_list(length=1000)
        for u in users:
            day = (u.get("created_at") or "")[:10]
            if day in daily_registrations:
                daily_registrations[day] += 1
    else:
        events = [e for e in db_manager.memory_store.get("traffic_events", []) if e.get("timestamp", "") >= start_date]
        for e in events:
            day = (e.get("timestamp") or "")[:10]
            if day in daily_traffic:
                daily_traffic[day] += 1
                daily_unique.setdefault(day, set()).add(e.get("identifier"))
            p = e.get("page") or "/"
            top_pages[p] = top_pages.get(p, 0) + 1
            dt = e.get("device_type") or "Desktop"
            devices[dt] = devices.get(dt, 0) + 1
            br = e.get("browser") or "Other"
            browsers[br] = browsers.get(br, 0) + 1
            os_name = e.get("os") or "Other"
            os_breakdown[os_name] = os_breakdown.get(os_name, 0) + 1
            loc = e.get("location") or e.get("country") or "Unknown"
            if loc:
                locations[loc] = locations.get(loc, 0) + 1

        for u in db_manager.memory_store.get("users", {}).values():
            if u.get("created_at", "") >= start_date:
                day = (u.get("created_at") or "")[:10]
                if day in daily_registrations:
                    daily_registrations[day] += 1

    unique_counts = {k: len(v) for k, v in daily_unique.items()}

    sorted_pages = sorted(top_pages.items(), key=lambda x: x[1], reverse=True)[:10]
    sorted_locations = sorted(locations.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "success": True,
        "data": {
            "traffic_by_day": daily_traffic,
            "unique_visitors_by_day": unique_counts,
            "registrations_by_day": daily_registrations,
            "top_pages": sorted_pages,
            "devices": devices,
            "browsers": browsers,
            "os": os_breakdown,
            "top_locations": sorted_locations
        }
    }


# ── USERS DIRECTORY & MANAGEMENT ──

@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    status_filter: str = "",
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    skip = (page - 1) * limit
    users_list = []
    total = 0

    if db_manager.is_connected and db_manager.db is not None:
        q: Dict[str, Any] = {}
        if search:
            rx = {"$regex": re.escape(search), "$options": "i"}
            q["$or"] = [{"email": rx}, {"full_name": rx}, {"company_name": rx}, {"user_id": rx}]
        if status_filter:
            q["status"] = status_filter

        total = await db_manager.db.users.count_documents(q)
        docs = await db_manager.db.users.find(q).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        users_list = [{k: v for k, v in d.items() if k not in ("_id", "password_hash")} for d in docs]
    else:
        all_u = list(db_manager.memory_store.get("users", {}).values())
        filtered = []
        for u in all_u:
            if search:
                s_lower = search.lower()
                matched = any(s_lower in str(u.get(k, "")).lower() for k in ("email", "full_name", "company_name", "user_id"))
                if not matched:
                    continue
            if status_filter and u.get("status", "active") != status_filter:
                continue
            filtered.append({k: v for k, v in u.items() if k not in ("_id", "password_hash")})
        total = len(filtered)
        filtered.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        users_list = filtered[skip:skip + limit]

    return {
        "success": True,
        "data": users_list,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    user_doc = None
    if db_manager.is_connected and db_manager.db is not None:
        user_doc = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
        if user_doc:
            user_doc.pop("_id", None)
            user_doc.pop("password_hash", None)
    else:
        for u in db_manager.memory_store.get("users", {}).values():
            if u.get("user_id") == user_id or u.get("id") == user_id or u.get("email") == user_id:
                user_doc = {k: v for k, v in u.items() if k not in ("_id", "password_hash")}
                break

    if not user_doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    target_uid = user_doc.get("user_id") or user_doc.get("id") or user_id

    # Fetch user transactions, spreadsheets, inventory, and activities
    txns = await AxisDataStore.get_transactions(target_uid)
    sheets = await AxisDataStore.get_custom_spreadsheets(target_uid)
    inv = await AxisDataStore.get_inventory(target_uid)
    acts = await AxisDataStore.get_activities(target_uid, limit=30)

    # Fetch user traffic / live session
    session = None
    if db_manager.is_connected and db_manager.db is not None:
        session = await db_manager.db.live_sessions.find_one({"user_id": target_uid})
        if session:
            session.pop("_id", None)
    else:
        session = db_manager.memory_store.get("live_sessions", {}).get(target_uid)

    return {
        "success": True,
        "data": {
            "user": user_doc,
            "session": session,
            "transactions_count": len(txns),
            "spreadsheets_count": len(sheets),
            "inventory_count": len(inv),
            "recent_activities": acts,
            "recent_transactions": txns[:5],
            "spreadsheets": sheets[:5]
        }
    }

@router.post("/users/{user_id}/action")
async def execute_user_action(
    user_id: str,
    body: AdminActionReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    action = body.action.lower()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    upd: Dict[str, Any] = {}

    if action in ("activate", "restore"):
        upd["status"] = "active"
    elif action in ("suspend", "hold"):
        upd["status"] = "suspended"
    elif action == "block":
        upd["status"] = "blocked"
    elif action == "change_role" and body.value:
        upd["role"] = body.value
    elif action == "reset_password" and body.value:
        upd["password_hash"] = hash_password(body.value)
    elif action == "delete":
        upd["status"] = "deleted"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown action: {action}")

    upd["admin_updated_at"] = now_iso
    upd["admin_updated_by"] = admin["email"]

    if db_manager.is_connected and db_manager.db is not None:
        if action == "delete":
            await db_manager.db.users.delete_one({"$or": [{"user_id": user_id}, {"id": user_id}]})
        else:
            await db_manager.db.users.update_one(
                {"$or": [{"user_id": user_id}, {"id": user_id}]},
                {"$set": upd}
            )
        # Log to audit trail
        await db_manager.db.admin_audit_log.insert_one({
            "id": f"aud-{uuid.uuid4().hex[:10]}",
            "admin_id": admin["id"],
            "admin_name": admin.get("name"),
            "target_user_id": user_id,
            "action": action,
            "reason": body.reason,
            "timestamp": now_iso
        })
    else:
        users = db_manager.memory_store.get("users", {})
        for u in users.values():
            if u.get("user_id") == user_id or u.get("id") == user_id:
                if action == "delete":
                    users.pop(u.get("email"), None)
                else:
                    u.update(upd)
                break
        db_manager.save_memory_store()

    return {"success": True, "message": f"Action '{action}' applied successfully"}


# ── AUDIT LOG ──

@router.get("/audit")
async def get_audit_log(
    page: int = 1,
    limit: int = 30,
    action: str = "",
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    skip = (page - 1) * limit
    logs = []
    total = 0

    if db_manager.is_connected and db_manager.db is not None:
        q: Dict[str, Any] = {}
        if action:
            q["action"] = action
        total = await db_manager.db.admin_audit_log.count_documents(q)
        docs = await db_manager.db.admin_audit_log.find(q).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
        logs = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
    else:
        all_l = db_manager.memory_store.get("admin_audit_log", [])
        if action:
            all_l = [l for l in all_l if l.get("action") == action]
        total = len(all_l)
        logs = all_l[skip:skip + limit]

    return {"success": True, "data": logs, "total": total, "page": page}


# ── DATABASE EXPLORER ──

@router.get("/database/overview")
async def get_database_overview(admin: Dict[str, Any] = Depends(get_current_admin)):
    collections = [
        "users", "businesses", "transactions", "inventory",
        "spreadsheets", "activities", "traffic_events", "live_sessions",
        "admins", "admin_audit_log", "notifications"
    ]
    overview = []
    if db_manager.is_connected and db_manager.db is not None:
        for c in collections:
            cnt = await db_manager.db[c].count_documents({})
            overview.append({"name": c, "count": cnt})
    else:
        for c in collections:
            store_item = db_manager.memory_store.get(c, {})
            cnt = len(store_item) if isinstance(store_item, (list, dict)) else 0
            overview.append({"name": c, "count": cnt})

    return {
        "success": True,
        "data": {
            "database_name": settings.DB_NAME,
            "connected": db_manager.is_connected,
            "collections": overview
        }
    }

@router.get("/database/collection/{collection_name}")
async def inspect_collection(
    collection_name: str,
    page: int = 1,
    limit: int = 25,
    search: str = "",
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    skip = (page - 1) * limit
    records = []
    total = 0

    if db_manager.is_connected and db_manager.db is not None:
        coll = db_manager.db[collection_name]
        q: Dict[str, Any] = {}
        if search:
            rx = {"$regex": re.escape(search), "$options": "i"}
            q["$or"] = [{"id": rx}, {"name": rx}, {"email": rx}, {"user_id": rx}, {"title": rx}]
        total = await coll.count_documents(q)
        docs = await coll.find(q).skip(skip).limit(limit).to_list(length=limit)
        records = [{k: (str(v) if isinstance(v, ObjectId) else v) for k, v in d.items()} for d in docs]
    else:
        store = db_manager.memory_store.get(collection_name, {})
        items = list(store.values()) if isinstance(store, dict) else store
        total = len(items)
        records = items[skip:skip + limit]

    return {
        "success": True,
        "collection": collection_name,
        "data": records,
        "total": total,
        "page": page
    }

@router.post("/database/export/{collection_name}")
async def export_collection_data(
    collection_name: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    docs = []
    if db_manager.is_connected and db_manager.db is not None:
        raw = await db_manager.db[collection_name].find().to_list(length=5000)
        docs = [{k: (str(v) if isinstance(v, ObjectId) else v) for k, v in d.items()} for d in raw]
    else:
        store = db_manager.memory_store.get(collection_name, {})
        docs = list(store.values()) if isinstance(store, dict) else store

    return {"success": True, "collection": collection_name, "count": len(docs), "data": docs}


# ── BROADCAST MESSAGES & NOTIFICATIONS ──

@router.post("/messages/broadcast")
async def send_broadcast_message(
    body: BroadcastMsgReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """Dispatches a system notification to all users or target audience."""
    dispatched_count = 0
    all_uids = []
    if db_manager.is_connected and db_manager.db is not None:
        users = await db_manager.db.users.find({}, {"user_id": 1, "id": 1}).to_list(length=2000)
        all_uids = [u.get("user_id") or u.get("id") for u in users if u.get("user_id") or u.get("id")]
    else:
        for u in db_manager.memory_store.get("users", {}).values():
            uid = u.get("user_id") or u.get("id")
            if uid:
                all_uids.append(uid)

    for uid in all_uids:
        await AxisDataStore.add_notification(
            recipient_id=uid,
            title=body.title,
            message=body.message,
            notif_type=body.type,
            meta={"broadcast": True, "sender": admin.get("name", "Axis System")}
        )
        dispatched_count += 1

    return {"success": True, "dispatched_to": dispatched_count}

@router.get("/admin-notifications")
async def get_admin_notifications(
    limit: int = 30,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """Returns recent administrative alerts (e.g. new signups, suspicious logins)."""
    notifs = []
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.admin_notifications.find().sort("timestamp", -1).to_list(length=limit)
        notifs = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
    else:
        notifs = db_manager.memory_store.get("admin_notifications", [])[:limit]
    return {"success": True, "data": notifs, "unread": len([n for n in notifs if not n.get("read")])}

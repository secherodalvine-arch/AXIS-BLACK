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
from fastapi.encoders import ENCODERS_BY_TYPE

try:
    ENCODERS_BY_TYPE[ObjectId] = str
except Exception:
    pass

def clean_mongo_doc(val: Any) -> Any:
    """Recursively converts ObjectIds and datetime objects to strings and sanitizes BSON objects for JSON serialization."""
    if isinstance(val, ObjectId):
        return str(val)
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.isoformat()
    if isinstance(val, dict):
        clean_d = {}
        for k, v in val.items():
            str_k = str(k)
            if str_k == "_id":
                str_v = str(v)
                clean_d["_id"] = str_v
                if "id" not in val:
                    clean_d["id"] = str_v
            else:
                clean_d[str_k] = clean_mongo_doc(v)
        return clean_d
    if isinstance(val, (list, tuple)):
        return [clean_mongo_doc(x) for x in val]
    if isinstance(val, set):
        return [clean_mongo_doc(x) for x in val]
    return val

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

def get_user_traffic_mongo_filter() -> Dict[str, Any]:
    """Simple filter to exclude admin paths from public user analytics."""
    return {
        "page": {"$not": {"$regex": r"^/admin", "$options": "i"}}
    }

def is_admin_session_dict(s: Dict[str, Any]) -> bool:
    """Returns True if a session/event represents an admin platform page."""
    p = str(s.get("page") or s.get("current_page") or "").lower()
    return p.startswith("/admin") or p.startswith("/api/admin")


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
    accent_color: Optional[str] = None
    avatar_url: Optional[str] = None
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
            "accent_color": admin.get("accent_color", "cyan"),
            "avatar_url": admin.get("avatar_url", ""),
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
        "accent_color": "cyan",
        "avatar_url": "",
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
            "theme": "dark",
            "accent_color": "cyan",
            "avatar_url": ""
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
            "accent_color": admin.get("accent_color", "cyan"),
            "avatar_url": admin.get("avatar_url", ""),
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
    if body.accent_color is not None:
        updates["accent_color"] = body.accent_color
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url

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

    return {
        "success": True,
        "message": "Admin profile updated",
        "admin": {
            "id": admin["id"],
            "name": updates.get("name", admin.get("name", "Admin")),
            "email": admin["email"],
            "role": admin.get("role", "admin"),
            "theme": updates.get("theme", admin.get("theme", "dark")),
            "accent_color": updates.get("accent_color", admin.get("accent_color", "cyan")),
            "avatar_url": updates.get("avatar_url", admin.get("avatar_url", "")),
            "phone": updates.get("phone", admin.get("phone"))
        }
    }

class AdminAvatarReq(BaseModel):
    avatar_url: str

@router.post("/auth/avatar")
async def update_admin_avatar(
    body: AdminAvatarReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    updates = {"avatar_url": body.avatar_url}
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admins.update_one({"id": admin["id"]}, {"$set": updates})
    else:
        if admin["email"] in db_manager.memory_store.get("admins", {}):
            db_manager.memory_store["admins"][admin["email"]].update(updates)
            db_manager.save_memory_store()
    return {"success": True, "avatar_url": body.avatar_url}


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
    # ── Drop admin platform traffic immediately (User platform only) ──
    if is_admin_session_dict({
        "page": body.page,
        "user_email": body.user_email,
        "user_name": body.user_name,
        "user_id": body.user_id,
        "role": (body.data or {}).get("role") if isinstance(body.data, dict) else None
    }):
        return {"success": True, "skipped": "admin_traffic_excluded"}

    client_ip = (
        request.headers.get("cf-connecting-ip", "").strip()
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "").strip()
        or (request.client.host if request.client else "")
        or (body.ip or "").strip()
    )

    async def _process_capture():
        try:
            if is_admin_session_dict({
                "page": body.page,
                "user_email": body.user_email,
                "user_name": body.user_name,
                "user_id": body.user_id
            }):
                return

            now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
            resolved_city = body.city or ""
            resolved_country = body.country or ""
            resolved_loc = body.location or ""

            lookup_ip = client_ip if (client_ip and client_ip not in ("127.0.0.1", "localhost", "::1")) else (body.ip or "").strip()
            if lookup_ip and lookup_ip not in ("127.0.0.1", "localhost", "::1") and (not resolved_city or resolved_city == "Unknown"):
                geo = await _resolve_geo(lookup_ip)
                resolved_city = geo.get("city", "")
                resolved_country = geo.get("country", "")
                resolved_loc = ", ".join(filter(None, [resolved_city, resolved_country]))

            effective_ip = lookup_ip or client_ip or body.ip or ""

            # Check if an existing live session already exists for this client (by user_id, IP, or visitor_id)
            existing_session = None
            if db_manager.is_connected and db_manager.db is not None:
                match_clauses = []
                if body.user_id:
                    match_clauses.append({"user_id": body.user_id})
                if effective_ip and effective_ip not in ("127.0.0.1", "localhost", "::1"):
                    match_clauses.append({"ip": effective_ip})
                if body.visitor_id:
                    match_clauses.append({"visitor_id": body.visitor_id})
                if match_clauses:
                    existing_session = await db_manager.db.live_sessions.find_one({"$or": match_clauses})
            else:
                for s in db_manager.memory_store.get("live_sessions", {}).values():
                    if body.user_id and s.get("user_id") == body.user_id:
                        existing_session = s
                        break
                    if effective_ip and effective_ip not in ("127.0.0.1", "localhost", "::1") and s.get("ip") == effective_ip:
                        existing_session = s
                        break
                    if body.visitor_id and s.get("visitor_id") == body.visitor_id:
                        existing_session = s
                        break

            # Use consistent identifier across navigations
            if existing_session and existing_session.get("identifier"):
                identifier = existing_session["identifier"]
            elif body.user_id:
                identifier = f"usr_{body.user_id}"
            elif effective_ip and effective_ip not in ("127.0.0.1", "localhost", "::1"):
                identifier = f"ip_{effective_ip}"
            else:
                identifier = body.visitor_id or f"v_{uuid.uuid4().hex[:8]}"

            final_user_id = body.user_id or (existing_session.get("user_id") if existing_session else None)
            final_user_name = body.user_name or (existing_session.get("user_name") if existing_session and existing_session.get("user_name") != "Visitor" else (body.user_name or "Visitor"))
            final_user_email = body.user_email or (existing_session.get("user_email") if existing_session else None)

            session_record = {
                "identifier": identifier,
                "user_id": final_user_id,
                "visitor_id": body.visitor_id or (existing_session.get("visitor_id") if existing_session else None),
                "user_email": final_user_email,
                "user_name": final_user_name,
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
                "ip": effective_ip,
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
                    {"$set": session_record, "$push": {"events": {"$each": [{"e": body.event, "p": body.page, "t": now_utc}], "$slice": -30}}},
                    upsert=True
                )
                # Store historical traffic event
                await db_manager.db.traffic_events.insert_one(event_record)

                # Prune any duplicate sessions sharing this IP or user_id
                prune_filters = []
                if effective_ip and effective_ip not in ("127.0.0.1", "localhost", "::1"):
                    prune_filters.append({"ip": effective_ip})
                if final_user_id:
                    prune_filters.append({"user_id": final_user_id})
                if prune_filters:
                    await db_manager.db.live_sessions.delete_many({
                        "$or": prune_filters,
                        "identifier": {"$ne": identifier}
                    })

                # Update user record last seen info if logged in
                if final_user_id:
                    await db_manager.db.users.update_one(
                        {"$or": [{"user_id": final_user_id}, {"id": final_user_id}]},
                        {"$set": {
                            "last_seen": now_utc,
                            "last_device": body.device,
                            "last_location": resolved_loc,
                            "last_ip": effective_ip,
                            "last_local_time": body.local_time,
                            "timezone": body.timezone
                        }}
                    )
            else:
                # Local memory fallback
                if "live_sessions" not in db_manager.memory_store:
                    db_manager.memory_store["live_sessions"] = {}

                prev_events = db_manager.memory_store["live_sessions"].get(identifier, {}).get("events", [])
                session_record["events"] = (prev_events + [{"e": body.event, "p": body.page, "t": now_utc}])[-30:]
                db_manager.memory_store["live_sessions"][identifier] = session_record

                # Prune duplicate sessions in memory
                cleaned = {}
                for k, s in db_manager.memory_store["live_sessions"].items():
                    if k == identifier:
                        cleaned[k] = s
                    elif effective_ip and effective_ip not in ("127.0.0.1", "localhost", "::1") and s.get("ip") == effective_ip:
                        continue
                    elif final_user_id and s.get("user_id") == final_user_id:
                        continue
                    else:
                        cleaned[k] = s
                db_manager.memory_store["live_sessions"] = cleaned

                if "traffic_events" not in db_manager.memory_store:
                    db_manager.memory_store["traffic_events"] = []
                db_manager.memory_store["traffic_events"].insert(0, event_record)
                if len(db_manager.memory_store["traffic_events"]) > 500:
                    db_manager.memory_store["traffic_events"] = db_manager.memory_store["traffic_events"][:500]

                if final_user_id:
                    users = db_manager.memory_store.get("users", {})
                    for u in users.values():
                        if u.get("user_id") == final_user_id or u.get("id") == final_user_id:
                            u["last_seen"] = now_utc
                            u["last_device"] = body.device
                            u["last_location"] = resolved_loc
                            u["last_ip"] = effective_ip
                            u["last_local_time"] = body.local_time
                            u["timezone"] = body.timezone
                db_manager.save_memory_store()

            # Broadcast to connected admin live monitors
            await ws_manager.broadcast({
                "type": "traffic_event",
                "identifier": identifier,
                "user_name": final_user_name,
                "user_email": final_user_email,
                "event": body.event,
                "page": body.page,
                "device": body.device,
                "location": resolved_loc,
                "city": resolved_city,
                "country": resolved_country,
                "ip": effective_ip,
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
    """Returns sessions active within the last 15 minutes, deduplicated per client/IP."""
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=15)).isoformat()
    sessions = []
    admin_filter = get_user_traffic_mongo_filter()
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.live_sessions.find({"last_seen": {"$gte": cutoff}, **admin_filter}).sort("last_seen", -1).to_list(length=100)
        sessions = [clean_mongo_doc(d) for d in docs]
    else:
        all_s = list(db_manager.memory_store.get("live_sessions", {}).values())
        sessions = [clean_mongo_doc(s) for s in all_s if s.get("last_seen", "") >= cutoff and not is_admin_session_dict(s)]
        sessions.sort(key=lambda s: s.get("last_seen", ""), reverse=True)

    # Strictly deduplicate by IP and user so 1 IP never displays as multiple users
    unique_by_ip = {}
    for s in sessions:
        if is_admin_session_dict(s):
            continue
        s_ip = str(s.get("ip") or "").strip()
        key = s_ip if (s_ip and s_ip not in ("127.0.0.1", "localhost", "::1")) else (s.get("user_id") or s.get("identifier"))
        if key not in unique_by_ip:
            unique_by_ip[key] = s
        else:
            # Upgrade anonymous card to registered user card if user logged in
            if not unique_by_ip[key].get("user_id") and s.get("user_id"):
                unique_by_ip[key] = s

    deduped = list(unique_by_ip.values())
    return {"success": True, "data": deduped, "count": len(deduped)}

@router.get("/traffic/events")
async def get_traffic_events(
    limit: int = 50,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    admin_filter = get_user_traffic_mongo_filter()
    events = []
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.traffic_events.find(admin_filter).sort("timestamp", -1).to_list(length=limit)
        events = [clean_mongo_doc(d) for d in docs]
    else:
        events = [clean_mongo_doc(d) for d in db_manager.memory_store.get("traffic_events", []) if not is_admin_session_dict(d)][:limit]
    return {"success": True, "data": events}

@router.get("/traffic/history")
async def get_traffic_history(
    timeframe: str = Query("today", pattern="^(today|yesterday|7d|30d|all)$"),
    scope: str = Query("all", pattern="^(all|homepage|app)$"),
    event_type: Optional[str] = Query(None),
    limit: int = Query(250, ge=1, le=1000),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Returns historical traffic sessions, visits, and telemetry events with
    aggregated performance metrics filtered by timeframe (today, yesterday, 7d, 30d, all).
    """
    admin_filter = get_user_traffic_mongo_filter()
    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Time boundary calculations
    time_filter = {}
    if timeframe == "today":
        time_filter = {"timestamp": {"$gte": today_start.isoformat()}}
    elif timeframe == "yesterday":
        yesterday_start = today_start - datetime.timedelta(days=1)
        time_filter = {"timestamp": {"$gte": yesterday_start.isoformat(), "$lt": today_start.isoformat()}}
    elif timeframe == "7d":
        start_7d = now - datetime.timedelta(days=7)
        time_filter = {"timestamp": {"$gte": start_7d.isoformat()}}
    elif timeframe == "30d":
        start_30d = now - datetime.timedelta(days=30)
        time_filter = {"timestamp": {"$gte": start_30d.isoformat()}}

    # 2. Scope filter (homepage vs in-app)
    hp_regex = r"^/(home|features|pricing|security|contact|landing)?(\?.*)?$"
    scope_filter = {}
    if scope == "homepage":
        scope_filter = {
            "$or": [
                {"event": {"$in": ["homepage_visit", "cta_click"]}},
                {"page": {"$in": ["/", "/home", "", "/landing", "/features", "/pricing", "/security", "/contact"]}},
                {"page": {"$regex": hp_regex, "$options": "i"}}
            ]
        }
    elif scope == "app":
        scope_filter = {
            "$and": [
                {"event": {"$nin": ["homepage_visit", "cta_click"]}},
                {"page": {"$nin": ["/", "/home", "", "/landing", "/features", "/pricing", "/security", "/contact"]}}
            ]
        }

    query_parts = [admin_filter]
    if time_filter:
        query_parts.append(time_filter)
    if scope_filter:
        query_parts.append(scope_filter)
    if event_type and event_type != "all":
        query_parts.append({"event": event_type})

    combined_query = {"$and": query_parts} if len(query_parts) > 1 else query_parts[0] if query_parts else {}

    events = []
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.traffic_events.find(combined_query).sort("timestamp", -1).to_list(length=limit)
        events = [clean_mongo_doc(d) for d in docs]
    else:
        all_ev = [e for e in db_manager.memory_store.get("traffic_events", []) if not is_admin_session_dict(e)]
        filtered = []
        for e in all_ev:
            ts = e.get("timestamp", "")
            if timeframe == "today" and ts < today_start.isoformat():
                continue
            elif timeframe == "yesterday":
                yesterday_start = (today_start - datetime.timedelta(days=1)).isoformat()
                if not (yesterday_start <= ts < today_start.isoformat()):
                    continue
            elif timeframe == "7d" and ts < (now - datetime.timedelta(days=7)).isoformat():
                continue
            elif timeframe == "30d" and ts < (now - datetime.timedelta(days=30)).isoformat():
                continue

            p = str(e.get("page", "")).lower()
            ev_name = str(e.get("event", "")).lower()
            is_hp = ev_name in ("homepage_visit", "cta_click") or p in ("/", "/home", "", "/landing", "/features", "/pricing", "/security", "/contact") or bool(re.match(hp_regex, p, re.IGNORECASE))
            if scope == "homepage" and not is_hp:
                continue
            if scope == "app" and is_hp:
                continue

            if event_type and event_type != "all" and e.get("event") != event_type:
                continue

            filtered.append(clean_mongo_doc(e))
        events = filtered[:limit]

    # Compute summary metrics for this timeframe
    total_events = len(events)
    unique_visitors = len(set(
        e.get("ip") if (e.get("ip") and e.get("ip") not in ("127.0.0.1", "localhost", "::1")) else (e.get("visitor_id") or e.get("identifier") or e.get("user_id") or f"anon-{i}")
        for i, e in enumerate(events)
    ))
    page_views = sum(1 for e in events if e.get("event") in ("page_view", "homepage_visit", "view"))
    cta_clicks = sum(1 for e in events if "cta" in str(e.get("event", "")).lower() or "click" in str(e.get("event", "")).lower())

    desktop_cnt = sum(1 for e in events if str(e.get("device_type", "")).lower() == "desktop")
    mobile_cnt = sum(1 for e in events if str(e.get("device_type", "")).lower() == "mobile")
    tablet_cnt = sum(1 for e in events if str(e.get("device_type", "")).lower() == "tablet")

    page_counts = {}
    for e in events:
        pg = e.get("page") or e.get("current_page") or "/"
        page_counts[pg] = page_counts.get(pg, 0) + 1
    top_pages_sorted = sorted([{"page": k, "count": v} for k, v in page_counts.items()], key=lambda x: x["count"], reverse=True)[:6]

    summary = {
        "timeframe": timeframe,
        "scope": scope,
        "total_records": total_events,
        "unique_visitors": unique_visitors,
        "page_views": page_views or total_events,
        "cta_clicks": cta_clicks,
        "devices": {
            "desktop": desktop_cnt,
            "mobile": mobile_cnt,
            "tablet": tablet_cnt
        },
        "top_pages": top_pages_sorted
    }

    return {"success": True, "timeframe": timeframe, "summary": summary, "data": events}

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
    active_cutoff = (now - datetime.timedelta(minutes=15)).isoformat()

    total_users = 0
    active_today = 0
    online_now = 0
    new_this_week = 0
    total_txns = 0
    total_volume = 0.0
    total_sheets = 0
    total_inventory = 0

    device_counts = {"Desktop": 0, "Mobile": 0, "Tablet": 0}
    admin_filter = get_user_traffic_mongo_filter()

    if db_manager.is_connected and db_manager.db is not None:
        total_users = await db_manager.db.users.count_documents({})
        new_this_week = await db_manager.db.users.count_documents({"created_at": {"$gte": week_start}})
        
        # Deduplicate active live sessions by IP (strictly user platform)
        distinct_ips = await db_manager.db.live_sessions.distinct("ip", {"last_seen": {"$gte": active_cutoff}, "ip": {"$nin": ["", "127.0.0.1", "localhost", "::1"]}, **admin_filter})
        distinct_anon = await db_manager.db.live_sessions.count_documents({"last_seen": {"$gte": active_cutoff}, "ip": {"$in": ["", "127.0.0.1", "localhost", "::1"]}, **admin_filter})
        online_now = len(distinct_ips) + distinct_anon

        # Deduplicate today's active traffic by IP (strictly user platform)
        active_today_ips = await db_manager.db.traffic_events.distinct("ip", {"timestamp": {"$gte": today_start}, "ip": {"$nin": ["", "127.0.0.1", "localhost", "::1"]}, **admin_filter})
        if active_today_ips:
            active_today_count = len(active_today_ips)
        else:
            active_today = await db_manager.db.traffic_events.distinct("identifier", {"timestamp": {"$gte": today_start}, **admin_filter})
            active_today_count = len(active_today)

        total_txns = await db_manager.db.transactions.count_documents({})
        total_sheets = await db_manager.db.spreadsheets.count_documents({})
        total_inventory = await db_manager.db.inventory.count_documents({})

        # Total transaction volume
        pipeline = [{"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}]
        agg = await db_manager.db.transactions.aggregate(pipeline).to_list(1)
        if agg:
            total_volume = agg[0].get("total", 0.0)

        # Device breakdown (strictly user platform)
        dev_agg = await db_manager.db.traffic_events.aggregate([
            {"$match": admin_filter},
            {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
        ]).to_list(10)
        for d in dev_agg:
            dt = str(d.get("_id") or "Desktop")
            if dt in device_counts:
                device_counts[dt] += d.get("count", 0)
    else:
        users = list(db_manager.memory_store.get("users", {}).values())
        total_users = len(users)
        new_this_week = len([u for u in users if u.get("created_at", "") >= week_start])
        sessions = [s for s in db_manager.memory_store.get("live_sessions", {}).values() if not is_admin_session_dict(s)]
        online_now = len(set(
            s.get("ip") if (s.get("ip") and s.get("ip") not in ("127.0.0.1", "localhost", "::1")) else (s.get("user_id") or s.get("identifier"))
            for s in sessions if s.get("last_seen", "") >= active_cutoff
        ))
        events = [e for e in db_manager.memory_store.get("traffic_events", []) if not is_admin_session_dict(e)]
        today_events = [e for e in events if e.get("timestamp", "") >= today_start]
        active_today_count = len(set(
            e.get("ip") if (e.get("ip") and e.get("ip") not in ("127.0.0.1", "localhost", "::1")) else (e.get("user_id") or e.get("visitor_id") or e.get("identifier"))
            for e in today_events
        ))

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
    admin_filter = get_user_traffic_mongo_filter()

    for i in range(days + 1):
        d_str = (now - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        daily_traffic[d_str] = 0
        daily_registrations[d_str] = 0

    if db_manager.is_connected and db_manager.db is not None:
        events = await db_manager.db.traffic_events.find({"timestamp": {"$gte": start_date}, **admin_filter}).to_list(length=5000)
        for e in events:
            p = str(e.get("page") or "/")
            if p.startswith("/admin") or p.startswith("/api/admin"):
                continue
            day = str(e.get("timestamp") or "")[:10]
            if day in daily_traffic:
                daily_traffic[day] += 1
                e_ip = str(e.get("ip") or "").strip()
                ident = e_ip if (e_ip and e_ip not in ("127.0.0.1", "localhost", "::1")) else str(e.get("user_id") or e.get("visitor_id") or e.get("identifier") or "")
                daily_unique.setdefault(day, set()).add(ident)
            top_pages[p] = top_pages.get(p, 0) + 1
            dt = str(e.get("device_type") or "Desktop")
            devices[dt] = devices.get(dt, 0) + 1
            br = str(e.get("browser") or "Other")
            browsers[br] = browsers.get(br, 0) + 1
            os_name = str(e.get("os") or "Other")
            os_breakdown[os_name] = os_breakdown.get(os_name, 0) + 1
            loc = str(e.get("location") or e.get("country") or "Unknown")
            if loc and loc != "Unknown":
                locations[loc] = locations.get(loc, 0) + 1

        users = await db_manager.db.users.find({"created_at": {"$gte": start_date}}).to_list(length=1000)
        for u in users:
            day = str(u.get("created_at") or "")[:10]
            if day in daily_registrations:
                daily_registrations[day] += 1
    else:
        events = [e for e in db_manager.memory_store.get("traffic_events", []) if e.get("timestamp", "") >= start_date and not is_admin_session_dict(e)]
        for e in events:
            p = str(e.get("page") or "/")
            if p.startswith("/admin") or p.startswith("/api/admin"):
                continue
            day = str(e.get("timestamp") or "")[:10]
            if day in daily_traffic:
                daily_traffic[day] += 1
                e_ip = str(e.get("ip") or "").strip()
                ident = e_ip if (e_ip and e_ip not in ("127.0.0.1", "localhost", "::1")) else str(e.get("user_id") or e.get("visitor_id") or e.get("identifier") or "")
                daily_unique.setdefault(day, set()).add(ident)
            top_pages[p] = top_pages.get(p, 0) + 1
            dt = str(e.get("device_type") or "Desktop")
            devices[dt] = devices.get(dt, 0) + 1
            br = str(e.get("browser") or "Other")
            browsers[br] = browsers.get(br, 0) + 1
            os_name = str(e.get("os") or "Other")
            os_breakdown[os_name] = os_breakdown.get(os_name, 0) + 1
            loc = str(e.get("location") or e.get("country") or "Unknown")
            if loc and loc != "Unknown":
                locations[loc] = locations.get(loc, 0) + 1

        for u in db_manager.memory_store.get("users", {}).values():
            if u.get("created_at", "") >= start_date:
                day = str(u.get("created_at") or "")[:10]
                if day in daily_registrations:
                    daily_registrations[day] += 1

    unique_counts = {str(k): int(len(v)) for k, v in daily_unique.items()}

    sorted_pages = [[str(k), int(v)] for k, v in sorted(top_pages.items(), key=lambda x: x[1], reverse=True)[:10]]
    sorted_locations = [[str(k), int(v)] for k, v in sorted(locations.items(), key=lambda x: x[1], reverse=True)[:10]]

    return clean_mongo_doc({
        "success": True,
        "data": {
            "traffic_by_day": daily_traffic,
            "unique_visitors_by_day": unique_counts,
            "registrations_by_day": daily_registrations,
            "top_pages": sorted_pages,
            "devices": {str(k): int(v) for k, v in devices.items()},
            "browsers": {str(k): int(v) for k, v in browsers.items()},
            "os": {str(k): int(v) for k, v in os_breakdown.items()},
            "top_locations": sorted_locations
        }
    })


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
        users_list = [clean_mongo_doc({k: v for k, v in d.items() if k != "password_hash"}) for d in docs]
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
            filtered.append(clean_mongo_doc({k: v for k, v in u.items() if k != "password_hash"}))
        total = len(filtered)
        filtered.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        users_list = filtered[skip:skip + limit]

    return clean_mongo_doc({
        "success": True,
        "data": users_list,
        "total": total,
        "page": page,
        "limit": limit
    })

@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    user_doc = None
    if db_manager.is_connected and db_manager.db is not None:
        user_doc = await db_manager.db.users.find_one({"$or": [{"user_id": user_id}, {"id": user_id}, {"email": user_id}]})
        if user_doc:
            user_doc.pop("password_hash", None)
    else:
        for u in db_manager.memory_store.get("users", {}).values():
            if u.get("user_id") == user_id or u.get("id") == user_id or u.get("email") == user_id:
                user_doc = {k: v for k, v in u.items() if k != "password_hash"}
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
    else:
        session = db_manager.memory_store.get("live_sessions", {}).get(target_uid)

    return clean_mongo_doc({
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
    })

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

    try:
        await AxisDataStore.record_admin_notification(
            title=f"User Account Updated: {action.title()}",
            message=f"Admin {admin.get('name', 'Admin')} performed '{action}' on user {user_id}.",
            notif_type="warning" if action in ("delete", "block", "suspend") else "info",
            meta={"user_id": user_id, "action": action, "admin": admin.get("email")}
        )
    except Exception:
        pass

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
        logs = [clean_mongo_doc(d) for d in docs]
    else:
        all_l = db_manager.memory_store.get("admin_audit_log", [])
        if action:
            all_l = [l for l in all_l if l.get("action") == action]
        total = len(all_l)
        logs = [clean_mongo_doc(l) for l in all_l[skip:skip + limit]]

    return clean_mongo_doc({"success": True, "data": logs, "total": total, "page": page})


# ── DATABASE EXPLORER ──

@router.get("/database/overview")
async def get_database_overview(admin: Dict[str, Any] = Depends(get_current_admin)):
    collections = [
        "users", "businesses", "transactions", "inventory",
        "spreadsheets", "payments", "activities", "traffic_events", "live_sessions",
        "admins", "admin_audit_log", "admin_notifications", "notifications",
        "system_logs", "support_threads", "agent_sessions"
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
        records = [clean_mongo_doc(d) for d in docs]
    else:
        store = db_manager.memory_store.get(collection_name, {})
        items = list(store.values()) if isinstance(store, dict) else store
        total = len(items)
        records = [clean_mongo_doc(d) for d in items[skip:skip + limit]]

    return clean_mongo_doc({
        "success": True,
        "collection": collection_name,
        "data": records,
        "total": total,
        "page": page
    })

@router.post("/database/export/{collection_name}")
async def export_collection_data(
    collection_name: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    docs = []
    if db_manager.is_connected and db_manager.db is not None:
        raw = await db_manager.db[collection_name].find().to_list(length=5000)
        docs = [clean_mongo_doc(d) for d in raw]
    else:
        store = db_manager.memory_store.get(collection_name, {})
        docs = [clean_mongo_doc(d) for d in (list(store.values()) if isinstance(store, dict) else store)]

    return clean_mongo_doc({"success": True, "collection": collection_name, "count": len(docs), "data": docs})


# ── BROADCAST MESSAGES & NOTIFICATIONS ──

@router.post("/messages/broadcast")
async def send_broadcast_message(
    body: BroadcastMsgReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """Dispatches a system notification to all users or target audience and archives in real broadcast log."""
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

    # Record real transmission record in broadcast_history
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    record = {
        "id": f"bc-{uuid.uuid4().hex[:10]}",
        "title": body.title,
        "message": body.message,
        "type": body.type,
        "dispatched": dispatched_count,
        "admin_name": admin.get("name", "Admin"),
        "timestamp": now_iso
    }
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.broadcast_history.insert_one(record)
    else:
        if "broadcast_history" not in db_manager.memory_store:
            db_manager.memory_store["broadcast_history"] = []
        db_manager.memory_store["broadcast_history"].insert(0, record)
        db_manager.save_memory_store()

    # Log to real administrative alerts
    await AxisDataStore.record_admin_notification(
        title=f"Broadcast Dispatched: {body.title}",
        message=f"Dispatched to {dispatched_count} user accounts by {admin.get('name', 'Admin')}.",
        notif_type="info",
        meta={"broadcast_id": record["id"], "dispatched": dispatched_count}
    )

    return {"success": True, "dispatched_to": dispatched_count, "broadcast": clean_mongo_doc(record)}

@router.get("/messages/broadcasts")
async def get_broadcast_history(
    limit: int = 50,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """Returns actual broadcast transmission history without mockups."""
    records = []
    if db_manager.is_connected and db_manager.db is not None:
        docs = await db_manager.db.broadcast_history.find().sort("timestamp", -1).to_list(length=limit)
        records = [clean_mongo_doc(d) for d in docs]
    else:
        records = [clean_mongo_doc(d) for d in db_manager.memory_store.get("broadcast_history", [])[:limit]]
    return {"success": True, "data": records}

@router.get("/admin-notifications")
async def get_admin_notifications(
    limit: int = 50,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """Returns real administrative alerts (e.g. signups, payments, customer support, error events)."""
    # Clean up any legacy mockup seed items
    legacy_fake_ids = ["notif-01", "notif-02", "notif-03", "notif-04"]
    notifs = []
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admin_notifications.delete_many({"id": {"$in": legacy_fake_ids}})
        docs = await db_manager.db.admin_notifications.find().sort("timestamp", -1).to_list(length=limit)
        notifs = [clean_mongo_doc(d) for d in docs]
    else:
        all_notifs = db_manager.memory_store.get("admin_notifications", [])
        cleaned = [n for n in all_notifs if n.get("id") not in legacy_fake_ids]
        if len(cleaned) != len(all_notifs):
            db_manager.memory_store["admin_notifications"] = cleaned
            db_manager.save_memory_store()
        notifs = [clean_mongo_doc(d) for d in cleaned[:limit]]

    unread_count = len([n for n in notifs if not n.get("read")])
    return {"success": True, "data": notifs, "unread": unread_count}

@router.post("/admin-notifications/{notif_id}/read")
async def mark_admin_notification_read(
    notif_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admin_notifications.update_one(
            {"$or": [{"id": notif_id}, {"_id": notif_id}]},
            {"$set": {"read": True}}
        )
    else:
        for n in db_manager.memory_store.get("admin_notifications", []):
            if n.get("id") == notif_id or str(n.get("_id", "")) == notif_id:
                n["read"] = True
                break
        db_manager.save_memory_store()
    return {"success": True, "message": "Notification marked as read"}

@router.post("/admin-notifications/{notif_id}/toggle-read")
async def toggle_admin_notification_read(
    notif_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    new_state = True
    if db_manager.is_connected and db_manager.db is not None:
        existing = await db_manager.db.admin_notifications.find_one({"$or": [{"id": notif_id}, {"_id": notif_id}]})
        if existing:
            new_state = not existing.get("read", False)
            await db_manager.db.admin_notifications.update_one(
                {"$or": [{"id": notif_id}, {"_id": notif_id}]},
                {"$set": {"read": new_state}}
            )
    else:
        for n in db_manager.memory_store.get("admin_notifications", []):
            if n.get("id") == notif_id or str(n.get("_id", "")) == notif_id:
                n["read"] = not n.get("read", False)
                new_state = n["read"]
                break
        db_manager.save_memory_store()
    return {"success": True, "read": new_state}

@router.post("/admin-notifications/read-all")
async def mark_all_admin_notifications_read(admin: Dict[str, Any] = Depends(get_current_admin)):
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admin_notifications.update_many({}, {"$set": {"read": True}})
    else:
        for n in db_manager.memory_store.get("admin_notifications", []):
            n["read"] = True
        db_manager.save_memory_store()
    return {"success": True, "message": "All notifications marked as read"}

@router.delete("/admin-notifications/{notif_id}")
async def delete_admin_notification(
    notif_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admin_notifications.delete_one({"$or": [{"id": notif_id}, {"_id": notif_id}]})
    else:
        db_manager.memory_store["admin_notifications"] = [
            n for n in db_manager.memory_store.get("admin_notifications", [])
            if n.get("id") != notif_id and str(n.get("_id", "")) != notif_id
        ]
        db_manager.save_memory_store()
    return {"success": True, "message": "Notification deleted"}

@router.delete("/admin-notifications")
async def clear_all_admin_notifications(admin: Dict[str, Any] = Depends(get_current_admin)):
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.admin_notifications.delete_many({})
    else:
        db_manager.memory_store["admin_notifications"] = []
        db_manager.save_memory_store()
    return {"success": True, "message": "All notifications cleared"}


# ── ADMIN STRATEGIC AGENT (100% READ-ONLY) ──
class AdminAgentChatReq(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = None

@router.post("/agent/chat")
async def query_admin_agent(
    body: AdminAgentChatReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Queries the Axis Admin Strategic Agent.
    Grounded in real-time platform telemetry (users, payments, traffic, usage, system health).
    STRICT CONSTRAINT: 100% READ-ONLY. Never modifies or writes database records.
    """
    from app.agent.admin_agent import AdminPlatformAgent
    result = await AdminPlatformAgent.process_query(query=body.query, history=body.history)
    return result


# ── SYSTEM LOGS & ERROR MONITORING ──
class SystemLogCaptureReq(BaseModel):
    level: str = "ERROR" # CRITICAL, ERROR, WARNING, INFO
    service: str = "Frontend Client" # Backend API, Frontend Client, Email Service, IntaSend, Gemini AI
    event: str = "Client Exception"
    message: str
    details: Optional[Any] = None
    path: Optional[str] = None
    status_code: Optional[int] = None
    stack_trace: Optional[str] = None

@router.get("/logs")
async def get_system_logs(
    page: int = 1,
    limit: int = 30,
    level: str = "",
    service: str = "",
    search: str = "",
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Returns platform system logs, errors across backend, frontend, email, and integrated APIs.
    """
    skip = (page - 1) * limit
    logs = []
    total = 0

    # Purge legacy fake seed logs if present
    legacy_log_ids = ["log-001", "log-002", "log-003", "log-004", "log-005"]
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.system_logs.delete_many({"id": {"$in": legacy_log_ids}})
        q: Dict[str, Any] = {}
        if level:
            q["level"] = level.upper()
        if service:
            q["service"] = service
        if search:
            rx = {"$regex": re.escape(search), "$options": "i"}
            q["$or"] = [{"message": rx}, {"path": rx}, {"event": rx}, {"stack_trace": rx}]

        total = await db_manager.db.system_logs.count_documents(q)
        docs = await db_manager.db.system_logs.find(q).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
        logs = [clean_mongo_doc(d) for d in docs]
    else:
        all_l = db_manager.memory_store.get("system_logs", [])
        cleaned_l = [l for l in all_l if l.get("id") not in legacy_log_ids]
        if len(cleaned_l) != len(all_l):
            db_manager.memory_store["system_logs"] = cleaned_l
            db_manager.save_memory_store()
        filtered = cleaned_l
        if level:
            filtered = [l for l in filtered if l.get("level", "").upper() == level.upper()]
        if service:
            filtered = [l for l in filtered if l.get("service") == service]
        if search:
            s_low = search.lower()
            filtered = [
                l for l in filtered
                if s_low in l.get("message", "").lower()
                or s_low in l.get("path", "").lower()
                or s_low in l.get("event", "").lower()
            ]
        total = len(filtered)
        logs = filtered[skip:skip + limit]

    return clean_mongo_doc({"success": True, "data": logs, "total": total, "page": page, "limit": limit})


@router.post("/logs/capture")
async def capture_system_log(body: SystemLogCaptureReq, request: Request):
    """
    Endpoint for frontend client or background tasks to report client runtime errors or integration issues.
    """
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else "")
    )
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log_id = f"log-{uuid.uuid4().hex[:10]}"

    log_doc = {
        "id": log_id,
        "timestamp": now_iso,
        "level": body.level.upper(),
        "service": body.service,
        "event": body.event,
        "message": body.message,
        "details": body.details,
        "path": body.path,
        "status_code": body.status_code,
        "stack_trace": body.stack_trace,
        "client_ip": client_ip,
        "resolved": False
    }

    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.system_logs.insert_one(log_doc)
    else:
        if "system_logs" not in db_manager.memory_store:
            db_manager.memory_store["system_logs"] = []
        db_manager.memory_store["system_logs"].insert(0, log_doc)
        db_manager.save_memory_store()

    if body.level.upper() in ("ERROR", "CRITICAL"):
        try:
            await AxisDataStore.record_admin_notification(
                title=f"System Alert: {body.service}",
                message=f"[{body.level.upper()}] {body.message[:100]}",
                notif_type="warning",
                meta={"service": body.service, "level": body.level.upper(), "link": "/logs"}
            )
        except Exception:
            pass

    return {"success": True, "id": log_id}

@router.get("/logs/stats")
async def get_system_log_stats(admin: Dict[str, Any] = Depends(get_current_admin)):
    """
    Returns summarized log health metrics (total 24h, critical count, frontend crashes, API integration error rates).
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    one_day_ago = (now - datetime.timedelta(days=1)).isoformat()

    total_24h = 0
    critical_count = 0
    frontend_errors = 0
    api_errors = 0
    email_errors = 0

    if db_manager.is_connected and db_manager.db is not None:
        total_24h = await db_manager.db.system_logs.count_documents({"timestamp": {"$gte": one_day_ago}})
        critical_count = await db_manager.db.system_logs.count_documents({"level": "CRITICAL"})
        frontend_errors = await db_manager.db.system_logs.count_documents({"service": "Frontend Client"})
        api_errors = await db_manager.db.system_logs.count_documents({"service": {"$in": ["IntaSend Gateway", "Gemini AI Engine"]}})
        email_errors = await db_manager.db.system_logs.count_documents({"service": "Email Service"})
    else:
        logs = db_manager.memory_store.get("system_logs", [])
        total_24h = len([l for l in logs if l.get("timestamp", "") >= one_day_ago])
        critical_count = len([l for l in logs if l.get("level") == "CRITICAL"])
        frontend_errors = len([l for l in logs if l.get("service") == "Frontend Client"])
        api_errors = len([l for l in logs if l.get("service") in ("IntaSend Gateway", "Gemini AI Engine")])
        email_errors = len([l for l in logs if l.get("service") == "Email Service"])

    return {
        "success": True,
        "stats": {
            "total_24h": total_24h,
            "critical_count": critical_count,
            "frontend_errors": frontend_errors,
            "api_errors": api_errors,
            "email_errors": email_errors,
            "overall_status": "Degraded" if critical_count > 0 else "Operational"
        }
    }

@router.post("/logs/{log_id}/resolve")
async def resolve_system_log(log_id: str, admin: Dict[str, Any] = Depends(get_current_admin)):
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.system_logs.update_one({"id": log_id}, {"$set": {"resolved": True}})
    else:
        for l in db_manager.memory_store.get("system_logs", []):
            if l.get("id") == log_id:
                l["resolved"] = True
                break
        db_manager.save_memory_store()
    return {"success": True, "message": "Log marked as resolved"}

@router.delete("/logs")
async def clear_system_logs(
    only_resolved: bool = Query(False),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    if db_manager.is_connected and db_manager.db is not None:
        if only_resolved:
            await db_manager.db.system_logs.delete_many({"resolved": True})
        else:
            await db_manager.db.system_logs.delete_many({})
    else:
        if only_resolved:
            db_manager.memory_store["system_logs"] = [
                l for l in db_manager.memory_store.get("system_logs", []) if not l.get("resolved")
            ]
        else:
            db_manager.memory_store["system_logs"] = []
        db_manager.save_memory_store()
    return {"success": True, "message": "Logs cleared"}


# ── CUSTOMER SUPPORT & USER MESSAGING ──
class SupportReplyReq(BaseModel):
    reply: str

class SupportNewThreadReq(BaseModel):
    user_email: str
    user_name: Optional[str] = None
    subject: str
    message: str
    label: Optional[str] = "support"

class SupportStatusReq(BaseModel):
    status: str # open, in_progress, resolved

@router.get("/support/threads")
async def get_support_threads(
    status: str = "",
    search: str = "",
    page: int = 1,
    limit: int = 30,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Returns list of user customer support threads for administrator to interact and respond.
    """
    skip = (page - 1) * limit
    threads = []
    total = 0

    # Purge legacy fake seed threads if present
    legacy_thread_ids = ["th-cust-101", "th-cust-102", "th-cust-103"]
    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.support_threads.delete_many({"id": {"$in": legacy_thread_ids}})
        q: Dict[str, Any] = {}
        if status:
            q["status"] = status
        if search:
            rx = {"$regex": re.escape(search), "$options": "i"}
            q["$or"] = [{"user_name": rx}, {"user_email": rx}, {"subject": rx}]
        total = await db_manager.db.support_threads.count_documents(q)
        docs = await db_manager.db.support_threads.find(q).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=limit)
        threads = [clean_mongo_doc(d) for d in docs]
    else:
        store = db_manager.memory_store.get("support_threads", {})
        all_t = list(store.values()) if isinstance(store, dict) else store
        cleaned_t = [t for t in all_t if t.get("id") not in legacy_thread_ids]
        if len(cleaned_t) != len(all_t):
            db_manager.memory_store["support_threads"] = {t["id"]: t for t in cleaned_t}
            db_manager.save_memory_store()
        filtered = cleaned_t
        if status:
            filtered = [t for t in filtered if t.get("status") == status]
        if search:
            s_low = search.lower()
            filtered = [
                t for t in filtered
                if s_low in t.get("user_name", "").lower()
                or s_low in t.get("user_email", "").lower()
                or s_low in t.get("subject", "").lower()
            ]
        filtered.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        total = len(filtered)
        threads = filtered[skip:skip + limit]

    return clean_mongo_doc({"success": True, "data": threads, "total": total, "page": page, "limit": limit})


@router.get("/support/threads/{thread_id}")
async def get_support_thread_detail(
    thread_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    thread = None
    if db_manager.is_connected and db_manager.db is not None:
        thread = await db_manager.db.support_threads.find_one({"id": thread_id})
    else:
        store = db_manager.memory_store.get("support_threads", {})
        thread = store.get(thread_id)

    if not thread:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Support conversation not found")
    return clean_mongo_doc({"success": True, "data": thread})

@router.post("/support/threads/{thread_id}/reply")
async def reply_support_thread(
    thread_id: str,
    body: SupportReplyReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    Admin sends a reply to the customer in the support thread.
    Also dispatches an in-app notification to the user.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    msg_id = f"msg-{uuid.uuid4().hex[:8]}"

    new_msg = {
        "id": msg_id,
        "sender": "admin",
        "name": admin.get("name", "Superadmin"),
        "text": body.reply.strip(),
        "timestamp": now_iso
    }

    if db_manager.is_connected and db_manager.db is not None:
        thread = await db_manager.db.support_threads.find_one({"id": thread_id})
        if not thread:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Support conversation not found")

        await db_manager.db.support_threads.update_one(
            {"id": thread_id},
            {
                "$push": {"messages": new_msg},
                "$set": {"updated_at": now_iso, "status": "in_progress"}
            }
        )

        # Notify user if account exists
        user_email = thread.get("user_email")
        if user_email:
            user_doc = await db_manager.db.users.find_one({"email": user_email.lower().strip()})
            if user_doc:
                target_uid = user_doc.get("user_id") or user_doc.get("id")
                if target_uid:
                    await AxisDataStore.add_notification(
                        recipient_id=target_uid,
                        title=f"Support Response: {thread.get('subject', 'Inquiry')}",
                        message=body.reply.strip()[:140],
                        notif_type="info",
                        meta={"thread_id": thread_id, "admin": admin.get("name")}
                    )
    else:
        store = db_manager.memory_store.get("support_threads", {})
        thread = store.get(thread_id)
        if not thread:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Support conversation not found")
        thread.setdefault("messages", []).append(new_msg)
        thread["updated_at"] = now_iso
        thread["status"] = "in_progress"
        db_manager.save_memory_store()

    return {"success": True, "message": "Reply dispatched successfully", "data": new_msg}

@router.patch("/support/threads/{thread_id}/status")
async def update_support_thread_status(
    thread_id: str,
    body: SupportStatusReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    valid_statuses = ("open", "in_progress", "resolved")
    if body.status not in valid_statuses:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Status must be one of {valid_statuses}")

    if db_manager.is_connected and db_manager.db is not None:
        res = await db_manager.db.support_threads.update_one(
            {"id": thread_id},
            {"$set": {"status": body.status, "updated_at": now_iso}}
        )
        if res.matched_count == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")
    else:
        store = db_manager.memory_store.get("support_threads", {})
        thread = store.get(thread_id)
        if not thread:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")
        thread["status"] = body.status
        thread["updated_at"] = now_iso
        db_manager.save_memory_store()

    return {"success": True, "status": body.status}

@router.post("/support/threads")
async def create_new_support_thread(
    body: SupportNewThreadReq,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    thread_id = f"th-adm-{uuid.uuid4().hex[:10]}"
    doc = {
        "id": thread_id,
        "user_name": body.user_name or body.user_email.split("@")[0],
        "user_email": body.user_email.lower().strip(),
        "subject": body.subject.strip(),
        "label": body.label or "support",
        "status": "in_progress",
        "messages": [
            {
                "id": f"msg-{uuid.uuid4().hex[:8]}",
                "sender": "admin",
                "name": admin.get("name", "Superadmin"),
                "text": body.message.strip(),
                "timestamp": now_iso
            }
        ],
        "created_at": now_iso,
        "updated_at": now_iso
    }

    if db_manager.is_connected and db_manager.db is not None:
        await db_manager.db.support_threads.insert_one(doc)
    else:
        if "support_threads" not in db_manager.memory_store:
            db_manager.memory_store["support_threads"] = {}
        db_manager.memory_store["support_threads"][thread_id] = doc
        db_manager.save_memory_store()

    return {"success": True, "data": doc}


# ── HOMEPAGE TRAFFIC RECORDING & ANALYTICS ──
@router.get("/traffic/homepage")
async def get_homepage_traffic_metrics(admin: Dict[str, Any] = Depends(get_current_admin)):
    """
    Returns dedicated analytics and telemetry breakdown for the Axis Black landing homepage
    and public landing routes, showing complete client device details, browsers, OS footprints,
    screen resolutions, local device clocks, and recent visitor logs.
    """
    total_views = 0
    unique_visitors = 0
    device_breakdown = {"Desktop": 0, "Mobile": 0, "Tablet": 0}
    browser_breakdown: Dict[str, int] = {}
    os_breakdown: Dict[str, int] = {}
    screen_resolutions: Dict[str, int] = {}
    top_locations: Dict[str, int] = {}
    top_referrers: Dict[str, int] = {}
    recent_visits = []

    hp_query = {
        "$or": [
            {"event": {"$in": ["homepage_visit", "cta_click"]}},
            {"page": {"$in": ["/", "/home", "", "/landing", "/features", "/pricing", "/security", "/contact"]}},
            {"page": {"$regex": r"^/(home|features|pricing|security|contact|landing)?(\?.*)?$", "$options": "i"}}
        ]
    }

    if db_manager.is_connected and db_manager.db is not None:
        try:
            total_views = await db_manager.db.traffic_events.count_documents(hp_query)
            distinct_ips = await db_manager.db.traffic_events.distinct("ip", {**hp_query, "ip": {"$nin": ["", "127.0.0.1", "localhost", "::1"]}})
            distinct_anon = len(await db_manager.db.traffic_events.distinct("visitor_id", {**hp_query, "ip": {"$in": ["", "127.0.0.1", "localhost", "::1"]}}))
            unique_visitors = len(distinct_ips) + distinct_anon

            # Devices breakdown
            dev_agg = await db_manager.db.traffic_events.aggregate([
                {"$match": hp_query},
                {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
            ]).to_list(10)
            for d in dev_agg:
                dt = str(d.get("_id") or "Desktop")
                if dt in device_breakdown:
                    device_breakdown[dt] = d.get("count", 0)

            # Browsers breakdown
            br_agg = await db_manager.db.traffic_events.aggregate([
                {"$match": hp_query},
                {"$group": {"_id": "$browser", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 8}
            ]).to_list(8)
            for b in br_agg:
                br_name = str(b.get("_id") or "Other")
                browser_breakdown[br_name] = b.get("count", 0)

            # Operating systems breakdown
            os_agg = await db_manager.db.traffic_events.aggregate([
                {"$match": hp_query},
                {"$group": {"_id": "$os", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 8}
            ]).to_list(8)
            for o in os_agg:
                o_name = str(o.get("_id") or "Other")
                os_breakdown[o_name] = o.get("count", 0)

            # Screen resolutions
            res_agg = await db_manager.db.traffic_events.aggregate([
                {"$match": hp_query},
                {"$group": {"_id": "$screen_resolution", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 6}
            ]).to_list(6)
            for r in res_agg:
                res_key = str(r.get("_id") or "")
                if res_key:
                    screen_resolutions[res_key] = r.get("count", 0)

            # Geolocation breakdown
            loc_agg = await db_manager.db.traffic_events.aggregate([
                {"$match": hp_query},
                {"$group": {"_id": "$location", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 6}
            ]).to_list(6)
            for l in loc_agg:
                loc_key = str(l.get("_id") or "")
                if loc_key and loc_key != "Unknown":
                    top_locations[loc_key] = l.get("count", 0)

            # Referrers
            ref_pipeline = [
                {"$match": hp_query},
                {"$group": {"_id": "$referrer", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 8}
            ]
            refs = await db_manager.db.traffic_events.aggregate(ref_pipeline).to_list(8)
            for r in refs:
                ref_key = str(r.get("_id") or "Direct")
                top_referrers[ref_key] = r.get("count", 0)

            # Recent landing visitors (with full device and environment telemetry)
            recent_docs = await db_manager.db.traffic_events.find(hp_query).sort([("timestamp", -1), ("last_seen", -1)]).limit(30).to_list(30)
            recent_visits = [clean_mongo_doc(d) for d in recent_docs]
        except Exception as e:
            logger.error(f"Error querying homepage traffic: {e}")
    else:
        events = [e for e in db_manager.memory_store.get("traffic_events", []) if not is_admin_session_dict(e)]
        hp_events = [
            e for e in events
            if e.get("event") in ("homepage_visit", "cta_click")
            or e.get("page") in ("/", "/home", "", "/landing", "/features", "/pricing", "/security", "/contact")
            or re.match(r"^/(home|features|pricing|security|contact|landing)?(\?.*)?$", str(e.get("page", "")), re.IGNORECASE)
        ]
        total_views = len(hp_events)
        unique_visitors = len(set(
            e.get("ip") if (e.get("ip") and e.get("ip") not in ("127.0.0.1", "localhost", "::1")) else (e.get("visitor_id") or e.get("identifier"))
            for e in hp_events
        ))
        for e in hp_events:
            dt = e.get("device_type", "Desktop")
            device_breakdown[dt] = device_breakdown.get(dt, 0) + 1
            br = e.get("browser", "Other")
            browser_breakdown[br] = browser_breakdown.get(br, 0) + 1
            os_name = e.get("os", "Other")
            os_breakdown[os_name] = os_breakdown.get(os_name, 0) + 1
            res = e.get("screen_resolution", "")
            if res:
                screen_resolutions[res] = screen_resolutions.get(res, 0) + 1
            loc = e.get("location", "")
            if loc and loc != "Unknown":
                top_locations[loc] = top_locations.get(loc, 0) + 1
            ref = e.get("referrer") or "Direct"
            top_referrers[ref] = top_referrers.get(ref, 0) + 1
        recent_visits = hp_events[:30]

    # Calculate real conversion rate based on user registrations vs unique landing visitors
    total_users = 0
    if db_manager.is_connected and db_manager.db is not None:
        try:
            total_users = await db_manager.db.users.count_documents({})
        except Exception:
            total_users = 0
    else:
        total_users = len(db_manager.memory_store.get("users", {}))

    conversion_rate = "0.0%"
    if unique_visitors > 0 and total_users > 0:
        cr = min(100.0, (total_users / unique_visitors) * 100.0)
        conversion_rate = f"{cr:.1f}%"

    return clean_mongo_doc({
        "success": True,
        "data": {
            "total_views": total_views,
            "unique_visitors": unique_visitors,
            "conversion_rate": conversion_rate,
            "device_breakdown": device_breakdown,
            "browser_breakdown": browser_breakdown,
            "os_breakdown": os_breakdown,
            "screen_resolutions": screen_resolutions,
            "top_locations": top_locations,
            "top_referrers": top_referrers,
            "recent_visits": recent_visits
        }
    })

# ── COMPATIBILITY ROUTER FOR TRAFFIC CAPTURE ──
compat_router = APIRouter(prefix="/admin", tags=["Admin Compatibility"])

@compat_router.post("/capture")
@compat_router.post("/track")
async def compat_traffic_capture(
    body: CaptureEventReq,
    request: Request,
    background_tasks: BackgroundTasks
):
    return await capture_traffic_event(body, request, background_tasks)


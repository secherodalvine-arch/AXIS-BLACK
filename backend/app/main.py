import os
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import user, dashboard, transactions, voice, auth, storage, inventory, analytics, agent, support, business, spreadsheet, admin, payments

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    from app.services.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    stop_scheduler()
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Axis Black Financial Intelligence Agent Platform",
    lifespan=lifespan
)

# CORS configuration
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://127.0.0.1"
]
configured_origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
allowed_origins = list(dict.fromkeys(default_origins + configured_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handler & Real-Time Error Telemetry ──────
import traceback
import uuid
import datetime
from fastapi import Request
from fastapi.responses import JSONResponse
from app.database import db_manager

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = f"err-{uuid.uuid4().hex[:8]}"
    tb = traceback.format_exc()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log_doc = {
        "id": f"log-{uuid.uuid4().hex[:10]}",
        "timestamp": now_iso,
        "level": "CRITICAL",
        "service": "Backend API",
        "event": "Unhandled Server Exception",
        "message": str(exc) or "Internal Server Error",
        "path": request.url.path,
        "status_code": 500,
        "stack_trace": tb,
        "client_ip": request.client.host if request.client else "unknown",
        "resolved": False
    }
    try:
        if db_manager.is_connected and db_manager.db is not None:
            await db_manager.db.system_logs.insert_one(log_doc)
            await db_manager.db.admin_notifications.insert_one({
                "id": f"notif-{uuid.uuid4().hex[:10]}",
                "title": "Critical Backend Exception",
                "message": f"[500] {str(exc)[:90]} at {request.url.path}",
                "type": "warning",
                "timestamp": now_iso,
                "read": False,
                "link": "/logs"
            })
        else:
            db_manager.memory_store.setdefault("system_logs", []).insert(0, log_doc)
            db_manager.memory_store.setdefault("admin_notifications", []).insert(0, {
                "id": f"notif-{uuid.uuid4().hex[:10]}",
                "title": "Critical Backend Exception",
                "message": f"[500] {str(exc)[:90]} at {request.url.path}",
                "type": "warning",
                "timestamp": now_iso,
                "read": False,
                "link": "/logs"
            })
            db_manager.save_memory_store()
    except Exception:
        pass

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred.", "error_id": error_id}
    )

# ── Auth & Support APIs (public — no user token required) ──────
app.include_router(auth.router)
app.include_router(support.router)

# ── Axis Black Protected API Routers ────────────────────────────
app.include_router(user.router)
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(inventory.router)
app.include_router(analytics.router)
app.include_router(agent.router)
app.include_router(voice.router)
app.include_router(storage.router)
app.include_router(business.router)
app.include_router(spreadsheet.router)
app.include_router(admin.router)
app.include_router(payments.router)
app.include_router(payments.admin_payments_router)




# ── Static & Frontend ───────────────────────────────────────────
# In production (Render), the Vite build is in frontend/dist/.
# In local dev the dist/ may not exist; fall back gracefully.
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
FRONTEND_ASSETS = os.path.join(FRONTEND_DIST, "assets")

if os.path.isdir(FRONTEND_ASSETS):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")

ADMIN_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "admin", "dist")
ADMIN_ASSETS = os.path.join(ADMIN_DIST, "assets")

if os.path.isdir(ADMIN_ASSETS):
    app.mount("/admin/assets", StaticFiles(directory=ADMIN_ASSETS), name="admin_assets")

def _serve_index() -> HTMLResponse:
    """Serve the Vite-built index.html (SPA entry-point)."""
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Frontend not built.</h1><p>Run <code>npm run build</code> in the frontend/ directory.</p>",
            status_code=503,
        )

def _serve_admin_index() -> HTMLResponse:
    """Serve the Vite-built admin index.html."""
    index_path = os.path.join(ADMIN_DIST, "index.html")
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read().replace('href="/assets/', 'href="/admin/assets/').replace('src="/assets/', 'src="/admin/assets/')
            return HTMLResponse(content=content)
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>Admin Frontend not built.</h1><p>Run <code>npm run dev</code> in the admin/ directory or access via port 5174.</p>",
            status_code=503,
        )

@app.get("/admin", response_class=HTMLResponse, tags=["Admin Platform"], include_in_schema=False)
@app.get("/admin/{rest_of_path:path}", response_class=HTMLResponse, tags=["Admin Platform"], include_in_schema=False)
async def serve_admin_spa(rest_of_path: str = ""):
    return _serve_admin_index()

@app.get("/", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_root():
    return _serve_index()


@app.get("/login", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
@app.get("/register", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_spa_auth():
    """Serve the SPA for auth pages so email-app deep-links resolve correctly."""
    return _serve_index()


@app.get("/verify-email", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_verify_email(token: Optional[str] = Query(None)):
    """
    Handles email verification links clicked directly from an email client.

    When FRONTEND_URL == backend URL (Render single-service deployment), the
    verification link in the email points here.  We process the token and
    return a styled HTML result page with a 'Sign In' button.

    When the frontend is hosted separately (Vercel/Netlify), the SPA handles
    the token via the POST /api/auth/verify-email endpoint.  This route still
    works as a graceful fallback in that case.
    """
    from app.routers.auth import verify_email_get
    return await verify_email_get(token)


@app.get("/reset-password", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_reset_password():
    """
    Handles password-reset links clicked directly from an email client.
    Returns the SPA so the PasswordResetPage component can read the token
    from the URL query string.
    """
    return _serve_index()


@app.get("/api/health", tags=["Health Check"])
async def health_check():
    from app.database import db_manager
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mongodb_connected": db_manager.is_connected
    }

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import user, dashboard, transactions, voice, auth, storage, inventory, analytics, agent

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Axis Black Financial Intelligence Agent Platform",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth API (public — no user token required) ──────────────────
app.include_router(auth.router)

# ── Axis Black Protected API Routers ────────────────────────────
app.include_router(user.router)
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(inventory.router)
app.include_router(analytics.router)
app.include_router(agent.router)
app.include_router(voice.router)
app.include_router(storage.router)


# ── Static & Frontend ───────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
STATIC_DIR   = os.path.join(FRONTEND_DIR, "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
@app.get("/index.html", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_frontend():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/login", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
@app.get("/login.html", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_login():
    path = os.path.join(FRONTEND_DIR, "login.html")
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/register", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
@app.get("/register.html", response_class=HTMLResponse, tags=["Frontend"], include_in_schema=False)
async def serve_register():
    path = os.path.join(FRONTEND_DIR, "register.html")
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/health", tags=["Health Check"])
async def health_check():
    from app.database import db_manager
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mongodb_connected": db_manager.is_connected
    }

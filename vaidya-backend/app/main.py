from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.core.middleware import TenantMiddleware
from app.db.session import engine, Base
from app.api.v1 import auth, questions, exams, institute, subscriptions, super_admin, analytics, proctoring_ws, doubts

# ── Router Imports ─────────────────────────────────────────


# ── Lifespan (startup & shutdown) ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"   Environment : {settings.ENVIRONMENT}")
    print(f"   Debug mode  : {settings.DEBUG}")

    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            import app.models  # noqa
            await conn.run_sync(Base.metadata.create_all)
        print("   ✅ Database tables created/verified")

    yield

    print("🔴 Shutting down...")
    await engine.dispose()
    print("   ✅ Database connections closed")


# ── Create FastAPI App ─────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered secure examination platform for Indian coaching institutes.",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ── CORS Middleware ───────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Tenant Middleware ─────────────────────────────────────
app.add_middleware(TenantMiddleware)


# ── Routers (FIRST BLOCK) ─────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Authentication"])
app.include_router(questions.router,     prefix="/api/v1/questions",     tags=["Question Bank"])
app.include_router(exams.router,         prefix="/api/v1/exams",         tags=["Exam Engine"])
app.include_router(institute.router,     prefix="/api/v1/institute",     tags=["Institute Management"])
app.include_router(subscriptions.router, prefix="/api/v1/subscriptions", tags=["Subscriptions & Payments"])
app.include_router(analytics.router,     prefix="/api/v1/analytics",     tags=["Analytics"])
app.include_router(super_admin.router,   prefix="/api/v1/admin",         tags=["Super Admin"])
app.include_router(proctoring_ws.router, prefix="/api/v1/proctoring",    tags=["Proctoring WebSocket"])

app.include_router(doubts.router, prefix="/api/v1/doubts", tags=["AI Doubt Solver"])


# ── Health Endpoint ───────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }


# ── Root Endpoint ─────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    return {"message": f"Welcome to {settings.APP_NAME} API"}

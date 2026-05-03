"""
Vaidya Exam-Shield Platform — FastAPI Application Factory

This is the main entry point for the backend.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.db.session import engine, Base
from app.core.middleware import TenantMiddleware

logger = logging.getLogger("vaidya")

# ── Rate limiter (shared across all routers) ─────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev convenience — use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified / created")
    yield
    await engine.dispose()


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Vaidya Exam-Shield API",
    version="1.0.0",
    description="AI-powered secure examination platform",
    lifespan=lifespan,
)

# ── Attach limiter to app state ──────────────────────────────────────────────
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


# ── Custom 429 handler ───────────────────────────────────────────────────────
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down.",
            "retry_after": "60s",
        },
    )


# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Tenant middleware ────────────────────────────────────────────────────────
app.add_middleware(TenantMiddleware)


# ── Routers ──────────────────────────────────────────────────────────────────
from app.api.v1 import auth, exams, questions, analytics, doubts, institute
from app.api.v1 import proctoring_ws

app.include_router(auth.router,          prefix="/api/v1/auth",      tags=["Auth"])
app.include_router(exams.router,         prefix="/api/v1/exams",     tags=["Exams"])
app.include_router(questions.router,     prefix="/api/v1/questions", tags=["Questions"])
app.include_router(analytics.router,     prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(doubts.router,        prefix="/api/v1/doubts",    tags=["AI Doubt Solver"])
app.include_router(institute.router,     prefix="/api/v1/institute", tags=["Institute"])
app.include_router(proctoring_ws.router, prefix="/api/v1/proctoring",tags=["Proctoring"])


# ── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "vaidya-api"}

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
from collections.abc import AsyncGenerator


# ── Engine ───────────────────────────────────────────────────────────────────
# create_async_engine uses asyncpg driver (postgresql+asyncpg://...)
# pool_size=20  → keep 20 connections open and ready (no reconnect delay)
# max_overflow=10 → allow up to 10 extra connections during traffic spikes
# echo=False    → set True in dev if you want to see every SQL query printed
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    echo=settings.DEBUG,
    pool_pre_ping=True,           # check if connection is alive before using it
)


# ── Session Factory ───────────────────────────────────────────────────────────
# AsyncSessionLocal() gives you a database session for one request.
# expire_on_commit=False → objects stay accessible after commit (important for async)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base Class ────────────────────────────────────────────────────────────────
# All SQLAlchemy models will inherit from this Base.
# When you run `Base.metadata.create_all(engine)` it creates all tables.
class Base(DeclarativeBase):
    pass


# ── Helper: get a DB session ──────────────────────────────────────────────────
# This is used as a FastAPI dependency (injected into route functions).
# The `yield` makes it a context manager — session is automatically
# closed when the request finishes, even if an exception occurs.
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
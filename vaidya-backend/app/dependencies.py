from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import decode_token

# HTTPBearer extracts "Bearer <token>" from the Authorization header automatically
bearer_scheme = HTTPBearer(auto_error=False)


# ── Current User ──────────────────────────────────────────────────────────────
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    The most commonly used dependency across the entire app.

    Inject this into any route that requires authentication.
    It reads request.state (set by TenantMiddleware) and returns
    the full User object from the database.

    Usage:
        @router.get("/me")
        async def get_profile(current_user = Depends(get_current_user)):
            return current_user.email
    """
    # Import here to avoid circular imports
    from app.models.user import User

    # Check if middleware already populated state (it should have)
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact support.",
        )

    return user


# ── Tenant Context ────────────────────────────────────────────────────────────
def get_tenant_id(request: Request) -> str | None:
    """
    Lightweight dependency — just returns the tenant_id from request state.
    Use this in routes that need tenant_id without fetching the full user object.

    Returns None for B2C students (they have no tenant).
    """
    return getattr(request.state, "tenant_id", None)


# ── Role Shortcuts ────────────────────────────────────────────────────────────
# Convenience dependencies for common role checks.
# These are shorthand — use them as Depends() in route definitions.

async def require_super_admin(current_user=Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required.")
    return current_user


async def require_institute_admin(current_user=Depends(get_current_user)):
    if current_user.role not in ("super_admin", "institute_admin"):
        raise HTTPException(status_code=403, detail="Institute Admin access required.")
    return current_user


async def require_faculty(current_user=Depends(get_current_user)):
    if current_user.role not in ("super_admin", "institute_admin", "faculty"):
        raise HTTPException(status_code=403, detail="Faculty access required.")
    return current_user


async def require_student(current_user=Depends(get_current_user)):
    # All authenticated users can access student routes
    # (admins demoing the platform should be able to see student view)
    if not current_user:
        raise HTTPException(status_code=401, detail="Login required.")
    return current_user
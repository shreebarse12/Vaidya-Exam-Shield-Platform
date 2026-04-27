from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import jwt, JWTError
from app.config import settings


# These routes do NOT need a tenant context — they're public
PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/subscriptions/webhook",   # Razorpay webhook — no auth header
}


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Runs on EVERY incoming HTTP request before it reaches any route handler.

    What it does:
    1. Skips public routes (login, register, etc.)
    2. Reads the JWT token from the Authorization header
    3. Decodes it to extract: user_id, role, tenant_id
    4. Attaches them to request.state so any route can access them

    Example — inside any route handler you can now do:
        tenant_id = request.state.tenant_id   # e.g. "abc-123"
        role      = request.state.role        # e.g. "institute_admin"
        user_id   = request.state.user_id     # e.g. "user-456"
    """

    async def dispatch(self, request: Request, call_next):
        # Skip middleware for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # Also skip OPTIONS requests (browser CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Default: no tenant context
        request.state.tenant_id = None
        request.state.user_id = None
        request.state.role = None

        # Extract token from "Authorization: Bearer <token>" header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            try:
                payload = jwt.decode(
                    token,
                    settings.JWT_SECRET_KEY,
                    algorithms=[settings.JWT_ALGORITHM],
                )
                # Attach to request state — available in ALL route handlers
                request.state.user_id = payload.get("sub")         # subject = user_id
                request.state.role = payload.get("role")
                request.state.tenant_id = payload.get("tenant_id") # None for B2C users
            except JWTError:
                # Invalid/expired token — don't block here.
                # The route's own dependency will reject it if auth is required.
                pass

        return await call_next(request)
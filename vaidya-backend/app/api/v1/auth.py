from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.dependencies import get_current_user
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    VerifyOTPRequest,
    VerifyOTPResponse,
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    MessageResponse,
)
from app.services import auth_service

# APIRouter groups all auth endpoints together.
# The prefix "/auth" is added in main.py, so actual paths are:
# /api/v1/auth/register, /api/v1/auth/login, etc.
router = APIRouter()

limiter = Limiter(key_func=get_remote_address)


# ── POST /register ─────────────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user account. Sends a 6-digit OTP to the provided email for verification.",
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,         # FastAPI auto-parses + validates the JSON body
    db: AsyncSession = Depends(get_db),
):
    """
    Flow:
    1. Validate request (Pydantic handles this automatically)
    2. Call service to create user
    3. Return success with instructions for next step
    """
    user = await auth_service.register_user(data, db)

    # Determine what the frontend should do next
    if data.role == "institute_admin":
        next_step = "await_admin_approval"
        message = (
            "Registration received. Please verify your email first, "
            "then await Super Admin approval before you can log in."
        )
    else:
        next_step = "verify_email"
        message = f"Registration successful! We've sent a 6-digit OTP to {data.email}. Please verify your email."

    return RegisterResponse(
        message=message,
        user_id=str(user.id),
        email=user.email,
        next_step=next_step,
    )


# ── POST /verify-email ─────────────────────────────────────────────────────────
@router.post(
    "/verify-email",
    response_model=VerifyOTPResponse,
    summary="Verify email with OTP",
)
@limiter.limit("5/minute")
async def verify_email(
    request: Request,
    data: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.verify_email_otp(data.email, data.otp, db)
    return VerifyOTPResponse(
        message="Email verified successfully! You can now log in.",
        verified=True,
    )


# ── POST /login ────────────────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in",
    description="Returns JWT access token (15 min) and refresh token (7 days).",
)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.login_user(data, db)


# ── POST /refresh ──────────────────────────────────────────────────────────────
@router.post(
    "/refresh",
    summary="Refresh access token",
    description="Exchange a valid refresh token for a new access token.",
)
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.refresh_access_token(data.refresh_token, db)


# ── POST /forgot-password ──────────────────────────────────────────────────────
@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset OTP",
)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.send_password_reset_otp(data.email, db)
    # Always return success — don't tell attackers which emails are registered
    return MessageResponse(
        message="If an account with this email exists, you'll receive a reset OTP shortly."
    )


# ── POST /reset-password ───────────────────────────────────────────────────────
@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password using OTP",
)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.reset_password_with_otp(
        data.email, data.otp, data.new_password, db
    )
    return MessageResponse(message="Password reset successfully. You can now log in.")


# ── POST /change-password ──────────────────────────────────────────────────────
@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change password (logged in)",
    description="Requires a valid access token. Verifies current password before changing.",
)
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),   # 🔒 Protected — must be logged in
):
    await auth_service.change_password(
        current_user, data.current_password, data.new_password, db
    )
    return MessageResponse(message="Password changed successfully.")


# ── GET /me ────────────────────────────────────────────────────────────────────
@router.get(
    "/me",
    summary="Get current user profile",
    description="Returns the profile of the currently logged-in user.",
)
async def get_my_profile(
    current_user=Depends(get_current_user),   # 🔒 Protected
):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "role": current_user.role,
        "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else None,
        "is_email_verified": current_user.is_email_verified,
        "last_login": current_user.last_login,
        "created_at": current_user.created_at,
    }


# ── POST /logout ───────────────────────────────────────────────────────────────
@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out",
)
async def logout(
    current_user=Depends(get_current_user),
):
    """
    For stateless JWT auth, logout is handled on the frontend by
    deleting the access + refresh tokens from storage.

    In a future phase, we can add a token blacklist in Redis
    for immediate invalidation of tokens before they expire.
    """
    return MessageResponse(message="Logged out successfully.")
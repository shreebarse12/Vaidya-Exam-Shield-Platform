import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserInToken,
)


# ── OTP Utilities ──────────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """
    Generate a random 6-digit OTP.
    Example: "482917"
    """
    return "".join(random.choices(string.digits, k=length))


def otp_expiry(minutes: int = 10) -> datetime:
    """OTP expires 10 minutes from now."""
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


# ── Registration ───────────────────────────────────────────────────────────────

async def register_user(
    data: RegisterRequest,
    db: AsyncSession,
) -> User:
    """
    Full registration flow:
    1. Check email is not already taken
    2. If institute_admin → create a new Tenant first
    3. Create the User record
    4. Generate OTP and (in production) send it via email

    Returns the created User object.
    """

    # Step 1: Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in.",
        )

    # Step 2: If registering as institute_admin, create the Tenant first
    tenant_id = None
    if data.role == "institute_admin":
        new_tenant = Tenant(
            name=data.institute_name,
            gstin=data.institute_gstin,
            status="pending",        # Tenant is inactive until Super Admin approves
            subscription_tier="b2b_starter",
        )
        db.add(new_tenant)
        await db.flush()             # flush = send SQL to DB but don't commit yet
                                     # This generates the tenant.id we need below
        tenant_id = new_tenant.id

    # Step 3: Create user
    
    otp = generate_otp()
    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role=data.role,
        tenant_id=tenant_id,
        is_active=True,
        is_email_verified=False,     # Must verify OTP first
        otp_code=otp,
        otp_expires_at=otp_expiry(),
    )
    db.add(new_user)
    await db.flush()

    # Step 4: Send OTP email (async task via Celery in production)
    # For now, print it — you'll wire up SES email in the notifications phase
    print(f"[DEV] OTP for {data.email}: {otp}")
    # In production this will be:
    # from app.tasks.email_tasks import send_otp_email
    # send_otp_email.delay(data.email, otp)

    # Note: session.commit() is handled by get_db() in dependencies.py
    # We just need to flush here to get the generated IDs
    return new_user


# ── OTP Verification ───────────────────────────────────────────────────────────

async def verify_email_otp(
    email: str,
    otp: str,
    db: AsyncSession,
) -> User:
    """
    Verify the 6-digit OTP the user received in their email.
    On success: marks email as verified, clears the OTP.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email.",
        )

    if user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified.",
        )

    # Check OTP hasn't expired
    if not user.otp_expires_at or datetime.now(timezone.utc) > user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one.",
        )

    # Check OTP matches
    if user.otp_code != otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. Please check your email and try again.",
        )

    # Mark email as verified and clear OTP
    user.is_email_verified = True
    user.otp_code = None
    user.otp_expires_at = None

    return user


# ── Login ──────────────────────────────────────────────────────────────────────

async def login_user(
    data: LoginRequest,
    db: AsyncSession,
) -> TokenResponse:
    """
    Full login flow:
    1. Find user by email
    2. Check account isn't locked (too many failed attempts)
    3. Check email is verified
    4. Verify password
    5. Reset failed attempt counter on success
    6. Issue access + refresh tokens

    BRD requirement: 5 failed attempts → 15 minute lockout
    """

    # Step 1: Find user
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Use the same error for "user not found" and "wrong password" —
    # different messages would let attackers know which emails are registered
    invalid_credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not user:
        raise invalid_credentials_error

    # Step 2: Check lockout
    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account is temporarily locked due to too many failed attempts. "
                   f"Try again after {user.locked_until.strftime('%H:%M UTC')}.",
        )

    # Step 3: Check email verified
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. "
                   "Check your inbox for the OTP.",
        )

    # Step 4: Check account active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )

    # Step 5: Verify password
    if not verify_password(data.password, user.password_hash):
        # Increment failed attempt counter
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= 5:
            # Lock account for 15 minutes
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            user.failed_login_attempts = 0  # Reset counter for next attempt cycle
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Account locked for 15 minutes.",
            )

        attempts_remaining = 5 - user.failed_login_attempts
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect password. {attempts_remaining} attempt(s) remaining.",
        )

    # Step 6: Successful login — reset counters, update last login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)

    # Step 7: Create tokens
    access_token = create_access_token(
        user_id=str(user.id),
        role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
    )
    refresh_token = create_refresh_token(user_id=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserInToken(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            is_email_verified=user.is_email_verified,
        ),
    )


# ── Token Refresh ──────────────────────────────────────────────────────────────

async def refresh_access_token(
    refresh_token: str,
    db: AsyncSession,
) -> dict:
    """
    Exchange a valid refresh token for a brand new access token.

    Called by the frontend automatically when the access token expires (every 15 min).
    The user never has to log in again as long as their refresh token is valid.
    """
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please log in again.",
        )

    # Make sure this is actually a refresh token (not an access token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
        )

    new_access_token = create_access_token(
        user_id=str(user.id),
        role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
    )

    return {"access_token": new_access_token, "token_type": "bearer"}


# ── Forgot / Reset Password ────────────────────────────────────────────────────

async def send_password_reset_otp(email: str, db: AsyncSession) -> None:
    """
    Send an OTP for password reset.
    If the email doesn't exist, we silently succeed — don't tell attackers
    which emails are registered on the platform.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        otp = generate_otp()
        user.otp_code = otp
        user.otp_expires_at = otp_expiry(minutes=10)
        print(f"[DEV] Password reset OTP for {email}: {otp}")
        # Production: send_reset_email.delay(email, otp)


async def reset_password_with_otp(
    email: str,
    otp: str,
    new_password: str,
    db: AsyncSession,
) -> None:
    """Verify OTP and update password."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if not user.otp_code or user.otp_code != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP.")

    if datetime.now(timezone.utc) > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

    user.password_hash = hash_password(new_password)
    user.otp_code = None
    user.otp_expires_at = None
    user.failed_login_attempts = 0
    user.locked_until = None


async def change_password(
    user: User,
    current_password: str,
    new_password: str,
    db: AsyncSession,
) -> None:
    """Change password for a logged-in user."""
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    user.password_hash = hash_password(new_password)
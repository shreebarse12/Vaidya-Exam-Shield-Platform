import re
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator


# ── Registration ───────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """
    What the frontend sends when a new user registers.
    Pydantic automatically validates types, formats, and custom rules.
    If anything is wrong, FastAPI returns a 422 error with clear messages.
    """
    email: EmailStr                # Pydantic validates email format automatically
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None

    # Role of the new user
    # Students self-register. Institute admins register then await Super Admin approval.
    role: str = "student"          # Default: student

    # Only needed when role = "institute_admin"
    institute_name: Optional[str] = None
    institute_gstin: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        BRD requirement:
        - Minimum 8 characters
        - At least 1 uppercase letter
        - At least 1 number
        - At least 1 special character
        """
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("at least 1 uppercase letter")
        if not re.search(r"\d", v):
            errors.append("at least 1 number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("at least 1 special character")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"student", "faculty", "institute_admin"}
        # super_admin is NEVER self-registered — only created directly in DB
        if v not in allowed:
            raise ValueError(f"Role must be one of: {allowed}")
        return v

    @model_validator(mode="after")
    def institute_name_required_for_admin(self):
        if self.role == "institute_admin" and not self.institute_name:
            raise ValueError("institute_name is required when registering as an Institute Admin")
        return self


class RegisterResponse(BaseModel):
    """What we send back after successful registration."""
    message: str
    user_id: str
    email: str
    # Tell the frontend what to do next
    next_step: str  # e.g. "verify_email" | "await_admin_approval"


# ── OTP Verification ───────────────────────────────────────────────────────────

class VerifyOTPRequest(BaseModel):
    """
    After registration, user receives a 6-digit OTP on email.
    They submit it here to verify their email address.
    """
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp_format(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class VerifyOTPResponse(BaseModel):
    message: str
    verified: bool


# ── Login ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Standard email + password login."""
    email: EmailStr
    password: str
    # If True, refresh token lasts 30 days instead of 7
    remember_me: bool = False


class TokenResponse(BaseModel):
    """
    Returned on successful login.

    access_token  → short-lived (15 min), sent in Authorization header
    refresh_token → long-lived (7 days), stored in httpOnly cookie on frontend
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # Send back user info so frontend can redirect to the right dashboard
    user: "UserInToken"


class UserInToken(BaseModel):
    """Minimal user info included in the login response."""
    id: str
    email: str
    full_name: str
    role: str
    tenant_id: Optional[str] = None
    is_email_verified: bool


# ── Token Refresh ──────────────────────────────────────────────────────────────

class RefreshTokenRequest(BaseModel):
    """
    Frontend sends the refresh token when the access token expires.
    Gets back a brand new access token without making the user log in again.
    """
    refresh_token: str


# ── Password Management ────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    """User submits their email → we send them a reset OTP."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """User submits the OTP from email + their new password."""
    email: EmailStr
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("at least 1 uppercase letter")
        if not re.search(r"\d", v):
            errors.append("at least 1 number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("at least 1 special character")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return v


class ChangePasswordRequest(BaseModel):
    """Logged-in user wants to change their current password."""
    current_password: str
    new_password: str


class MessageResponse(BaseModel):
    """Generic response for operations that just return a success message."""
    message: str
    success: bool = True


# Needed because UserInToken is referenced before definition
TokenResponse.model_rebuild()
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings


# ── Password Hashing ──────────────────────────────────────────────────────────
# bcrypt is the gold standard for hashing passwords.
# "deprecated=auto" means old hash formats are automatically re-hashed on login.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """
    Convert plain text → bcrypt hash.
    Example: "mypassword123" → "$2b$12$..."
    This is a one-way operation — you cannot reverse it.
    """
    return pwd_context.hash(plain_password[:72])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check if entered password matches the stored hash.
    Used during login.
    """
    return pwd_context.verify(plain_password[:72], hashed_password)


# ── JWT Token Creation ────────────────────────────────────────────────────────
def create_access_token(
    user_id: str,
    role: str,
    tenant_id: Optional[str] = None,
) -> str:
    """
    Create a short-lived JWT access token (15 minutes).

    Payload contains:
    - sub       : user_id (standard JWT "subject" field)
    - role      : super_admin | institute_admin | faculty | student
    - tenant_id : institute's UUID (None for B2C students)
    - exp       : expiry timestamp (auto-checked by jwt.decode)

    The frontend sends this in every API request:
    Authorization: Bearer <access_token>
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """
    Create a long-lived JWT refresh token (7 days).

    This token is ONLY used to get a new access token when it expires.
    It contains minimal data — just user_id and expiry.
    Stored in an httpOnly cookie on the frontend (not localStorage).
    """
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def generate_temp_password(length: int = 12) -> str:
    """Generate a random temporary password for admin-created accounts."""
    import secrets, string
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def decode_token(token: str) -> dict:
    """
    Decode a JWT token and return the payload.
    Raises JWTError if token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
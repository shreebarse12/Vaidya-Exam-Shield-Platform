import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import UUIDMixin, TimestampMixin
from app.db.session import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class User(UUIDMixin, TimestampMixin, Base):
    """
    Single table for ALL user types:
    - super_admin    → platform owner, no tenant
    - institute_admin → manages one institute (has tenant_id)
    - faculty         → creates exams/questions (has tenant_id)
    - student         → takes exams (has tenant_id for B2B, NULL for B2C)

    Why one table instead of separate tables per role?
    - Simpler queries (no JOINs just to find "any user by email")
    - Auth logic is identical for all roles
    - Role-specific data can go in separate profile tables later if needed
    """
    __tablename__ = "users"

    # ── Identity ───────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
        # index=True → PostgreSQL creates a B-tree index on email
        # This makes "SELECT * FROM users WHERE email = ?" extremely fast
        # Without index, every login would do a full table scan
    )
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Bcrypt hash — never store plain text passwords
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Profile ────────────────────────────────────────────────────────────
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    profile_pic_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Role ───────────────────────────────────────────────────────────────
    # Values: "super_admin" | "institute_admin" | "faculty" | "student"
    role: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # ── Multi-tenancy ──────────────────────────────────────────────────────
    # NULL for super_admin and B2C students
    # Set for institute_admin, faculty, and B2B students
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,  # heavily queried — "give me all users for tenant X"
    )

    # ── Account Status ─────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Email must be verified before login is allowed
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Security ───────────────────────────────────────────────────────────
    # Track failed login attempts → lock account after 5 failures
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # When the lockout expires — NULL means not locked
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # OTP for email verification and phone verification
    # Stored as plain text (short-lived, not a password)
    otp_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    otp_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── OAuth ──────────────────────────────────────────────────────────────
    # If user signed up via Google, store their Google ID here
    google_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────
    tenant: Mapped[Optional["Tenant"]] = relationship(  # noqa: F821
        "Tenant",
        back_populates="users",
    )

    # ── Computed Properties ────────────────────────────────────────────────
    @property
    def full_name(self) -> str:
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.email.split("@")[0]

    @property
    def is_locked(self) -> bool:
        """Check if account is currently locked due to too many failed logins."""
        if self.locked_until is None:
            return False
        from datetime import timezone
        from datetime import datetime
        return datetime.now(timezone.utc) < self.locked_until

    def __repr__(self):
        return f"<User id={self.id} email={self.email} role={self.role}>"
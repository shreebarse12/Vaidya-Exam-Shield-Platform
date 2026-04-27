import uuid
from typing import Optional
from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import UUIDMixin, TimestampMixin
from app.db.session import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

class Tenant(UUIDMixin, TimestampMixin, Base):
    """
    Represents one coaching institute on the platform.

    Every B2B user (institute admin, faculty, student) belongs to a Tenant.
    B2C users have no Tenant (tenant_id = NULL in the users table).

    Think of Tenant as the "apartment" in our multi-tenant building.
    All data inside one tenant is invisible to other tenants.
    """
    __tablename__ = "tenants"

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Subdomain for potential white-label use: abc-coaching.vaidya.in
    # unique=True ensures no two institutes get the same subdomain
    subdomain: Mapped[Optional[str]] = mapped_column(
        String(100), unique=True, nullable=True
    )

    # Which plan this institute is on
    # Values: "b2b_starter" | "b2b_enterprise"
    subscription_tier: Mapped[str] = mapped_column(
        String(50), default="b2b_starter", nullable=False
    )

    # Account status
    # Values: "active" | "suspended" | "deleted"
    # Suspended = access revoked but data retained (missed payment etc.)
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False
    )

    # Flexible key-value store for institute-specific config.
    # JSONB = PostgreSQL's binary JSON — supports indexing & querying inside JSON.
    # Example contents:
    # {
    #   "logo_url": "https://s3.../logo.png",
    #   "primary_color": "#FF5733",
    #   "secondary_color": "#333333",
    #   "welcome_message": "Welcome to ABC Coaching!",
    #   "allow_cross_institute_ranking": false
    # }
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    # Contact info
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────
    # "lazy='dynamic'" means SQLAlchemy won't load all users when you load a tenant.
    # You have to explicitly query: tenant.users.all()
    users: Mapped[list["User"]] = relationship(  # noqa: F821
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Tenant id={self.id} name={self.name} status={self.status}>"
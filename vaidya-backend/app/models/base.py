import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    """
    Add this to any model to get created_at + updated_at columns for free.

    created_at → set once when the row is first inserted
    updated_at → automatically updated every time the row changes
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class UUIDMixin:
    """
    Use UUID as primary key instead of integer.

    Why UUID over integer?
    - Integers are predictable: user id=1, id=2, id=3
      An attacker can enumerate all users by guessing IDs.
    - UUIDs are random: "550e8400-e29b-41d4-a716-446655440000"
      Cannot be guessed or enumerated.
    - Safe to expose in URLs: /api/v1/users/550e8400-...
    """
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
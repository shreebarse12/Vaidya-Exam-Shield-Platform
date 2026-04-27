import uuid
from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import UUIDMixin, TimestampMixin
from app.db.session import Base


class Batch(UUIDMixin, TimestampMixin, Base):
    """Organises students into groups within an institute (e.g. 'NEET Batch A 2026')."""
    __tablename__ = "batches"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    faculty_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    students: Mapped[list["BatchStudent"]] = relationship(
        "BatchStudent", back_populates="batch", cascade="all, delete-orphan"
    )


class BatchStudent(UUIDMixin, Base):
    """Junction: which students belong to which batch."""
    __tablename__ = "batch_students"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    batch: Mapped["Batch"] = relationship("Batch", back_populates="students")
import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import UUIDMixin
from app.db.session import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.exam import ExamAttempt

class ProctoringLog(UUIDMixin, Base):
    """
    Every suspicious event during an exam creates one row here.
    Types: face_missing | multiple_faces | mobile_detected | tab_switch
           fullscreen_exit | keyword_detected | gaze_away

    severity: low | medium | high
    - low:    yellow warning shown to student, logged only
    - medium: orange warning, requires re-focus
    - high:   red warning, contributes toward auto-submission
    """
    __tablename__ = "proctoring_logs"

    exam_attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # S3 URLs for snapshot / audio clip evidence
    snapshot_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Extra context: {"confidence": 0.92, "detected_objects": ["cell_phone"]}
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Admin review fields
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_valid: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)  # None = not reviewed
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    attempt: Mapped["ExamAttempt"] = relationship("ExamAttempt", back_populates="proctoring_logs")  # noqa
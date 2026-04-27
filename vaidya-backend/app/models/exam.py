import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import UUIDMixin, TimestampMixin
from app.db.session import Base
from app.models.user import User


# from typing import TYPE_CHECKING

# if TYPE_CHECKING:
from app.models.proctoring import ProctoringLog
    
    
    
class Exam(UUIDMixin, TimestampMixin, Base):
    """
    An exam belongs to a tenant. Faculty creates it.
    config JSONB stores sections, proctoring settings, shuffling flags — all flexible.

    config example:
    {
      "sections": [
        {"name": "Physics", "duration_seconds": 1800, "question_count": 45},
        {"name": "Chemistry", "duration_seconds": 1800, "question_count": 45}
      ],
      "shuffle_questions": true,
      "shuffle_options": true,
      "calculator_enabled": false,
      "proctoring_level": "standard",   // none | basic | standard | advanced
      "show_answers_after": "submission" // immediately | submission | evaluation
    }
    """
    __tablename__ = "exams"

    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # All flexible config in one JSONB column
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)  # total exam time
    passing_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    negative_marking: Mapped[float] = mapped_column(Float, default=0.25, nullable=False)

    # Scheduled window — students can only start within this window
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # draft → published → ongoing → completed → archived
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)

    # Relationships
    exam_questions: Mapped[list["ExamQuestion"]] = relationship(
        "ExamQuestion", back_populates="exam", cascade="all, delete-orphan"
    )
    attempts: Mapped[list["ExamAttempt"]] = relationship(
        "ExamAttempt", back_populates="exam", cascade="all, delete-orphan"
    )


class ExamQuestion(UUIDMixin, Base):
    """
    Junction table: which questions are in which exam, in what order, which section.
    This is a SNAPSHOT — if the question is later edited, this record stays as-is.
    That's why we store question_snapshot: the question text+options at creation time.
    """
    __tablename__ = "exam_questions"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="SET NULL"), nullable=True
    )
    section_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)  # order within section

    # Full question snapshot at time of exam creation
    # This means question edits never affect in-progress or past exams
    question_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)

    exam: Mapped["Exam"] = relationship("Exam", back_populates="exam_questions")


class ExamAssignment(UUIDMixin, TimestampMixin, Base):
    """
    Controls which students/batches can take a specific exam.
    An exam can be assigned to individual students or whole batches.
    """
    __tablename__ = "exam_assignments"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    # Assign to individual student OR to a whole batch (one of these will be set)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=True
    )
    attempts_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class ExamAttempt(UUIDMixin, TimestampMixin, Base):
    """
    One row per student per exam attempt.
    This is the most important table during exam-taking — everything the
    student does (answers, timer, proctoring flags) links here.

    answers JSONB example:
    {
      "q_uuid_1": "B",
      "q_uuid_2": "A",
      "q_uuid_3": null   <- not answered
    }

    section_scores JSONB example:
    {
      "Physics": {"score": 140, "correct": 35, "wrong": 15, "unattempted": 5},
      "Chemistry": {"score": 90, "correct": 25, "wrong": 20, "unattempted": 10}
    }
    """
    __tablename__ = "exam_attempts"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # in_progress | submitted | auto_submitted | abandoned
    status: Mapped[str] = mapped_column(String(20), default="in_progress", nullable=False)

    # All student answers as {question_id: selected_option}
    answers: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Computed after submission
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    percentile: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    section_scores: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Number of proctoring flags raised during this attempt
    proctoring_flags_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam", back_populates="attempts")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])  # noqa
    proctoring_logs: Mapped[list["ProctoringLog"]] = relationship(  # noqa
        "ProctoringLog", back_populates="attempt", cascade="all, delete-orphan"
    )
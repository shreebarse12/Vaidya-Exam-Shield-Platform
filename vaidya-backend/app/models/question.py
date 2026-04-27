import uuid
from typing import Optional
from sqlalchemy import String, Text, Float, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from app.models.base import UUIDMixin, TimestampMixin
from app.db.session import Base
from app.models.user import User

class Question(UUIDMixin, TimestampMixin, Base):
    """
    Stores every question on the platform — both global (created by Super Admin
    for all institutes to use) and tenant-specific (created by faculty).

    How to tell them apart:
    - tenant_id = NULL  → global question (visible to all institutes)
    - tenant_id = <id>  → belongs to one specific institute only

    Question types supported now: MCQ (multiple choice)
    Future phases: Integer type, Subjective, Coding
    """
    __tablename__ = "questions"

    # ── Ownership ──────────────────────────────────────────────────────────
    # NULL = global question bank (Super Admin created)
    # Set  = institute-private question
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Question Content ───────────────────────────────────────────────────
    # Rich text — can contain HTML tags for bold, italic, superscript etc.
    # Example: "What is the value of <sup>2</sup>H in water?"
    question_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Type of question
    # "mcq"     → 4 options, one correct answer
    # "integer" → student types a number (JEE style)
    question_type: Mapped[str] = mapped_column(
        String(20), default="mcq", nullable=False
    )

    # MCQ options stored as a JSON array.
    # Structure: [{"key": "A", "text": "Newton"}, {"key": "B", "text": "Joule"}, ...]
    # Using JSONB so we can query inside the JSON if needed
    options: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Correct answer(s) stored as JSON.
    # MCQ example:    {"answer": "B"}
    # Integer example: {"answer": 42}
    correct_answer: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # Explanation shown to student AFTER they submit the exam
    # Also rich text — can contain formulas, diagrams via image URLs
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Optional image attached to the question (stored in S3)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Classification ─────────────────────────────────────────────────────
    # These are used for:
    # 1. Filtering/searching the question bank
    # 2. AI weak topic identification
    # 3. Section mapping in exams
    subject: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    topic: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    subtopic: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # "easy" | "medium" | "hard"
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)

    # Free-form tags for flexible searching
    # Stored as PostgreSQL native array — supports: WHERE 'NEET' = ANY(tags)
    # Example: ["NEET", "2023", "PYQ", "important"]
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)

    # ── Scoring ────────────────────────────────────────────────────────────
    marks: Mapped[float] = mapped_column(Float, default=4.0, nullable=False)
    negative_marks: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # ── Status ─────────────────────────────────────────────────────────────
    # "draft"     → visible only to creator, not usable in exams yet
    # "published" → available for use in exams
    # "archived"  → hidden from normal view, kept for historical data
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)

    # ── Versioning ─────────────────────────────────────────────────────────
    # Every time a question is edited, version increments.
    # Exams SNAPSHOT the question at creation time so edits
    # don't retroactively change past exam results.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # ── Relationships ──────────────────────────────────────────────────────
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])  # noqa

    def __repr__(self):
        return f"<Question id={self.id} subject={self.subject} difficulty={self.difficulty}>"
import uuid
from typing import Optional, List
from pydantic import BaseModel, field_validator


# ── Option shape (used inside MCQ questions) ───────────────────────────────────
class MCQOption(BaseModel):
    """
    One option in a multiple choice question.
    Example: {"key": "A", "text": "Newton"}
    """
    key: str          # "A", "B", "C", or "D"
    text: str         # The option text (can contain HTML for rich text)

    @field_validator("key")
    @classmethod
    def validate_key(cls, v):
        if v not in ("A", "B", "C", "D"):
            raise ValueError("Option key must be A, B, C, or D")
        return v


# ── Create ─────────────────────────────────────────────────────────────────────
class QuestionCreateRequest(BaseModel):
    """
    What faculty sends when creating a new question.
    All classification fields are optional — can be filled in later.
    """
    question_text: str
    question_type: str = "mcq"

    # Required for MCQ, not needed for integer type
    options: Optional[List[MCQOption]] = None

    # MCQ:     {"answer": "B"}
    # Integer: {"answer": 42}
    correct_answer: dict

    explanation: Optional[str] = None
    image_url: Optional[str] = None

    # Classification
    subject: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None

    # Scoring
    marks: float = 4.0
    negative_marks: float = 1.0

    # "draft" = save but don't make available in exams yet
    # "published" = immediately available for exam creation
    status: str = "draft"

    @field_validator("question_type")
    @classmethod
    def validate_type(cls, v):
        if v not in ("mcq", "integer"):
            raise ValueError("question_type must be 'mcq' or 'integer'")
        return v

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v):
        if v and v not in ("easy", "medium", "hard"):
            raise ValueError("difficulty must be easy, medium, or hard")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in ("draft", "published"):
            raise ValueError("status must be 'draft' or 'published'")
        return v


# ── Update ─────────────────────────────────────────────────────────────────────
class QuestionUpdateRequest(BaseModel):
    """
    All fields are optional — send only what you want to change.
    This is called a "partial update" or PATCH pattern.
    """
    question_text: Optional[str] = None
    options: Optional[List[MCQOption]] = None
    correct_answer: Optional[dict] = None
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None
    marks: Optional[float] = None
    negative_marks: Optional[float] = None
    status: Optional[str] = None


# ── Response ───────────────────────────────────────────────────────────────────
class QuestionResponse(BaseModel):
    """
    What the API sends back when returning a question.
    Never exposes correct_answer unless the exam is submitted.
    """
    id: str
    tenant_id: Optional[str]
    question_text: str
    question_type: str
    options: Optional[List[MCQOption]]
    explanation: Optional[str]
    image_url: Optional[str]
    subject: Optional[str]
    topic: Optional[str]
    subtopic: Optional[str]
    difficulty: Optional[str]
    tags: Optional[List[str]]
    marks: float
    negative_marks: float
    status: str
    version: int
    created_by: Optional[str]

    # Note: correct_answer is intentionally NOT in this schema.
    # It's only included in QuestionWithAnswerResponse (used after exam submission).

    model_config = {"from_attributes": True}


class QuestionWithAnswerResponse(QuestionResponse):
    """
    Same as QuestionResponse but includes the correct answer.
    Only used in two places:
    1. Faculty editing questions
    2. Student viewing results after exam submission
    """
    correct_answer: dict


# ── List Response ──────────────────────────────────────────────────────────────
class QuestionListResponse(BaseModel):
    """Paginated list of questions."""
    questions: List[QuestionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Bulk Import ────────────────────────────────────────────────────────────────
class BulkImportResult(BaseModel):
    """
    Summary returned after a CSV bulk import.
    Tells faculty how many questions were created vs failed.
    """
    total_rows: int
    successful: int
    failed: int
    errors: List[dict]   # [{"row": 3, "error": "Missing subject"}, ...]


# ── Filters ────────────────────────────────────────────────────────────────────
class QuestionFilters(BaseModel):
    """
    Query parameters for filtering the question bank.
    All optional — combine them to narrow results.
    """
    subject: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
    question_type: Optional[str] = None
    search: Optional[str] = None    # Full-text search on question_text
    tags: Optional[List[str]] = None
    page: int = 1
    page_size: int = 20
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, field_validator


# ── Section config (inside exam config JSONB) ──────────────────────────────────
class ExamSection(BaseModel):
    name: str                       # "Physics", "Chemistry"
    duration_seconds: int           # Time limit for this section
    question_count: int             # How many questions to pull


class ExamConfig(BaseModel):
    """Flexible exam settings stored as JSONB in the exam row."""
    sections: List[ExamSection] = []
    shuffle_questions: bool = True
    shuffle_options: bool = True
    calculator_enabled: bool = False
    # none | basic | standard | advanced
    proctoring_level: str = "standard"
    # immediately | submission | evaluation
    show_answers_after: str = "submission"


# ── Create Exam ────────────────────────────────────────────────────────────────
class ExamCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    duration_seconds: int           # Total exam duration in seconds
    passing_percentage: Optional[float] = None
    max_attempts: int = 1
    negative_marking: float = 0.25
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    config: ExamConfig = ExamConfig()
    # List of question IDs to include (in order)
    question_ids: List[str] = []
    # Or assign questions per section
    sections: Optional[List[dict]] = None


class ExamUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_seconds: Optional[int] = None
    passing_percentage: Optional[float] = None
    max_attempts: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    config: Optional[ExamConfig] = None
    status: Optional[str] = None


# ── Exam Response ──────────────────────────────────────────────────────────────
class ExamResponse(BaseModel):
    id: str
    tenant_id: Optional[str]
    name: str
    description: Optional[str]
    duration_seconds: int
    passing_percentage: Optional[float]
    max_attempts: int
    negative_marking: float
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    status: str
    config: dict
    question_count: int = 0
    created_by: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Exam Interface (what student sees while taking exam) ───────────────────────
class QuestionForStudent(BaseModel):
    """
    Question as sent to a student during an exam.
    NEVER includes correct_answer — that would let them cheat.
    """
    id: str
    question_text: str
    question_type: str
    options: Optional[List[dict]]   # [{"key": "A", "text": "..."}]
    image_url: Optional[str]
    marks: float
    negative_marks: float
    section_name: Optional[str]
    sequence: int


class ExamStartResponse(BaseModel):
    """Everything the frontend needs to render the exam interface."""
    attempt_id: str
    exam_id: str
    exam_name: str
    duration_seconds: int
    sections: List[dict]            # section name + duration + question range
    questions: List[QuestionForStudent]
    config: dict
    started_at: datetime
    # Previously saved answers (for resume after crash)
    saved_answers: Dict[str, Any] = {}


# ── Answer Save ────────────────────────────────────────────────────────────────
class SaveAnswersRequest(BaseModel):
    """
    Frontend sends this every 30 seconds (auto-save) and on every answer change.
    answers: {question_id: selected_option_key or null}
    """
    attempt_id: str
    answers: Dict[str, Optional[str]]  # {"q_id_1": "B", "q_id_2": null}


# ── Exam Submission ────────────────────────────────────────────────────────────
class SubmitExamRequest(BaseModel):
    attempt_id: str
    answers: Dict[str, Optional[str]]
    # Proctoring events collected on frontend
    proctoring_events: List[dict] = []
    time_spent_seconds: Optional[int] = None


# ── Result ─────────────────────────────────────────────────────────────────────
class QuestionResult(BaseModel):
    """Per-question breakdown shown in results."""
    question_id: str
    question_text: str
    options: Optional[List[dict]]
    student_answer: Optional[str]
    correct_answer: str
    is_correct: bool
    marks_awarded: float
    explanation: Optional[str]
    section_name: Optional[str]


class ExamResultResponse(BaseModel):
    attempt_id: str
    exam_id: str
    exam_name: str
    score: float
    max_score: float
    percentage: float
    rank: Optional[int]
    percentile: Optional[float]
    total_participants: Optional[int]
    section_scores: Optional[dict]
    passing_percentage: Optional[float]
    passed: Optional[bool]
    time_taken_seconds: Optional[int]
    submitted_at: Optional[datetime]
    questions: Optional[List[QuestionResult]] = None  # Only if show_answers_after allows
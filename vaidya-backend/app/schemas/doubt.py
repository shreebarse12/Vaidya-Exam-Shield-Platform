from pydantic import BaseModel
from typing import List, Literal

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class DoubtAskRequest(BaseModel):
    question: str
    history: List[ChatMessage] = []

class DoubtAskResponse(BaseModel):
    answer: str


class DoubtExamAnalysisResponse(BaseModel):
    answer: str
    attempt_id: str
    exam_id: str
    exam_name: str
    wrong_count: int


class StudentExamOption(BaseModel):
    attempt_id: str
    exam_id: str
    exam_name: str
    submitted_at: str | None = None
    score: float | None = None
    percentage: float | None = None


class StudentExamOptionListResponse(BaseModel):
    exams: List[StudentExamOption]

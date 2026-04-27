from fastapi import APIRouter, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import io

from app.db.session import get_db
from app.dependencies import get_current_user, require_faculty
from app.schemas.question import (
    QuestionCreateRequest,
    QuestionUpdateRequest,
    QuestionResponse,
    QuestionWithAnswerResponse,
    QuestionListResponse,
    BulkImportResult,
    QuestionFilters,
)
from app.services import question_service

router = APIRouter()


# ── POST /questions — Create one question ──────────────────────────────────────
@router.post(
    "",
    response_model=QuestionWithAnswerResponse,
    status_code=201,
    summary="Create a question",
)
async def create_question(
    data: QuestionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),     # 🔒 Faculty, Admin, Super Admin only
):
    """
    Create a single MCQ or Integer-type question.

    - Faculty → saved to their institute's private question bank
    - Super Admin → saved to the global question bank (available to all institutes)
    """
    question = await question_service.create_question(data, current_user, db)
    return _to_response_with_answer(question)


# ── GET /questions — List with filters ────────────────────────────────────────
@router.get(
    "",
    response_model=QuestionListResponse,
    summary="List questions",
)
async def list_questions(
    # All filter params come from the URL query string
    # Example: /api/v1/questions?subject=Physics&difficulty=hard&page=2
    subject: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in question text"),
    tags: Optional[List[str]] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    filters = QuestionFilters(
        subject=subject,
        topic=topic,
        difficulty=difficulty,
        status=status,
        question_type=question_type,
        search=search,
        tags=tags,
        page=page,
        page_size=page_size,
    )
    result = await question_service.list_questions(filters, current_user, db)
    return QuestionListResponse(
        questions=[_to_response(q) for q in result["questions"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


# ── GET /questions/{id} — Get single question ──────────────────────────────────
@router.get(
    "/{question_id}",
    response_model=QuestionWithAnswerResponse,
    summary="Get a question by ID",
)
async def get_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    """Returns the question including the correct answer (for faculty/admin)."""
    question = await question_service.get_question_by_id(question_id, current_user, db)
    return _to_response_with_answer(question)


# ── PATCH /questions/{id} — Update question ────────────────────────────────────
@router.patch(
    "/{question_id}",
    response_model=QuestionWithAnswerResponse,
    summary="Update a question",
)
async def update_question(
    question_id: str,
    data: QuestionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    """
    Partial update — only send the fields you want to change.
    Every update increments the question version.
    """
    question = await question_service.update_question(
        question_id, data, current_user, db
    )
    return _to_response_with_answer(question)


# ── DELETE /questions/{id} — Archive question ──────────────────────────────────
@router.delete(
    "/{question_id}",
    status_code=204,
    summary="Archive a question (soft delete)",
)
async def delete_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    """
    Soft deletes by setting status = 'archived'.
    The question won't appear in normal listings but historical exam data is preserved.
    """
    await question_service.delete_question(question_id, current_user, db)


# ── POST /questions/bulk-import — CSV Upload ───────────────────────────────────
@router.post(
    "/bulk-import",
    response_model=BulkImportResult,
    summary="Bulk import questions from CSV",
)
async def bulk_import(
    file: UploadFile = File(..., description="CSV file. Download the template first."),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    """
    Upload a CSV file to import multiple questions at once.
    Download the template first from GET /questions/template.

    - Processes each row independently
    - Failed rows are reported with row number + reason
    - Successful rows are saved even if other rows fail
    """
    return await question_service.bulk_import_from_csv(file, current_user, db)


# ── GET /questions/template — Download CSV template ───────────────────────────
@router.get(
    "/template",
    summary="Download CSV import template",
    response_description="CSV file with headers and example rows",
)
async def download_template(
    current_user=Depends(require_faculty),
):
    """
    Returns a CSV file with the correct column headers and 2 example rows.
    Faculty fills this in and uploads via POST /questions/bulk-import.
    """
    csv_content = question_service.generate_csv_template()
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=question_import_template.csv"
        },
    )


# ── Helper: convert SQLAlchemy model → Pydantic schema ─────────────────────────
def _to_response(q) -> QuestionResponse:
    return QuestionResponse(
        id=str(q.id),
        tenant_id=str(q.tenant_id) if q.tenant_id else None,
        question_text=q.question_text,
        question_type=q.question_type,
        options=q.options,
        explanation=q.explanation,
        image_url=q.image_url,
        subject=q.subject,
        topic=q.topic,
        subtopic=q.subtopic,
        difficulty=q.difficulty,
        tags=q.tags,
        marks=q.marks,
        negative_marks=q.negative_marks,
        status=q.status,
        version=q.version,
        created_by=str(q.created_by) if q.created_by else None,
    )


def _to_response_with_answer(q) -> QuestionWithAnswerResponse:
    return QuestionWithAnswerResponse(
        **_to_response(q).model_dump(),
        correct_answer=q.correct_answer,
    )
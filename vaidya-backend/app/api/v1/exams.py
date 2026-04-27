from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import uuid

from app.db.session import get_db
from app.dependencies import get_current_user, require_faculty, require_student
from app.schemas.exam import (
    ExamCreateRequest, ExamUpdateRequest, ExamResponse,
    ExamStartResponse, SaveAnswersRequest, SubmitExamRequest, ExamResultResponse,
)
from app.services import exam_service
from app.models.exam import Exam, ExamQuestion

router = APIRouter()


@router.post("", response_model=ExamResponse, status_code=201, summary="Create exam")
async def create_exam(
    data: ExamCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    exam = await exam_service.create_exam(data, current_user, db)
    return _to_response(exam, len(data.question_ids))


@router.get("", summary="List exams")
async def list_exams(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    exams = await exam_service.list_exams(current_user, db, status)

    if exams:
        exam_ids = [e.id for e in exams]
        counts_result = await db.execute(
            select(ExamQuestion.exam_id, func.count(ExamQuestion.id))
            .where(ExamQuestion.exam_id.in_(exam_ids))
            .group_by(ExamQuestion.exam_id)
        )
        counts = {row[0]: row[1] for row in counts_result.fetchall()}
    else:
        counts = {}

    return [_to_response(e, counts.get(e.id, 0)) for e in exams]


@router.post("/save-answers", summary="Auto-save answers (student)")
async def save_answers(
    data: SaveAnswersRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_student),
):
    await exam_service.save_answers(data.attempt_id, data.answers, db)
    return {"saved": True}


@router.post("/submit", response_model=ExamResultResponse, summary="Submit exam (student)")
async def submit_exam(
    data: SubmitExamRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_student),
):
    return await exam_service.submit_exam(data, current_user, db)


@router.get("/timer/{attempt_id}", summary="Get current timer state")
async def get_timer(
    attempt_id: str,
    current_user=Depends(require_student),
):
    state = await exam_service.get_timer_state(attempt_id)
    if not state:
        return {"error": "Timer not found. Exam may have ended."}
    return state


@router.get("/{exam_id}", response_model=ExamResponse, summary="Get exam by ID")
async def get_exam(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    exam = await exam_service.get_exam_by_id(exam_uuid, current_user, db)

    count_result = await db.execute(
        select(func.count(ExamQuestion.id)).where(ExamQuestion.exam_id == exam_uuid)
    )
    count = count_result.scalar() or 0

    return _to_response(exam, count)


@router.post("/{exam_id}/publish", summary="Publish exam — makes it live for students")
async def publish_exam(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    exam = await exam_service.publish_exam(exam_uuid, current_user, db)

    return {
        "message": f"Exam '{exam.name}' is now published.",
        "status": exam.status
    }


@router.post("/{exam_id}/publish-ranks", summary="Publish exam ranking after exam end")
async def publish_exam_ranks(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    exam = await exam_service.publish_exam_ranks(exam_uuid, current_user, db)

    return {
        "message": f"Ranks for '{exam.name}' are now published.",
        "rank_published": (exam.config or {}).get("rank_published", False),
    }


@router.post("/{exam_id}/unpublish", summary="Unpublish exam — back to draft")
async def unpublish_exam(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_faculty),
):
    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    result = await db.execute(select(Exam).where(Exam.id == exam_uuid))
    exam = result.scalar_one_or_none()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if str(exam.tenant_id) != str(current_user.tenant_id) and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied.")

    exam.status = "draft"

    return {
        "message": f"Exam '{exam.name}' moved back to draft.",
        "status": "draft"
    }


@router.post("/{exam_id}/start", response_model=ExamStartResponse, summary="Start exam (student)")
async def start_exam(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_student),
):
    try:
        exam_uuid = uuid.UUID(exam_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam ID format.")

    return await exam_service.start_exam(exam_uuid, current_user, db)


def _to_response(exam, question_count: int) -> ExamResponse:
    return ExamResponse(
        id=str(exam.id),
        tenant_id=str(exam.tenant_id) if exam.tenant_id else None,
        name=exam.name,
        description=exam.description,
        duration_seconds=exam.duration_seconds,
        passing_percentage=exam.passing_percentage,
        max_attempts=exam.max_attempts,
        negative_marking=exam.negative_marking,
        start_time=exam.start_time,
        end_time=exam.end_time,
        status=exam.status,
        config=exam.config or {},
        question_count=question_count,
        created_by=str(exam.created_by) if exam.created_by else None,
        created_at=exam.created_at,
    )

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.session import get_db
from app.dependencies import require_student
from app.schemas.doubt import (
    DoubtAskRequest,
    DoubtAskResponse,
    DoubtExamAnalysisResponse,
    StudentExamOptionListResponse,
)
from app.services.doubt_service import (
    analyze_exam_attempt,
    analyze_last_exam,
    answer_doubt,
    list_student_submitted_exams,
)

router = APIRouter()

limiter = Limiter(key_func=get_remote_address)


@router.post("/ask", response_model=DoubtAskResponse, summary="Ask AI doubt")
@limiter.limit("30/minute")
async def ask_doubt(
    request: Request,
    data: DoubtAskRequest,
    current_user=Depends(require_student),
):
    try:
        answer = await answer_doubt(data.question, data.history)
        return DoubtAskResponse(answer=answer)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {exc}")


@router.post("/analyze-last-exam", response_model=DoubtExamAnalysisResponse, summary="Analyze student's latest submitted exam")
@limiter.limit("10/minute")
async def analyze_student_last_exam(
    request: Request,
    current_user=Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await analyze_last_exam(current_user, db)
        return DoubtExamAnalysisResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze last exam: {exc}")


@router.get("/student-exams", response_model=StudentExamOptionListResponse, summary="List submitted exams for the current student")
async def list_student_exams(
    current_user=Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    try:
        exams = await list_student_submitted_exams(current_user, db)
        return StudentExamOptionListResponse(exams=exams)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load student exams: {exc}")


@router.get("/analyze-attempt/{attempt_id}", response_model=DoubtExamAnalysisResponse, summary="Analyze a specific exam attempt")
@limiter.limit("10/minute")
async def analyze_specific_attempt(
    request: Request,
    attempt_id: str,
    current_user=Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await analyze_exam_attempt(attempt_id, current_user, db)
        return DoubtExamAnalysisResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze exam attempt: {exc}")

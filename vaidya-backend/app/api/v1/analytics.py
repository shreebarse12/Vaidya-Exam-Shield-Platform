from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.dependencies import get_current_user, require_institute_admin
from app.services import analytics_service

router = APIRouter()


@router.get("/student/{student_id}", summary="Student performance report")
async def student_report(
    student_id: str,
    exam_id: Optional[str] = Query(None, description="Filter to a specific exam"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Full performance breakdown for a student.
    Students can view their own report. Faculty/admin can view any student in their institute.
    """
    # Students can only see their own report
    if current_user.role == "student" and str(current_user.id) != student_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="You can only view your own report.")

    return await analytics_service.get_student_report(student_id, exam_id, db)


@router.get("/student/{student_id}/weak-topics", summary="AI weak topic analysis")
async def weak_topics(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    AI-powered weak topic identification.
    Analyzes all past exam attempts and returns topics needing improvement.
    """
    return await analytics_service.identify_weak_topics(student_id, db)


@router.get("/ranking/{exam_id}", summary="All-India ranking for an exam")
async def exam_ranking(
    exam_id: str,
    student_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns ranking data from Redis.
    Includes the student's own rank if student_id is provided.
    """
    sid = student_id or str(current_user.id)
    return await analytics_service.get_ranking(exam_id, current_user, db, sid)


@router.get("/institute", summary="Institute-level analytics")
async def institute_analytics(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    return await analytics_service.get_institute_analytics(str(admin.tenant_id), db)

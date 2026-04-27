from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.dependencies import require_institute_admin
from app.schemas.institute import (
    AddStudentRequest, AddFacultyRequest, CreateBatchRequest,
    UserResponse, BatchResponse, BulkStudentImportResult,
)
from app.services import institute_service

router = APIRouter()


# ── Dashboard ──────────────────────────────────────────────────────────────────
@router.get("/dashboard", summary="Institute dashboard stats")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    return await institute_service.get_institute_dashboard(admin, db)


# ── Students ───────────────────────────────────────────────────────────────────
@router.post("/students", response_model=UserResponse, status_code=201)
async def add_student(
    data: AddStudentRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    student = await institute_service.add_student(data, admin, db)
    return UserResponse(
        id=str(student.id), email=student.email, first_name=student.first_name,
        last_name=student.last_name, phone=student.phone,
        role=student.role, is_active=student.is_active,
    )


@router.post("/students/bulk-import", response_model=BulkStudentImportResult)
async def bulk_import_students(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    return await institute_service.bulk_import_students(file, admin, db)


@router.get("/students", summary="List all students")
async def list_students(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    students = await institute_service.list_students(admin, db)
    return [UserResponse(
        id=str(s.id), email=s.email, first_name=s.first_name,
        last_name=s.last_name, phone=s.phone, role=s.role, is_active=s.is_active,
    ) for s in students]


@router.delete("/students/{student_id}", status_code=204)
async def deactivate_student(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    await institute_service.deactivate_student(student_id, admin, db)


# ── Faculty ────────────────────────────────────────────────────────────────────
@router.post("/faculty", response_model=UserResponse, status_code=201)
async def add_faculty(
    data: AddFacultyRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    faculty = await institute_service.add_faculty(data, admin, db)
    return UserResponse(
        id=str(faculty.id), email=faculty.email, first_name=faculty.first_name,
        last_name=faculty.last_name, phone=faculty.phone,
        role=faculty.role, is_active=faculty.is_active,
    )


@router.get("/faculty", summary="List all faculty")
async def list_faculty(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    faculty = await institute_service.list_faculty(admin, db)
    return [UserResponse(
        id=str(f.id), email=f.email, first_name=f.first_name,
        last_name=f.last_name, phone=f.phone, role=f.role, is_active=f.is_active,
    ) for f in faculty]


# ── Batches ────────────────────────────────────────────────────────────────────
@router.post("/batches", response_model=BatchResponse, status_code=201)
async def create_batch(
    data: CreateBatchRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    batch = await institute_service.create_batch(data, admin, db)
    return BatchResponse(
        id=str(batch.id), name=batch.name,
        description=batch.description,
        faculty_id=str(batch.faculty_id) if batch.faculty_id else None,
    )


@router.get("/batches", summary="List all batches")
async def list_batches(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    batches = await institute_service.list_batches(admin, db)
    return [BatchResponse(
        id=str(b.id), name=b.name, description=b.description,
        faculty_id=str(b.faculty_id) if b.faculty_id else None,
    ) for b in batches]


@router.get("/proctoring/flagged-attempts", summary="List flagged proctoring attempts")
async def list_flagged_proctoring_attempts(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_institute_admin),
):
    return await institute_service.list_flagged_attempts(admin, db)

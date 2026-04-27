"""
Institute Management — everything an Institute Admin does:
- Add/remove students and faculty
- Create/manage batches
- View institute dashboard stats
"""

import csv
import io
from typing import Optional, List

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.user import User
from app.models.batch import Batch, BatchStudent
from app.models.exam import ExamAttempt, Exam
from app.models.proctoring import ProctoringLog
from app.core.security import hash_password
from app.schemas.institute import (
    AddStudentRequest, AddFacultyRequest, CreateBatchRequest,
    BulkStudentImportResult,
)


# ── Students ───────────────────────────────────────────────────────────────────

async def add_student(
    data: "AddStudentRequest",
    admin: User,
    db: AsyncSession,
) -> User:
    """Add a single student to the institute."""
    # Check email not already in use
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Email {data.email} is already registered.")

    temp_password = hash_password("Welcome@123")  # Student must change on first login

    student = User(
        email=data.email,
        password_hash=temp_password,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role="student",
        tenant_id=admin.tenant_id,
        is_active=True,
        is_email_verified=True,  # Admin-created students skip email verification
    )
    db.add(student)
    await db.flush()

    # Auto-assign to batch if specified
    if data.batch_id:
        batch_student = BatchStudent(batch_id=data.batch_id, student_id=student.id)
        db.add(batch_student)

    return student


async def bulk_import_students(
    file: UploadFile,
    admin: User,
    db: AsyncSession,
) -> "BulkStudentImportResult":
    """
    CSV import for students.
    Required columns: first_name, last_name, email, phone (optional)
    """
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    successful, failed, errors = 0, 0, []

    for row_num, row in enumerate(reader, start=2):
        try:
            email = row.get("email", "").strip().lower()
            first_name = row.get("first_name", "").strip()
            last_name = row.get("last_name", "").strip()

            if not email or not first_name:
                raise ValueError("email and first_name are required")

            existing = await db.execute(select(User).where(User.email == email))
            if existing.scalar_one_or_none():
                raise ValueError(f"Email {email} already exists")

            student = User(
                email=email,
                password_hash=hash_password("Welcome@123"),
                first_name=first_name,
                last_name=last_name,
                phone=row.get("phone", "").strip() or None,
                role="student",
                tenant_id=admin.tenant_id,
                is_active=True,
                is_email_verified=True,
            )
            db.add(student)
            successful += 1

        except Exception as e:
            failed += 1
            errors.append({"row": row_num, "error": str(e)})

    if successful > 0:
        await db.flush()

    return BulkStudentImportResult(
        total_rows=successful + failed,
        successful=successful,
        failed=failed,
        errors=errors,
    )


async def list_students(admin: User, db: AsyncSession, batch_id: Optional[str] = None) -> list:
    """List all students in this institute, optionally filtered by batch."""
    query = select(User).where(
        User.tenant_id == admin.tenant_id,
        User.role == "student",
        User.is_active == True,
    )
    result = await db.execute(query)
    return result.scalars().all()


async def deactivate_student(student_id: str, admin: User, db: AsyncSession):
    """Deactivate a student (they can no longer log in)."""
    result = await db.execute(select(User).where(User.id == student_id))
    student = result.scalar_one_or_none()
    if not student or student.tenant_id != admin.tenant_id:
        raise HTTPException(status_code=404, detail="Student not found.")
    student.is_active = False


# ── Faculty ────────────────────────────────────────────────────────────────────

async def add_faculty(data: "AddFacultyRequest", admin: User, db: AsyncSession) -> User:
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered.")

    faculty = User(
        email=data.email,
        password_hash=hash_password("Welcome@123"),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role="faculty",
        tenant_id=admin.tenant_id,
        is_active=True,
        is_email_verified=True,
    )
    db.add(faculty)
    await db.flush()
    return faculty


async def list_faculty(admin: User, db: AsyncSession) -> list:
    result = await db.execute(
        select(User).where(
            User.tenant_id == admin.tenant_id,
            User.role == "faculty",
            User.is_active == True,
        )
    )
    return result.scalars().all()


# ── Batches ────────────────────────────────────────────────────────────────────

async def create_batch(data: "CreateBatchRequest", admin: User, db: AsyncSession) -> Batch:
    batch = Batch(
        tenant_id=admin.tenant_id,
        faculty_id=data.faculty_id,
        name=data.name,
        description=data.description,
    )
    db.add(batch)
    await db.flush()

    # Add students to batch
    for student_id in (data.student_ids or []):
        db.add(BatchStudent(batch_id=batch.id, student_id=student_id))

    return batch


async def list_batches(admin: User, db: AsyncSession) -> list:
    result = await db.execute(
        select(Batch).where(Batch.tenant_id == admin.tenant_id)
    )
    return result.scalars().all()


# ── Dashboard Stats ────────────────────────────────────────────────────────────

async def get_institute_dashboard(admin: User, db: AsyncSession) -> dict:
    """Aggregate stats for the Institute Admin home screen."""
    tenant_id = admin.tenant_id

    # Total students
    students_result = await db.execute(
        select(func.count(User.id)).where(
            User.tenant_id == tenant_id, User.role == "student", User.is_active == True
        )
    )
    total_students = students_result.scalar()

    # Total faculty
    faculty_result = await db.execute(
        select(func.count(User.id)).where(
            User.tenant_id == tenant_id, User.role == "faculty", User.is_active == True
        )
    )
    total_faculty = faculty_result.scalar()

    # Total batches
    batches_result = await db.execute(
        select(func.count(Batch.id)).where(Batch.tenant_id == tenant_id)
    )
    total_batches = batches_result.scalar()

    return {
        "total_students": total_students,
        "total_faculty": total_faculty,
        "total_batches": total_batches,
    }


async def list_flagged_attempts(admin: User, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(ExamAttempt, Exam, User, ProctoringLog)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .join(User, User.id == ExamAttempt.student_id)
        .join(ProctoringLog, ProctoringLog.exam_attempt_id == ExamAttempt.id)
        .where(
            User.tenant_id == admin.tenant_id,
            ProctoringLog.id.is_not(None),
        )
        .order_by(ExamAttempt.end_time.desc(), ProctoringLog.timestamp.desc())
    )

    grouped: dict[str, dict] = {}
    for attempt, exam, student, log in result.all():
        key = str(attempt.id)
        if key not in grouped:
            grouped[key] = {
                "attempt_id": key,
                "exam_id": str(exam.id),
                "exam_name": exam.name,
                "student_id": str(student.id),
                "student_name": student.full_name,
                "student_email": student.email,
                "status": attempt.status,
                "score": attempt.score,
                "percentage": attempt.percentage,
                "submitted_at": attempt.end_time.isoformat() if attempt.end_time else None,
                "warning_count": attempt.proctoring_flags_count or 0,
                "logs": [],
            }

        grouped[key]["logs"].append({
            "id": str(log.id),
            "event_type": log.event_type,
            "severity": log.severity,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "snapshot_url": log.snapshot_url,
            "audio_url": log.audio_url,
            "metadata": log.metadata_json or {},
            "is_valid": log.is_valid,
            "review_note": log.review_note,
        })

    return list(grouped.values())

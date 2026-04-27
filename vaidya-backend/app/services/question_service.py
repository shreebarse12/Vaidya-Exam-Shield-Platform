import csv
import io
import uuid
from typing import Optional, List
from math import ceil

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.dialects.postgresql import JSONB

from app.models.question import Question
from app.models.user import User
from app.schemas.question import (
    QuestionCreateRequest,
    QuestionUpdateRequest,
    QuestionFilters,
    BulkImportResult,
)


# ── Create ─────────────────────────────────────────────────────────────────────

async def create_question(
    data: QuestionCreateRequest,
    current_user: User,
    db: AsyncSession,
) -> Question:
    """
    Create a single question.

    Tenant isolation:
    - If faculty/institute_admin → question belongs to their institute
    - If super_admin → question goes to the global question bank (tenant_id = NULL)
    """

    # Validate: MCQ must have exactly 4 options
    if data.question_type == "mcq":
        if not data.options or len(data.options) != 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MCQ questions must have exactly 4 options (A, B, C, D).",
            )
        # Validate correct answer key is one of the options
        answer_key = data.correct_answer.get("answer")
        valid_keys = {opt.key for opt in data.options}
        if answer_key not in valid_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"correct_answer key '{answer_key}' is not one of the option keys: {valid_keys}",
            )

    # Super admin questions have no tenant → global bank
    # For all other roles, use their tenant_id
    # If tenant_id is somehow None for a non-super-admin, raise an error
    if current_user.role == "super_admin":
        tenant_id = None
    else:
        tenant_id = current_user.tenant_id
        if tenant_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your account is not linked to an institute. "
                       "Contact Super Admin to assign you to an institute."
            )

    question = Question(
        tenant_id=tenant_id,
        created_by=current_user.id,
        question_text=data.question_text,
        question_type=data.question_type,
        options=[opt.model_dump() for opt in data.options] if data.options else None,
        correct_answer=data.correct_answer,
        explanation=data.explanation,
        image_url=data.image_url,
        subject=data.subject,
        topic=data.topic,
        subtopic=data.subtopic,
        difficulty=data.difficulty,
        tags=data.tags,
        marks=data.marks,
        negative_marks=data.negative_marks,
        status=data.status,
        version=1,
    )
    db.add(question)
    await db.flush()
    return question


# ── Read (single) ──────────────────────────────────────────────────────────────

async def get_question_by_id(
    question_id: str,
    current_user: User,
    db: AsyncSession,
) -> Question:
    """
    Fetch a single question by ID.
    Enforces tenant isolation — faculty cannot access other institutes' questions.
    """
    result = await db.execute(
        select(Question).where(Question.id == question_id)
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Tenant isolation check
    # Super admin can see everything.
    # Others can see: their own tenant's questions + global questions (tenant_id=NULL)
    if current_user.role != "super_admin":
        if question.tenant_id and question.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this question.",
            )

    return question


# ── Read (list with filters) ───────────────────────────────────────────────────

async def list_questions(
    filters: QuestionFilters,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """
    List questions with filtering, searching, and pagination.

    What a faculty member sees:
    - Their institute's own questions
    - Global questions (tenant_id = NULL)

    What Super Admin sees:
    - All questions from all institutes
    """
    query = select(Question)

    # ── Tenant filter ──────────────────────────────────────────────────────
    if current_user.role != "super_admin":
        user_tenant = current_user.tenant_id
        if user_tenant is not None:
            # Normal: show this institute's questions + global questions
            query = query.where(
                or_(
                    Question.tenant_id == user_tenant,
                    Question.tenant_id.is_(None),
                )
            )
        else:
            # Faculty has no tenant assigned — show only global questions
            query = query.where(Question.tenant_id.is_(None))

    # ── Apply filters ──────────────────────────────────────────────────────
    if filters.subject:
        query = query.where(Question.subject == filters.subject)

    if filters.topic:
        query = query.where(Question.topic == filters.topic)

    if filters.difficulty:
        query = query.where(Question.difficulty == filters.difficulty)

    if filters.status:
        query = query.where(Question.status == filters.status)

    if filters.question_type:
        query = query.where(Question.question_type == filters.question_type)

    if filters.tags:
        # Find questions that have ALL the given tags
        # PostgreSQL: WHERE tags @> ARRAY['NEET', '2023']
        # The @> operator means "contains"
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
        from sqlalchemy import String as SA_String
        for tag in filters.tags:
            query = query.where(
                Question.tags.contains([tag])
            )

    if filters.search:
        # Case-insensitive full-text search on question text
        # ILIKE is PostgreSQL's case-insensitive LIKE
        query = query.where(
            Question.question_text.ilike(f"%{filters.search}%")
        )

    # ── Count total (for pagination) ───────────────────────────────────────
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # ── Pagination ─────────────────────────────────────────────────────────
    offset = (filters.page - 1) * filters.page_size
    query = (
        query
        .order_by(Question.created_at.desc())   # newest first
        .offset(offset)
        .limit(filters.page_size)
    )

    result = await db.execute(query)
    questions = result.scalars().all()

    return {
        "questions": questions,
        "total": total,
        "page": filters.page,
        "page_size": filters.page_size,
        "total_pages": ceil(total / filters.page_size) if total > 0 else 0,
    }


# ── Update ─────────────────────────────────────────────────────────────────────

async def update_question(
    question_id: str,
    data: QuestionUpdateRequest,
    current_user: User,
    db: AsyncSession,
) -> Question:
    """
    Update a question. Only the creator or an institute admin can update.
    Every successful update increments the version number.

    Why version?
    If an exam is created using question v1, and the question is later edited to v2,
    the exam still uses the snapshot taken at creation time (v1).
    This prevents edits from changing historical results.
    """
    question = await get_question_by_id(question_id, current_user, db)

    # Only creator or admin can edit
    if (
        current_user.role not in ("super_admin", "institute_admin")
        and question.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only edit questions you created.",
        )

    # Apply only the fields that were actually sent (partial update)
    update_data = data.model_dump(exclude_unset=True)

    # Convert options from Pydantic models to dicts if provided
    if "options" in update_data and update_data["options"]:
        update_data["options"] = [opt if isinstance(opt, dict) else opt.model_dump()
                                   for opt in update_data["options"]]

    for field, value in update_data.items():
        setattr(question, field, value)

    # Increment version on every edit
    question.version += 1

    return question


# ── Delete (soft) ──────────────────────────────────────────────────────────────

async def delete_question(
    question_id: str,
    current_user: User,
    db: AsyncSession,
) -> None:
    """
    Soft delete — sets status to "archived" instead of removing the row.

    Why not hard delete?
    A question might be used in past exams. Deleting it would break
    historical result records. Archiving hides it from normal views
    while keeping the data intact.
    """
    question = await get_question_by_id(question_id, current_user, db)

    if (
        current_user.role not in ("super_admin", "institute_admin")
        and question.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only delete questions you created.",
        )

    question.status = "archived"


# ── Bulk CSV Import ────────────────────────────────────────────────────────────

async def bulk_import_from_csv(
    file: UploadFile,
    current_user: User,
    db: AsyncSession,
) -> BulkImportResult:
    """
    Import multiple questions at once from a CSV file.

    Expected CSV columns (in order):
    question_text, option_a, option_b, option_c, option_d,
    correct_answer, explanation, subject, topic, difficulty,
    marks, negative_marks

    Example CSV row:
    "What is the SI unit of force?","Joule","Newton","Watt","Pascal","B",
    "Newton is the SI unit of force","Physics","Mechanics","easy","4","1"

    The function processes every row independently.
    If row 5 fails, rows 1-4 and 6+ still get imported.
    Errors are collected and returned in the response so faculty
    can fix only the broken rows.
    """

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted. Please download the template first.",
        )

    # Read file content
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        # Try latin-1 as fallback (Excel sometimes saves in this encoding)
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    # Validate the CSV has the required columns
    required_columns = {
        "question_text", "option_a", "option_b", "option_c", "option_d",
        "correct_answer", "subject", "topic", "difficulty", "marks", "negative_marks"
    }
    if not required_columns.issubset(set(reader.fieldnames or [])):
        missing = required_columns - set(reader.fieldnames or [])
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required columns: {missing}. "
                   f"Please download the template from /api/v1/questions/template",
        )

    # Process each row
    successful = 0
    failed = 0
    errors = []
    tenant_id = None if current_user.role == "super_admin" else current_user.tenant_id

    for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 = headers
        try:
            # ── Validate row ───────────────────────────────────────────────

            # question_text is mandatory
            question_text = row.get("question_text", "").strip()
            if not question_text:
                raise ValueError("question_text is empty")

            # correct_answer must be A, B, C, or D
            correct_answer_key = row.get("correct_answer", "").strip().upper()
            if correct_answer_key not in ("A", "B", "C", "D"):
                raise ValueError(f"correct_answer must be A, B, C or D. Got: '{correct_answer_key}'")

            # difficulty must be valid
            difficulty = row.get("difficulty", "medium").strip().lower()
            if difficulty not in ("easy", "medium", "hard"):
                raise ValueError(f"difficulty must be easy/medium/hard. Got: '{difficulty}'")

            # marks and negative_marks must be numbers
            try:
                marks = float(row.get("marks", 4))
                negative_marks = float(row.get("negative_marks", 1))
            except ValueError:
                raise ValueError("marks and negative_marks must be numbers")

            # ── Build options ──────────────────────────────────────────────
            options = [
                {"key": "A", "text": row.get("option_a", "").strip()},
                {"key": "B", "text": row.get("option_b", "").strip()},
                {"key": "C", "text": row.get("option_c", "").strip()},
                {"key": "D", "text": row.get("option_d", "").strip()},
            ]

            # Make sure none of the option texts are empty
            for opt in options:
                if not opt["text"]:
                    raise ValueError(f"Option {opt['key']} text is empty")

            # ── Create question ────────────────────────────────────────────
            question = Question(
                tenant_id=tenant_id,
                created_by=current_user.id,
                question_text=question_text,
                question_type="mcq",
                options=options,
                correct_answer={"answer": correct_answer_key},
                explanation=row.get("explanation", "").strip() or None,
                subject=row.get("subject", "").strip() or None,
                topic=row.get("topic", "").strip() or None,
                difficulty=difficulty,
                marks=marks,
                negative_marks=negative_marks,
                status="published",  # Bulk imports go straight to published
                version=1,
            )
            db.add(question)
            successful += 1

        except ValueError as e:
            # Record the error but continue processing remaining rows
            failed += 1
            errors.append({"row": row_num, "error": str(e)})

        except Exception as e:
            failed += 1
            errors.append({"row": row_num, "error": f"Unexpected error: {str(e)}"})

    # Flush all successfully created questions in one batch
    if successful > 0:
        await db.flush()

    return BulkImportResult(
        total_rows=successful + failed,
        successful=successful,
        failed=failed,
        errors=errors,
    )


# ── CSV Template ───────────────────────────────────────────────────────────────

def generate_csv_template() -> str:
    """
    Generate a sample CSV with headers + 2 example rows.
    Faculty downloads this, fills it in, and uploads it.
    """
    headers = [
        "question_text", "option_a", "option_b", "option_c", "option_d",
        "correct_answer", "explanation", "subject", "topic", "difficulty",
        "marks", "negative_marks"
    ]
    example_rows = [
        [
            "What is the SI unit of force?",
            "Joule", "Newton", "Watt", "Pascal",
            "B",
            "Newton (N) is the SI unit of force. F = ma",
            "Physics", "Mechanics", "easy", "4", "1"
        ],
        [
            "Which of the following is an alkali metal?",
            "Calcium", "Magnesium", "Sodium", "Aluminium",
            "C",
            "Sodium (Na) belongs to Group 1 - Alkali Metals",
            "Chemistry", "Periodic Table", "medium", "4", "1"
        ],
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(example_rows)
    return output.getvalue()
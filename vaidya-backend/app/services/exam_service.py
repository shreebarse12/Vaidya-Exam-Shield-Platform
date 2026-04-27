import hashlib
import random
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import uuid 
import redis.asyncio as aioredis
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.exam import Exam, ExamQuestion, ExamAttempt, ExamAssignment
from app.models.question import Question
from app.models.user import User
from app.schemas.exam import (
    ExamCreateRequest,
    ExamUpdateRequest,
    ExamStartResponse,
    ExamResultResponse,
    QuestionForStudent,
    QuestionResult,
    SubmitExamRequest,
)
from app.config import settings


# ── Redis client (shared across requests) ──────────────────────────────────────
# Redis stores timer state, saved answers, and ranking leaderboards.
# It is MUCH faster than PostgreSQL for frequently-updated small values.
redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = await aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
    return redis_client


# ── Question Shuffling ─────────────────────────────────────────────────────────

def _shuffle_questions(questions: list, student_id: str, exam_id: str) -> list:
    """
    Deterministic shuffle based on student_id + exam_id.

    Why deterministic?
    If a student refreshes mid-exam, they must see the same question order.
    Using their IDs as the random seed guarantees the same shuffle every time
    for that student+exam combination.

    Two different students will see different orders → prevents side-by-side copying.
    """
    seed_string = f"{student_id}{exam_id}"
    seed_int = int(hashlib.md5(seed_string.encode()).hexdigest(), 16)
    rng = random.Random(seed_int)
    shuffled = questions.copy()
    rng.shuffle(shuffled)
    return shuffled


def _shuffle_options(options: list, question_id: str, student_id: str) -> list:
    """Shuffle MCQ options with a per-question deterministic seed."""
    seed_string = f"{student_id}{question_id}"
    seed_int = int(hashlib.md5(seed_string.encode()).hexdigest(), 16)
    rng = random.Random(seed_int)
    shuffled = options.copy()
    rng.shuffle(shuffled)
    return shuffled


# ── Timer Helpers (Redis) ──────────────────────────────────────────────────────

async def initialize_timer(attempt_id: str, exam: Exam):
    """
    Store the timer state in Redis when an exam starts.
    Key: timer:{attempt_id}
    Value: JSON with section remaining times + overall start time
    """
    r = await get_redis()
    config = exam.config or {}
    sections = config.get("sections", [])

    timer_state = {
        "exam_id": str(exam.id),
        "attempt_id": attempt_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "total_seconds": exam.duration_seconds,
        "sections": {
            s["name"]: s.get("duration_seconds", exam.duration_seconds)
            for s in sections
        } if sections else {"default": exam.duration_seconds},
        "current_section": sections[0]["name"] if sections else "default",
    }

    # Store in Redis with TTL = exam duration + 10 minute buffer
    ttl = exam.duration_seconds + 600
    await r.setex(
        f"timer:{attempt_id}",
        ttl,
        json.dumps(timer_state)
    )


async def get_timer_state(attempt_id: str) -> Optional[dict]:
    """Get current timer state from Redis."""
    r = await get_redis()
    data = await r.get(f"timer:{attempt_id}")
    return json.loads(data) if data else None


async def save_answers_to_redis(attempt_id: str, answers: dict):
    """
    Save answers to Redis (fast, in-memory).
    Called every 5-30 seconds from frontend auto-save.
    These are synced to PostgreSQL on submission.
    Key: answers:{attempt_id}
    """
    r = await get_redis()
    await r.setex(
        f"answers:{attempt_id}",
        86400,  # 24 hour TTL
        json.dumps(answers)
    )


async def get_saved_answers(attempt_id: str) -> dict:
    """Get previously saved answers from Redis (for resume after crash)."""
    r = await get_redis()
    data = await r.get(f"answers:{attempt_id}")
    return json.loads(data) if data else {}


async def cleanup_redis_after_submission(attempt_id: str):
    """Remove Redis keys after exam is submitted (free up memory)."""
    r = await get_redis()
    await r.delete(f"timer:{attempt_id}", f"answers:{attempt_id}")


# ── Create Exam ────────────────────────────────────────────────────────────────

async def create_exam(
    data: ExamCreateRequest,
    current_user: User,
    db: AsyncSession,
) -> Exam:
    """
    Create an exam and snapshot all its questions.
    Snapshotting means if a question is edited later,
    the exam still shows the original version.
    """
    exam = Exam(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        name=data.name,
        description=data.description,
        config={**data.config.model_dump(), "rank_published": False},
        duration_seconds=data.duration_seconds,
        passing_percentage=data.passing_percentage,
        max_attempts=data.max_attempts,
        negative_marking=data.negative_marking,
        start_time=data.start_time,
        end_time=data.end_time,
        status="draft",
    )
    db.add(exam)
    await db.flush()  # get exam.id

    # Add questions as snapshots — fetch ALL in ONE query (not N queries)
    if data.question_ids:
        # Convert string IDs to UUID objects for the IN clause
        import uuid as _uuid
        uuid_ids = []
        invalid_ids = []
        for q_id in data.question_ids:
            try:
                uuid_ids.append(_uuid.UUID(str(q_id)))
            except (ValueError, AttributeError):
                invalid_ids.append(q_id)

        if invalid_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid question ID format: {invalid_ids[:3]}"
            )

        # Single query — fetch all questions at once
        from sqlalchemy import text
        questions_result = await db.execute(
            select(Question).where(Question.id.in_(uuid_ids))
        )
        questions_map = {
            str(q.id): q
            for q in questions_result.scalars().all()
        }

        # Report if any IDs were not found
        not_found = [q_id for q_id in data.question_ids if q_id not in questions_map]
        if not_found:
            raise HTTPException(
                status_code=404,
                detail=f"{len(not_found)} question(s) not found. "
                       f"They may have been deleted or belong to another institute. "
                       f"IDs: {not_found[:3]}"
            )

        # Create ExamQuestion snapshots preserving the original order
        for seq, q_id in enumerate(data.question_ids):
            question = questions_map.get(str(q_id))
            if not question:
                continue

            snapshot = {
                "id":            str(question.id),
                "question_text": question.question_text,
                "question_type": question.question_type,
                "options":       question.options,
                "correct_answer":question.correct_answer,
                "explanation":   question.explanation,
                "image_url":     question.image_url,
                "subject":       question.subject,
                "topic":         question.topic,
                "marks":         question.marks,
                "negative_marks":question.negative_marks,
                "version":       question.version,
            }
            exam_question = ExamQuestion(
                exam_id=exam.id,
                question_id=question.id,
                sequence=seq,
                section_name=None,
                question_snapshot=snapshot,
            )
            db.add(exam_question)

    await db.flush()
    return exam


async def publish_exam(exam_id: uuid.UUID, current_user: User, db: AsyncSession) -> Exam:
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if exam.tenant_id != current_user.tenant_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied.")

    exam.status = "published"
    return exam


async def publish_exam_ranks(exam_id: uuid.UUID, current_user: User, db: AsyncSession) -> Exam:
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if exam.tenant_id != current_user.tenant_id and current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied.")

    if exam.end_time and datetime.now(timezone.utc) < exam.end_time:
        raise HTTPException(status_code=400, detail="Ranks can only be published after the exam end time.")

    config = exam.config or {}
    config["rank_published"] = True
    exam.config = config
    return exam


# ── Start Exam (Student) ───────────────────────────────────────────────────────

async def start_exam(
    exam_id: str,
    student: User,
    db: AsyncSession,
) -> ExamStartResponse:
    """
    Called when a student clicks "Start Exam".

    Steps:
    1. Validate exam exists and is published
    2. Check student hasn't exceeded max_attempts
    3. Create an ExamAttempt record
    4. Load and shuffle questions
    5. Initialize Redis timer
    6. Return everything needed for the exam UI
    """

    # 1. Load exam
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if exam.status not in ("published", "ongoing"):
        raise HTTPException(
            status_code=400,
            detail=f"This exam is not available. Current status: {exam.status}. Contact your faculty."
        )

    # Check exam time window if set
    now = datetime.now(timezone.utc)
    if exam.start_time and now < exam.start_time:
        raise HTTPException(
            status_code=400,
            detail=f"This exam has not started yet. It opens at {exam.start_time.strftime('%d %b %Y, %H:%M UTC')}."
        )
    if exam.end_time and now > exam.end_time:
        raise HTTPException(
            status_code=400,
            detail=f"This exam window has closed. It ended at {exam.end_time.strftime('%d %b %Y, %H:%M UTC')}."
        )

    # 2. Check attempts
    attempts_result = await db.execute(
        select(func.count(ExamAttempt.id)).where(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.student_id == student.id,
            ExamAttempt.status != "abandoned",
        )
    )
    attempts_count = attempts_result.scalar()
    if attempts_count >= exam.max_attempts:
        raise HTTPException(
            status_code=400,
            detail=f"You have used all {exam.max_attempts} attempt(s) for this exam.",
        )

    # Check for an already in-progress attempt (resume scenario)
    in_progress_result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.student_id == student.id,
            ExamAttempt.status == "in_progress",
        )
    )
    existing_attempt = in_progress_result.scalar_one_or_none()

    if existing_attempt:
        # Resume the existing attempt
        attempt = existing_attempt
    else:
        # 3. Create new attempt
        attempt = ExamAttempt(
            exam_id=exam.id,
            student_id=student.id,
            start_time=datetime.now(timezone.utc),
            status="in_progress",
            answers={},
        )
        db.add(attempt)
        await db.flush()

        # 4. Initialize Redis timer for this new attempt
        await initialize_timer(str(attempt.id), exam)

    # 5. Load questions
    eq_result = await db.execute(
        select(ExamQuestion)
        .where(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.sequence)
    )
    exam_questions = eq_result.scalars().all()

    config = exam.config or {}
    shuffle_questions = config.get("shuffle_questions", True)
    shuffle_options = config.get("shuffle_options", True)

    if shuffle_questions:
        exam_questions = _shuffle_questions(
            list(exam_questions), str(student.id), str(exam.id)
        )

    # 6. Build question list for student (no correct answers!)
    questions_for_student = []
    for eq in exam_questions:
        snap = eq.question_snapshot
        options = snap.get("options") or []

        if shuffle_options and options:
            options = _shuffle_options(options, snap["id"], str(student.id))

        questions_for_student.append(QuestionForStudent(
            id=snap["id"],
            question_text=snap["question_text"],
            question_type=snap["question_type"],
            options=options,
            image_url=snap.get("image_url"),
            marks=snap["marks"],
            negative_marks=snap["negative_marks"],
            section_name=eq.section_name,
            sequence=eq.sequence,
        ))

    # Load saved answers for resume
    saved_answers = await get_saved_answers(str(attempt.id))
    if not saved_answers and attempt.answers:
        saved_answers = attempt.answers

    return ExamStartResponse(
        attempt_id=str(attempt.id),
        exam_id=str(exam.id),
        exam_name=exam.name,
        duration_seconds=exam.duration_seconds,
        sections=config.get("sections", []),
        questions=questions_for_student,
        config=config,
        started_at=attempt.start_time,
        saved_answers=saved_answers,
    )


# ── Auto-save Answers ──────────────────────────────────────────────────────────

async def save_answers(attempt_id: str, answers: dict, db: AsyncSession):
    """
    Save answers to both Redis (fast) and PostgreSQL (persistent).
    Frontend calls this every 30 seconds and on every answer change.
    """
    # Fast save to Redis
    await save_answers_to_redis(attempt_id, answers)

    # Persistent save to PostgreSQL (in case Redis restarts)
    result = await db.execute(
        select(ExamAttempt).where(ExamAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if attempt and attempt.status == "in_progress":
        attempt.answers = answers


# ── Submit Exam ────────────────────────────────────────────────────────────────

async def submit_exam(
    data: SubmitExamRequest,
    student: User,
    db: AsyncSession,
) -> ExamResultResponse:
    """
    Final submission. Steps:
    1. Validate attempt belongs to this student
    2. Prevent duplicate submission
    3. Calculate score using negative marking
    4. Compute section-wise scores
    5. Update rank in Redis sorted set (All-India ranking)
    6. Clean up Redis keys
    7. Return full result
    """

    # 1. Load attempt
    result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.id == data.attempt_id,
            ExamAttempt.student_id == student.id,
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found.")

    # 2. Prevent duplicate submission
    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail="This exam has already been submitted.",
        )

    # Load exam
    exam_result = await db.execute(select(Exam).where(Exam.id == attempt.exam_id))
    exam = exam_result.scalar_one_or_none()

    # Load exam questions (snapshots)
    eq_result = await db.execute(
        select(ExamQuestion).where(ExamQuestion.exam_id == attempt.exam_id)
    )
    exam_questions = eq_result.scalars().all()

    # Use submitted answers (merge with Redis saved answers for safety)
    redis_answers = await get_saved_answers(data.attempt_id)
    final_answers = {**redis_answers, **data.answers}  # submitted answers take priority

    # 3 & 4. Calculate score
    total_score = 0.0
    max_score = 0.0
    section_scores: Dict[str, dict] = {}
    question_results = []

    for eq in exam_questions:
        snap = eq.question_snapshot
        q_id = snap["id"]
        correct = snap["correct_answer"].get("answer")
        student_answer = final_answers.get(q_id)
        marks = snap["marks"]
        neg_marks = snap["negative_marks"]
        section = eq.section_name or "General"

        max_score += marks

        if section not in section_scores:
            section_scores[section] = {
                "score": 0.0, "correct": 0, "wrong": 0, "unattempted": 0,
                "max_score": 0.0
            }
        section_scores[section]["max_score"] += marks

        if student_answer is None:
            # Unattempted — no marks lost
            marks_awarded = 0.0
            is_correct = False
            section_scores[section]["unattempted"] += 1
        elif student_answer == correct:
            marks_awarded = marks
            is_correct = True
            total_score += marks
            section_scores[section]["score"] += marks
            section_scores[section]["correct"] += 1
        else:
            # Wrong answer — apply negative marking
            marks_awarded = -exam.negative_marking
            is_correct = False
            total_score -= exam.negative_marking
            section_scores[section]["score"] -= exam.negative_marking
            section_scores[section]["wrong"] += 1

        question_results.append(QuestionResult(
            question_id=q_id,
            question_text=snap["question_text"],
            options=snap.get("options"),
            student_answer=student_answer,
            correct_answer=correct,
            is_correct=is_correct,
            marks_awarded=marks_awarded,
            explanation=snap.get("explanation"),
            section_name=section,
        ))

    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    percentage = max(0, percentage)  # Cannot be negative

    # 5. Update All-India Ranking in Redis sorted set
    r = await get_redis()
    ranking_key = f"rank:exam:{attempt.exam_id}"
    await r.zadd(ranking_key, {str(student.id): percentage})
    await r.expire(ranking_key, 86400 * 30)  # keep 30 days

    # Compute rank: how many students scored HIGHER than this student
    rank_count = await r.zcount(ranking_key, f"({percentage}", "+inf")
    rank = int(rank_count) + 1

    # Total participants
    total_participants = await r.zcard(ranking_key)
    percentile = ((total_participants - rank) / total_participants * 100) if total_participants > 0 else 0

    # 6. Update attempt record
    now = datetime.now(timezone.utc)
    attempt.status = "submitted"
    attempt.end_time = now
    attempt.answers = final_answers
    attempt.score = total_score
    attempt.max_score = max_score
    attempt.percentage = percentage
    attempt.rank = rank
    attempt.percentile = percentile
    attempt.section_scores = section_scores

    # Clean up Redis
    await cleanup_redis_after_submission(data.attempt_id)

    # Check if results should be shown immediately
    config = exam.config or {}
    show_answers = config.get("show_answers_after", "submission")
    include_questions = show_answers in ("immediately", "submission")

    time_taken = int((now - attempt.start_time).total_seconds())
    passed = None
    if exam.passing_percentage:
        passed = percentage >= exam.passing_percentage

    return ExamResultResponse(
        attempt_id=str(attempt.id),
        exam_id=str(exam.id),
        exam_name=exam.name,
        score=total_score,
        max_score=max_score,
        percentage=round(percentage, 2),
        rank=rank,
        percentile=round(percentile, 2),
        total_participants=total_participants,
        section_scores=section_scores,
        passing_percentage=exam.passing_percentage,
        passed=passed,
        time_taken_seconds=time_taken,
        submitted_at=now,
        questions=question_results if include_questions else None,
    )


# ── List exams ─────────────────────────────────────────────────────────────────

async def list_exams(current_user: User, db: AsyncSession, status: Optional[str] = None) -> list:
    query = select(Exam)
    if current_user.role != "super_admin":
        query = query.where(Exam.tenant_id == current_user.tenant_id)
    if status:
        query = query.where(Exam.status == status)
    query = query.order_by(Exam.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def get_exam_by_id(exam_id: str, current_user: User, db: AsyncSession) -> Exam:
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if current_user.role != "super_admin" and exam.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return exam

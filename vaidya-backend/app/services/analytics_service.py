"""
Analytics service.

Includes:
1. Student performance reports
2. Weak topic identification
3. Exam rankings and leaderboard access control
4. Institute-level aggregate analytics
"""

from collections import defaultdict
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import ExamAttempt, Exam, ExamQuestion
from app.models.user import User


async def get_student_report(
    student_id: str,
    exam_id: Optional[str],
    db: AsyncSession,
) -> dict:
    """
    Full performance analysis for one student.
    If exam_id is provided, returns a single-exam report.
    Otherwise returns an aggregate report across attempts.
    """
    query = select(ExamAttempt).where(
        ExamAttempt.student_id == student_id,
        ExamAttempt.status == "submitted",
    )
    if exam_id:
        query = query.where(ExamAttempt.exam_id == exam_id)

    result = await db.execute(query.order_by(ExamAttempt.created_at.desc()))
    attempts = result.scalars().all()

    if not attempts:
        return {"message": "No completed exams found.", "attempts": []}

    attempt_summaries = []
    for attempt in attempts:
        attempt_summaries.append({
            "attempt_id": str(attempt.id),
            "exam_id": str(attempt.exam_id),
            "score": attempt.score,
            "max_score": attempt.max_score,
            "percentage": attempt.percentage,
            "rank": attempt.rank,
            "percentile": attempt.percentile,
            "section_scores": attempt.section_scores or {},
            "submitted_at": attempt.end_time,
        })

    score_trend = [
        {"date": str(attempt.end_time.date()), "percentage": attempt.percentage}
        for attempt in attempts[:10]
        if attempt.end_time
    ]

    return {
        "student_id": student_id,
        "total_attempts": len(attempts),
        "average_percentage": round(
            sum(attempt.percentage or 0 for attempt in attempts) / len(attempts),
            2,
        ),
        "best_percentage": round(max(attempt.percentage or 0 for attempt in attempts), 2),
        "score_trend": score_trend,
        "attempts": attempt_summaries,
    }


async def identify_weak_topics(student_id: str, db: AsyncSession) -> dict:
    """
    Identify topics where a student needs more practice.
    """
    result = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.student_id == student_id,
            ExamAttempt.status == "submitted",
        )
    )
    attempts = result.scalars().all()

    if not attempts:
        return {"weak_topics": [], "strong_topics": []}

    topic_performance: dict = defaultdict(list)

    for attempt in attempts:
        if not attempt.answers:
            continue

        eq_result = await db.execute(
            select(ExamQuestion).where(ExamQuestion.exam_id == attempt.exam_id)
        )
        exam_questions = eq_result.scalars().all()

        for exam_question in exam_questions:
            snapshot = exam_question.question_snapshot
            question_id = snapshot["id"]
            topic = snapshot.get("topic") or "General"
            subject = snapshot.get("subject") or "General"
            correct_answer = snapshot["correct_answer"].get("answer")
            student_answer = attempt.answers.get(question_id)
            marks = snapshot["marks"]

            if student_answer is None:
                continue

            is_correct = student_answer == correct_answer
            topic_performance[f"{subject}::{topic}"].append({
                "is_correct": is_correct,
                "marks": marks,
            })

    weak_topics = []
    strong_topics = []

    for topic_key, results in topic_performance.items():
        subject, topic = topic_key.split("::", 1)
        total = len(results)
        correct_count = sum(1 for result in results if result["is_correct"])
        accuracy = correct_count / total if total > 0 else 0

        entry = {
            "subject": subject,
            "topic": topic,
            "accuracy": round(accuracy * 100, 1),
            "total_questions_attempted": total,
            "correct": correct_count,
        }

        if accuracy < 0.60:
            entry["recommendation"] = (
                f"Practice more {topic} questions because accuracy is {entry['accuracy']}%."
            )
            weak_topics.append(entry)
        else:
            strong_topics.append(entry)

    weak_topics.sort(key=lambda item: item["accuracy"])
    strong_topics.sort(key=lambda item: item["accuracy"], reverse=True)

    return {
        "weak_topics": weak_topics[:10],
        "strong_topics": strong_topics[:5],
        "total_topics_analyzed": len(topic_performance),
    }


async def get_ranking(
    exam_id: str,
    current_user: User,
    db: AsyncSession,
    student_id: Optional[str] = None,
) -> dict:
    """
    Return an exam leaderboard with publish gating for students.
    Faculty, institute admins, and super admins can review rankings internally
    before publication. Students can only access them after publication.
    """
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if current_user.role != "super_admin" and exam.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    rank_published = bool((exam.config or {}).get("rank_published", False))
    if current_user.role == "student" and not rank_published:
        raise HTTPException(
            status_code=403,
            detail="Ranking has not been published for this exam yet.",
        )

    attempts_result = await db.execute(
        select(ExamAttempt, User)
        .join(User, User.id == ExamAttempt.student_id)
        .where(
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.status == "submitted",
        )
        .order_by(
            ExamAttempt.rank.asc().nullslast(),
            ExamAttempt.percentage.desc(),
            ExamAttempt.end_time.asc().nullslast(),
        )
    )
    rows = attempts_result.all()

    leaderboard = []
    for attempt, student in rows:
        leaderboard.append({
            "attempt_id": str(attempt.id),
            "student_id": str(student.id),
            "student_name": student.full_name,
            "student_email": student.email,
            "score": attempt.score or 0,
            "max_score": attempt.max_score or 0,
            "score_percentage": round(attempt.percentage or 0, 2),
            "rank": attempt.rank,
            "percentile": round(attempt.percentile or 0, 2),
            "submitted_at": attempt.end_time,
        })

    result = {
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "rank_published": rank_published,
        "total_participants": len(leaderboard),
        "leaderboard": leaderboard,
        "top_10": leaderboard[:10],
    }

    target_student_id = student_id or str(current_user.id)
    own_entry = next(
        (entry for entry in leaderboard if entry["student_id"] == str(target_student_id)),
        None,
    )
    if own_entry:
        result.update({
            "student_id": own_entry["student_id"],
            "rank": own_entry["rank"],
            "percentile": own_entry["percentile"],
            "score_percentage": own_entry["score_percentage"],
        })

    if not leaderboard:
        result["message"] = "No ranking data yet."

    return result


async def get_institute_analytics(tenant_id: str, db: AsyncSession) -> dict:
    """Aggregate performance data across all exams for an institute."""
    avg_result = await db.execute(
        select(func.avg(ExamAttempt.percentage)).where(ExamAttempt.status == "submitted")
    )
    avg_percentage = avg_result.scalar()

    total_attempts_result = await db.execute(
        select(func.count(ExamAttempt.id)).where(ExamAttempt.status == "submitted")
    )
    total_attempts = total_attempts_result.scalar()

    return {
        "tenant_id": tenant_id,
        "total_exam_attempts": total_attempts,
        "average_score_percentage": round(avg_percentage or 0, 2),
    }

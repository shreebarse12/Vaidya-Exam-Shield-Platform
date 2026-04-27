import json

from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.exam import Exam, ExamAttempt, ExamQuestion

SYSTEM_PROMPT = """
You are a helpful exam tutor for Indian competitive exam students.
Explain clearly and step by step.
If the answer is uncertain, say so.
Keep answers educational and concise.
"""

EXAM_ANALYSIS_SYSTEM_PROMPT = """
You are an expert exam review tutor for Indian competitive exam students.

You are given a student's past exam mistakes. Your job is to:
1. Identify the strongest mistake patterns.
2. Explain why each wrong answer was wrong.
3. Give the correct reasoning in simple language.
4. Suggest how to avoid the same mistakes next time.

Rules:
- Focus only on the provided exam data.
- Do not ask the student to paste the questions again.
- Be specific and practical, not generic.
- Group insights by topic or pattern when possible.
- If there are very few wrong answers, explain each one directly.
- End with a short action plan for the student's next revision session.
"""


def _get_llm():
    return ChatGroq(
        model=settings.GROQ_MODEL,
        temperature=0.2,
        groq_api_key=settings.GROQ_API_KEY,
    )


def _to_langchain_messages(history):
    messages = []
    for msg in history:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))
    return messages


def _normalize_option_text(options, option_key):
    if option_key is None:
        return "Not answered"

    for option in options or []:
        if option.get("key") == option_key:
            text = option.get("text") or option_key
            return f"{option_key}: {text}"

    return str(option_key)


def _build_wrong_questions(exam_questions, answers, exam_negative_marking):
    wrong_questions = []

    for eq in exam_questions:
        snap = eq.question_snapshot or {}
        q_id = snap.get("id")
        correct_answer = (snap.get("correct_answer") or {}).get("answer")
        student_answer = (answers or {}).get(q_id)

        if student_answer is None or student_answer == correct_answer:
            continue

        options = snap.get("options") or []
        wrong_questions.append({
            "question_id": q_id,
            "section_name": eq.section_name or "General",
            "subject": snap.get("subject"),
            "topic": snap.get("topic"),
            "question_text": snap.get("question_text") or "",
            "student_answer": student_answer,
            "student_answer_text": _normalize_option_text(options, student_answer),
            "correct_answer": correct_answer,
            "correct_answer_text": _normalize_option_text(options, correct_answer),
            "explanation": snap.get("explanation") or "No explanation was stored for this question.",
            "marks": snap.get("marks"),
            "negative_marking": exam_negative_marking,
            "options": [
                {
                    "key": option.get("key"),
                    "text": option.get("text"),
                }
                for option in options
            ],
        })

    return wrong_questions


async def answer_doubt(question: str, history: list):
    llm = _get_llm()

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{question}"),
    ])

    chain = prompt | llm

    response = await chain.ainvoke({
        "history": _to_langchain_messages(history[-6:]),
        "question": question,
    })

    return response.content


async def analyze_exam_attempt(attempt_id: str, student, db: AsyncSession):
    result = await db.execute(
        select(ExamAttempt, Exam)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .where(
            ExamAttempt.id == attempt_id,
            ExamAttempt.student_id == student.id,
            ExamAttempt.status.in_(("submitted", "auto_submitted")),
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Submitted exam attempt not found.")

    attempt, exam = row

    eq_result = await db.execute(
        select(ExamQuestion)
        .where(ExamQuestion.exam_id == attempt.exam_id)
        .order_by(ExamQuestion.sequence)
    )
    exam_questions = eq_result.scalars().all()
    wrong_questions = _build_wrong_questions(exam_questions, attempt.answers or {}, exam.negative_marking)

    if not wrong_questions:
        return {
            "attempt_id": str(attempt.id),
            "exam_id": str(exam.id),
            "exam_name": exam.name,
            "wrong_count": 0,
            "answer": (
                f"You did not have any wrong answers in {exam.name}. "
                "Great job. Focus on revising the few unattempted or slower topics and keep practicing at the same level."
            ),
        }

    llm = _get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", EXAM_ANALYSIS_SYSTEM_PROMPT),
        ("human", "Exam name: {exam_name}\nWrong question count: {wrong_count}\n\nWrong questions data:\n{wrong_questions_json}"),
    ])
    chain = prompt | llm

    response = await chain.ainvoke({
        "exam_name": exam.name,
        "wrong_count": len(wrong_questions),
        "wrong_questions_json": json.dumps(wrong_questions, ensure_ascii=True),
    })

    return {
        "attempt_id": str(attempt.id),
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "wrong_count": len(wrong_questions),
        "answer": response.content,
    }


async def analyze_last_exam(student, db: AsyncSession):
    result = await db.execute(
        select(ExamAttempt.id)
        .where(
            ExamAttempt.student_id == student.id,
            ExamAttempt.status.in_(("submitted", "auto_submitted")),
        )
        .order_by(desc(ExamAttempt.end_time), desc(ExamAttempt.created_at))
        .limit(1)
    )
    attempt_id = result.scalar_one_or_none()

    if not attempt_id:
        raise HTTPException(status_code=404, detail="No submitted exams found for this student.")

    return await analyze_exam_attempt(str(attempt_id), student, db)


async def list_student_submitted_exams(student, db: AsyncSession):
    result = await db.execute(
        select(ExamAttempt, Exam)
        .join(Exam, Exam.id == ExamAttempt.exam_id)
        .where(
            ExamAttempt.student_id == student.id,
            ExamAttempt.status.in_(("submitted", "auto_submitted")),
        )
        .order_by(desc(ExamAttempt.end_time), desc(ExamAttempt.created_at))
    )

    rows = result.all()
    exams = []
    for attempt, exam in rows:
        exams.append({
            "attempt_id": str(attempt.id),
            "exam_id": str(exam.id),
            "exam_name": exam.name,
            "submitted_at": attempt.end_time.isoformat() if attempt.end_time else None,
            "score": attempt.score,
            "percentage": attempt.percentage,
        })

    return exams

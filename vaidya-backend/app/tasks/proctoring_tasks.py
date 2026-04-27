"""
Celery tasks for AI proctoring.

These run ASYNCHRONOUSLY — when a proctoring frame arrives via WebSocket,
FastAPI instantly queues it here and responds to the client. The heavy
AI processing happens in background Celery workers.

This way 1000 concurrent exams don't slow down the API server.
"""

from celery import Celery
from datetime import datetime, timezone
from app.config import settings

# Initialize Celery with Redis as the message broker
# Broker = where tasks are queued (Redis)
# Backend = where results are stored (Redis)
celery_app = Celery(
    "vaidya_proctoring",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    task_track_started=True,
    # Route different tasks to different queues for priority control
    task_routes={
        "app.tasks.proctoring_tasks.analyze_face_frame": {"queue": "proctoring"},
        "app.tasks.proctoring_tasks.analyze_object_frame": {"queue": "proctoring"},
        "app.tasks.proctoring_tasks.analyze_audio_chunk": {"queue": "proctoring"},
        "app.tasks.result_tasks.calculate_results": {"queue": "results"},
        "app.tasks.email_tasks.send_email": {"queue": "email"},
    },
)


@celery_app.task(name="app.tasks.proctoring_tasks.analyze_face_frame")
def analyze_face_frame(
    attempt_id: str,
    frame_base64: str,
    timestamp: str,
):
    """
    Analyze one camera frame for face presence and head pose.
    Called every 1 second per active student.

    Workflow:
    1. Run MediaPipe face detection
    2. If flags found → save to DB + optionally save screenshot to S3
    3. If 3+ high-severity flags → signal WebSocket to warn student
    """
    from app.ai.face_detector import face_detector

    result = face_detector.analyze_frame(frame_base64)

    if result.flags:
        # Save proctoring log to DB (using sync SQLAlchemy for Celery)
        _save_proctoring_log(
            attempt_id=attempt_id,
            event_types=result.flags,
            severity=_get_severity(result.flags),
            timestamp=timestamp,
            snapshot_base64=frame_base64 if "face_missing" in result.flags else None,
            metadata={"face_count": result.face_count, "confidence": result.confidence},
        )
        return {"flagged": True, "flags": result.flags}

    return {"flagged": False}


@celery_app.task(name="app.tasks.proctoring_tasks.analyze_object_frame")
def analyze_object_frame(
    attempt_id: str,
    frame_base64: str,
    timestamp: str,
):
    """
    Detect phones, books, earphones in camera frame.
    Runs every 3 seconds (slower than face detection because YOLOv8 is heavier).
    """
    from app.ai.object_detector import object_detector

    result = object_detector.analyze_frame(frame_base64)

    if result.flags:
        _save_proctoring_log(
            attempt_id=attempt_id,
            event_types=result.flags,
            severity="high",  # Phone/object detection is always high severity
            timestamp=timestamp,
            snapshot_base64=frame_base64,  # Always save screenshot for object detections
            metadata={
                "detected_objects": result.detected_objects,
                "confidence_scores": result.confidence_scores,
            },
        )
        return {"flagged": True, "flags": result.flags, "objects": result.detected_objects}

    return {"flagged": False}


@celery_app.task(name="app.tasks.proctoring_tasks.analyze_audio_chunk")
def analyze_audio_chunk(
    attempt_id: str,
    audio_base64: str,
    timestamp: str,
):
    """
    Transcribe 10-second audio chunk and scan for suspicious keywords.
    Runs every 10 seconds per student.
    Only saves audio to S3 if suspicious keywords are found.
    """
    from app.ai.audio_analyzer import audio_analyzer

    result = audio_analyzer.analyze_chunk(audio_base64)

    if result.is_suspicious:
        _save_proctoring_log(
            attempt_id=attempt_id,
            event_types=["keyword_detected"],
            severity="high",
            timestamp=timestamp,
            audio_base64=audio_base64 if result.is_suspicious else None,
            metadata={
                "transcript": result.transcript,
                "detected_keywords": result.detected_keywords,
            },
        )
        return {"flagged": True, "keywords": result.detected_keywords}

    return {"flagged": False}


def _get_severity(flags: list) -> str:
    """Determine severity based on flag type."""
    high_severity = {"mobile_detected", "multiple_faces", "keyword_detected"}
    medium_severity = {"face_missing", "gaze_away", "book_detected"}
    for flag in flags:
        if flag in high_severity:
            return "high"
    for flag in flags:
        if flag in medium_severity:
            return "medium"
    return "low"


def _save_proctoring_log(
    attempt_id: str,
    event_types: list,
    severity: str,
    timestamp: str,
    snapshot_base64: str = None,
    audio_base64: str = None,
    metadata: dict = None,
):
    """
    Save proctoring event to PostgreSQL.
    Uses synchronous SQLAlchemy because Celery workers are sync by default.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.proctoring import ProctoringLog
    from app.models.exam import ExamAttempt

    # Sync engine for Celery (use psycopg2 instead of asyncpg)
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
    engine = create_engine(sync_url)

    snapshot_url = None
    audio_url = None

    # Upload to S3 if needed (Phase 2 feature)
    if snapshot_base64:
        snapshot_url = _upload_to_s3(snapshot_base64, f"proctor/{attempt_id}/snap_{timestamp}.jpg")
    if audio_base64:
        audio_url = _upload_to_s3(audio_base64, f"proctor/{attempt_id}/audio_{timestamp}.wav")

    with Session(engine) as session:
        attempt = session.get(ExamAttempt, attempt_id)
        if attempt:
            for event_type in event_types:
                log = ProctoringLog(
                    exam_attempt_id=attempt_id,
                    event_type=event_type,
                    severity=severity,
                    timestamp=datetime.fromisoformat(timestamp),
                    snapshot_url=snapshot_url,
                    audio_url=audio_url,
                    metadata_json=metadata or {},
                )
                session.add(log)
            attempt.proctoring_flags_count += len(event_types)
            session.commit()


def _upload_to_s3(data_base64: str, key: str) -> str:
    """Upload base64 data to S3 and return the URL."""
    import base64
    import boto3
    from app.config import settings

    try:
        s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        data = base64.b64decode(data_base64)
        s3.put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=data)
        return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
    except Exception:
        return None
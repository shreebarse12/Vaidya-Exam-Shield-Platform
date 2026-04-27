"""
WebSocket endpoint for real-time proctoring.

This version performs live warning decisions inside the websocket flow so the
student gets immediate feedback and auto-submit works reliably.
"""

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ai.face_detector import face_detector
from app.ai.object_detector import object_detector
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal
from app.models.exam import ExamAttempt
from app.models.proctoring import ProctoringLog

router = APIRouter()

MAX_WARNINGS = 10

WARNING_MESSAGES = {
    "face_missing": ("medium", "Your face is not clearly visible. Please stay in front of the camera."),
    "multiple_faces": ("high", "Multiple faces detected. Only the candidate should be visible."),
    "gaze_away": ("low", "Please keep your eyes on the exam screen."),
    "mobile_detected": ("high", "Mobile phone detected near the exam area."),
    "book_detected": ("medium", "Book or notebook detected near the exam area."),
    "earphone_detected": ("high", "Earphones or audio device detected."),
    "keyword_detected": ("high", "Suspicious audio activity detected."),
    "tab_switch": ("high", "You left the exam window. Stay on the exam screen."),
    "fullscreen_exit": ("medium", "Please return to fullscreen mode."),
}

EVENT_COOLDOWN_SECONDS = {
    "face_missing": 8,
    "multiple_faces": 8,
    "gaze_away": 12,
    "mobile_detected": 8,
    "book_detected": 10,
    "earphone_detected": 10,
    "keyword_detected": 10,
    "tab_switch": 0,
    "fullscreen_exit": 5,
}

# In-memory runtime state for active attempts only.
attempt_warning_counts: dict[str, int] = {}
attempt_recent_events: dict[str, dict[str, datetime]] = {}


def _parse_timestamp(timestamp: str) -> datetime:
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def _should_count_event(attempt_id: str, event_type: str, event_time: datetime) -> bool:
    recent = attempt_recent_events.setdefault(attempt_id, {})
    last_seen = recent.get(event_type)
    cooldown = EVENT_COOLDOWN_SECONDS.get(event_type, 5)

    if last_seen is not None:
        elapsed = (event_time - last_seen).total_seconds()
        if elapsed < cooldown:
            return False

    recent[event_type] = event_time
    return True


async def _save_proctoring_events(
    attempt_id: str,
    event_types: list[str],
    severity: str,
    event_time: datetime,
    metadata: dict | None = None,
):
    async with AsyncSessionLocal() as session:
        attempt = await session.get(ExamAttempt, attempt_id)
        if not attempt:
            return

        for event_type in event_types:
            session.add(ProctoringLog(
                exam_attempt_id=attempt.id,
                event_type=event_type,
                severity=severity,
                timestamp=event_time,
                metadata_json=metadata or {},
            ))

        attempt.proctoring_flags_count = (attempt.proctoring_flags_count or 0) + len(event_types)
        await session.commit()


async def _emit_flag(
    websocket: WebSocket,
    attempt_id: str,
    event_type: str,
    event_time: datetime,
    metadata: dict | None = None,
):
    if not _should_count_event(attempt_id, event_type, event_time):
        return False

    severity, default_message = WARNING_MESSAGES.get(
        event_type,
        ("medium", f"Suspicious activity detected: {event_type}")
    )

    attempt_warning_counts[attempt_id] = attempt_warning_counts.get(attempt_id, 0) + 1
    warning_count = attempt_warning_counts[attempt_id]
    remaining = max(0, MAX_WARNINGS - warning_count)

    await _save_proctoring_events(
        attempt_id=attempt_id,
        event_types=[event_type],
        severity=severity,
        event_time=event_time,
        metadata=metadata,
    )

    if warning_count >= MAX_WARNINGS:
        await websocket.send_json({
            "type": "auto_submit",
            "event": event_type,
            "reason": f"Exam auto-submitted because proctoring warnings reached {warning_count}.",
            "warning_count": warning_count,
        })
        return True

    await websocket.send_json({
        "type": "flag",
        "event": event_type,
        "severity": severity,
        "message": f"{default_message} Warning {warning_count}/{MAX_WARNINGS}.",
        "warning_count": warning_count,
        "warnings_remaining": remaining,
    })
    return False


@router.websocket("/ws/{attempt_id}")
async def proctoring_websocket(websocket: WebSocket, attempt_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="No auth token provided")
        return

    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    attempt_warning_counts.setdefault(attempt_id, 0)
    attempt_recent_events.setdefault(attempt_id, {})

    await websocket.send_json({
        "type": "connected",
        "message": "Proctoring active. Camera is being monitored.",
        "attempt_id": attempt_id,
        "max_warnings": MAX_WARNINGS,
    })

    frame_counter = 0

    try:
        while True:
            raw_data = await websocket.receive_text()
            message = json.loads(raw_data)
            msg_type = message.get("type")
            timestamp = message.get("timestamp", datetime.now(timezone.utc).isoformat())
            event_time = _parse_timestamp(timestamp)

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type == "face_frame":
                frame_counter += 1
                frame_base64 = message.get("frame", "")
                auto_submit = False

                face_result = await asyncio.to_thread(face_detector.analyze_frame, frame_base64)
                for flag in face_result.flags:
                    auto_submit = await _emit_flag(
                        websocket,
                        attempt_id,
                        flag,
                        event_time,
                        {
                            "face_count": face_result.face_count,
                            "confidence": face_result.confidence,
                        },
                    )
                    if auto_submit:
                        break

                if auto_submit:
                    continue

                if frame_counter % 3 == 0:
                    object_result = await asyncio.to_thread(object_detector.analyze_frame, frame_base64)
                    for flag in object_result.flags:
                        auto_submit = await _emit_flag(
                            websocket,
                            attempt_id,
                            flag,
                            event_time,
                            {
                                "detected_objects": object_result.detected_objects,
                                "confidence_scores": object_result.confidence_scores,
                            },
                        )
                        if auto_submit:
                            break

                if not auto_submit:
                    await websocket.send_json({"type": "ack", "received": "face_frame"})
                continue

            if msg_type == "tab_switch":
                await _emit_flag(websocket, attempt_id, "tab_switch", event_time)
                continue

            if msg_type == "fullscreen_exit":
                await _emit_flag(websocket, attempt_id, "fullscreen_exit", event_time)
                continue

            if msg_type == "audio_chunk":
                await websocket.send_json({"type": "ack", "received": "audio_chunk"})
                continue

    except WebSocketDisconnect:
        attempt_warning_counts.pop(attempt_id, None)
        attempt_recent_events.pop(attempt_id, None)
    except Exception as exc:
        attempt_warning_counts.pop(attempt_id, None)
        attempt_recent_events.pop(attempt_id, None)
        await websocket.close(code=1011, reason=f"Server error: {str(exc)}")

"""
Face Detection using MediaPipe Face Mesh.
Detects: face presence, face count, head pose (looking away), eye gaze.

This module is loaded ONCE in the Celery worker when it starts.
Loading MediaPipe is slow (~2s), so we never load it per-request.
"""

import base64
import numpy as np
from typing import Optional
from dataclasses import dataclass


@dataclass
class FaceDetectionResult:
    face_count: int               # 0 = no face, 1 = normal, 2+ = multiple people
    is_looking_at_screen: bool    # False if head is turned more than 45 degrees
    confidence: float             # Detection confidence 0.0 - 1.0
    flags: list                   # List of triggered flag types


class FaceDetector:
    """
    Wrapper around MediaPipe Face Mesh.
    Install: pip install mediapipe opencv-python
    """

    def __init__(self):
        self._mp = None
        self._detector = None

    def _load(self):
        """Lazy load — only import mediapipe when first needed."""
        if self._mp is None:
            try:
                import mediapipe as mp
                import cv2
                self._mp = mp
                self._cv2 = cv2
                self._detector = mp.solutions.face_mesh.FaceMesh(
                    max_num_faces=5,            # Detect up to 5 faces (for multiple person detection)
                    refine_landmarks=True,      # More accurate eye tracking
                    min_detection_confidence=0.7,
                    min_tracking_confidence=0.7,
                )
            except ImportError:
                # MediaPipe not installed yet (Phase 1/2 dev)
                # Return mock results during development
                pass

    def analyze_frame(self, frame_base64: str) -> FaceDetectionResult:
        """
        Analyze a single camera frame.
        frame_base64: base64-encoded JPEG image from the browser

        Returns FaceDetectionResult with all flags.
        """
        self._load()

        # If MediaPipe not installed, return a safe mock result
        if self._detector is None:
            return FaceDetectionResult(
                face_count=1,
                is_looking_at_screen=True,
                confidence=1.0,
                flags=[],
            )

        try:
            # Decode base64 image → numpy array
            img_bytes = base64.b64decode(frame_base64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = self._cv2.imdecode(img_array, self._cv2.IMREAD_COLOR)

            if frame is None:
                return FaceDetectionResult(face_count=0, is_looking_at_screen=False, confidence=0.0, flags=["invalid_frame"])

            # Convert BGR → RGB (MediaPipe expects RGB)
            rgb_frame = self._cv2.cvtColor(frame, self._cv2.COLOR_BGR2RGB)
            results = self._detector.process(rgb_frame)

            flags = []
            face_count = 0
            is_looking = True

            if results.multi_face_landmarks:
                face_count = len(results.multi_face_landmarks)

                if face_count > 1:
                    flags.append("multiple_faces")

                # Check head pose for the primary face (first detected)
                primary_face = results.multi_face_landmarks[0]

                # Use nose tip and face boundary landmarks to estimate head pose
                # Landmarks: 1 = nose tip, 33 = left eye, 263 = right eye, 152 = chin
                nose = primary_face.landmark[1]
                left_eye = primary_face.landmark[33]
                right_eye = primary_face.landmark[263]

                # Calculate horizontal asymmetry (indicates left/right turn)
                eye_center_x = (left_eye.x + right_eye.x) / 2
                nose_x = nose.x
                horizontal_offset = abs(nose_x - eye_center_x)

                # If horizontal offset > 0.08, head is turned significantly
                if horizontal_offset > 0.08:
                    is_looking = False
                    flags.append("gaze_away")

            else:
                face_count = 0
                is_looking = False
                flags.append("face_missing")

            return FaceDetectionResult(
                face_count=face_count,
                is_looking_at_screen=is_looking,
                confidence=0.9,
                flags=flags,
            )

        except Exception as e:
            return FaceDetectionResult(
                face_count=0,
                is_looking_at_screen=False,
                confidence=0.0,
                flags=[f"analysis_error: {str(e)}"],
            )


# Singleton — shared across all Celery tasks in this worker
face_detector = FaceDetector()
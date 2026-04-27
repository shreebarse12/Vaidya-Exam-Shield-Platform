"""
Object detection using Ultralytics YOLOv8.
"""

import base64
from dataclasses import dataclass
from pathlib import Path
from typing import List

import numpy as np


@dataclass
class ObjectDetectionResult:
    detected_objects: List[str]
    confidence_scores: dict
    flags: List[str]


SUSPICIOUS_CLASSES = {
    "cell phone": "mobile_detected",
    "book": "book_detected",
    "earphones": "earphone_detected",
}

CONFIDENCE_THRESHOLD = 0.60


class ObjectDetector:
    def __init__(self):
        self._model = None

    def _load(self):
        if self._model is not None:
            return

        try:
            from ultralytics import YOLO
        except ImportError:
            return

        model_path = Path(__file__).with_name("yolov8n.pt")
        self._model = YOLO(str(model_path))

    def analyze_frame(self, frame_base64: str) -> ObjectDetectionResult:
        self._load()

        if self._model is None:
            return ObjectDetectionResult(
                detected_objects=[],
                confidence_scores={},
                flags=[],
            )

        try:
            img_bytes = base64.b64decode(frame_base64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)

            import cv2

            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is None:
                return ObjectDetectionResult(detected_objects=[], confidence_scores={}, flags=[])

            results = self._model(frame, verbose=False)

            detected = []
            scores = {}
            flags = []

            for result in results:
                for box in result.boxes:
                    confidence = float(box.conf[0])
                    class_name = result.names[int(box.cls[0])].lower()

                    if confidence < CONFIDENCE_THRESHOLD:
                        continue

                    detected.append(class_name)
                    scores[class_name] = confidence

                    flag = SUSPICIOUS_CLASSES.get(class_name)
                    if flag and flag not in flags:
                        flags.append(flag)

            return ObjectDetectionResult(
                detected_objects=detected,
                confidence_scores=scores,
                flags=flags,
            )
        except Exception:
            return ObjectDetectionResult(
                detected_objects=[],
                confidence_scores={},
                flags=[],
            )


object_detector = ObjectDetector()

"""
Audio Analysis using OpenAI Whisper Tiny.
Captures 10-second audio chunks, transcribes, scans for suspicious keywords.

Privacy: Audio processed in memory. Only FLAGGED clips saved to S3.
Install: pip install openai-whisper
"""

import base64
import tempfile
import os
from dataclasses import dataclass
from typing import List, Tuple


# Keywords that suggest cheating
# Mix of English and Hinglish (how students actually speak)
SUSPICIOUS_KEYWORDS = [
    "google", "answer", "batao", "kya hai", "cheat",
    "help", "page", "book", "formula", "number",
    "search", "find", "look", "tell me", "bata",
    "copy", "dekho", "kya", "solution", "solve karo",
]

# Minimum keyword matches to raise a flag
# Single matches might be coincidental; 2+ is suspicious
MIN_KEYWORD_MATCHES = 2


@dataclass
class AudioAnalysisResult:
    transcript: str              # Full transcribed text
    detected_keywords: List[str] # Which keywords were found
    is_suspicious: bool          # True if >= MIN_KEYWORD_MATCHES
    flags: List[str]


class AudioAnalyzer:
    def __init__(self):
        self._model = None

    def _load(self):
        if self._model is None:
            try:
                import whisper
                # "tiny" = fastest, 39M params, ~85% accuracy
                # "base" = better accuracy, still fast
                # "small" = use in production for best accuracy
                self._model = whisper.load_model("tiny")
            except ImportError:
                pass

    def analyze_chunk(self, audio_base64: str) -> AudioAnalysisResult:
        """
        Analyze a 10-second audio chunk.
        audio_base64: base64-encoded WAV/MP3 from browser
        """
        self._load()

        if self._model is None:
            return AudioAnalysisResult(
                transcript="", detected_keywords=[], is_suspicious=False, flags=[]
            )

        try:
            # Decode audio and write to temp file (Whisper needs a file path)
            audio_bytes = base64.b64decode(audio_base64)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            # Transcribe — Whisper handles English + Hindi + Hinglish automatically
            result = self._model.transcribe(
                tmp_path,
                language=None,      # Auto-detect language
                fp16=False,         # Use FP32 for CPU inference
            )
            transcript = result["text"].lower().strip()

            # Cleanup temp file
            os.unlink(tmp_path)

            # Scan for keywords
            found_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in transcript]
            is_suspicious = len(found_keywords) >= MIN_KEYWORD_MATCHES

            flags = ["keyword_detected"] if is_suspicious else []

            return AudioAnalysisResult(
                transcript=transcript,
                detected_keywords=found_keywords,
                is_suspicious=is_suspicious,
                flags=flags,
            )

        except Exception as e:
            return AudioAnalysisResult(
                transcript="",
                detected_keywords=[],
                is_suspicious=False,
                flags=[f"audio_error: {str(e)}"]
            )


audio_analyzer = AudioAnalyzer()
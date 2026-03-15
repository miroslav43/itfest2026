"""
Shared application state accessed by all background tasks and API routes.
All mutations go through threading.Lock to stay thread-safe.
"""
import collections
import threading
import time
import numpy as np
from dataclasses import dataclass, field
from typing import Optional

MAX_FACE_EVENTS = 50


@dataclass
class FaceEvent:
    name: str
    score: float
    age: Optional[int]
    gender: Optional[str]
    timestamp: float

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "score": round(self.score, 3),
            "age": self.age,
            "gender": self.gender,
            "timestamp": self.timestamp,
            "time_ago": f"{time.time() - self.timestamp:.0f}s ago",
        }


@dataclass
class AppState:
    lock: threading.Lock = field(default_factory=threading.Lock)

    # ── Face recognition ─────────────────────────────────────────────────────
    face_active: bool = True
    face_events: collections.deque = field(
        default_factory=lambda: collections.deque(maxlen=MAX_FACE_EVENTS)
    )
    last_face_event: Optional[FaceEvent] = None
    faces_in_frame: int = 0
    known_face_names: list[str] = field(default_factory=list)

    # ── OCR burst ────────────────────────────────────────────────────────────
    ocr_active: bool = False
    ocr_end_time: float = 0.0
    ocr_collected_text: list[str] = field(default_factory=list)
    ocr_last_texts: list[tuple[list[int], str]] = field(default_factory=list)

    # ── YOLO detection ───────────────────────────────────────────────────────
    yolo_active: bool = False

    # ── GPT scene description ─────────────────────────────────────────────────
    gpt_requesting: bool = False
    gpt_description: str = ""
    gpt_display_until: float = 0.0

    # ── Latest camera frame (for on-demand GPT describe) ─────────────────────
    latest_frame: Optional[np.ndarray] = None

    # ── Haptic / distance monitor ────────────────────────────────────────────
    haptic_enabled: bool = True
    obstacle_threshold_cm: float = 50.0

    # ── Distance readings (updated by haptic loop) ───────────────────────────
    last_distances: dict[str, Optional[float]] = field(
        default_factory=lambda: {"front": None, "left": None, "right": None}
    )

    # ── TTS ───────────────────────────────────────────────────────────────────
    tts_active: bool = False

    # ── Face event helpers ────────────────────────────────────────────────────

    def add_face_event(self, name: str, score: float,
                       age: Optional[int] = None, gender: Optional[str] = None) -> FaceEvent:
        ev = FaceEvent(name=name, score=score, age=age, gender=gender, timestamp=time.time())
        with self.lock:
            self.face_events.append(ev)
            self.last_face_event = ev
        return ev

    def get_face_events(self, limit: int = 20) -> list[dict]:
        with self.lock:
            events = list(self.face_events)
        return [e.to_dict() for e in reversed(events)][:limit]

    def get_last_face_alert(self) -> Optional[dict]:
        with self.lock:
            ev = self.last_face_event
        return ev.to_dict() if ev else None

    # ── Other helpers ─────────────────────────────────────────────────────────

    def toggle_ocr(self, duration_sec: int) -> bool:
        with self.lock:
            if self.ocr_active:
                self.ocr_active = False
                return False
            self.ocr_active = True
            self.ocr_end_time = time.time() + duration_sec
            self.ocr_collected_text = []
            self.ocr_last_texts = []
            return True

    def toggle_yolo(self) -> bool:
        with self.lock:
            self.yolo_active = not self.yolo_active
            return self.yolo_active

    def trigger_describe(self) -> bool:
        with self.lock:
            if self.gpt_requesting:
                return False
            self.gpt_requesting = True
            return True

    def finish_describe(self, description: str, display_sec: int) -> None:
        with self.lock:
            self.gpt_description = description
            self.gpt_display_until = time.time() + display_sec
            self.gpt_requesting = False

    def set_distances(self, distances: dict[str, Optional[float]]) -> None:
        with self.lock:
            self.last_distances.update(distances)

    def set_latest_frame(self, frame: np.ndarray) -> None:
        with self.lock:
            self.latest_frame = frame

    def get_latest_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None

    def status_dict(self) -> dict:
        last_ev = self.last_face_event
        return {
            "face_recognition": self.face_active,
            "faces_in_frame": self.faces_in_frame,
            "last_face_alert": last_ev.to_dict() if last_ev else None,
            "ocr_active": self.ocr_active,
            "yolo_active": self.yolo_active,
            "haptic_enabled": self.haptic_enabled,
            "obstacle_threshold_cm": self.obstacle_threshold_cm,
            "last_distances": self.last_distances,
            "gpt_requesting": self.gpt_requesting,
            "gpt_description": self.gpt_description,
            "tts_active": self.tts_active,
        }


# Single global instance shared across the whole app
app_state = AppState()

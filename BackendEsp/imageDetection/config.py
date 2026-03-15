"""
Central configuration — all tuneable values and .env secrets live here.
Every other module imports from this file, never from os.environ directly.
"""
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env from the same directory as this file
load_dotenv(Path(__file__).parent / ".env")

# ── Hardware IPs ────────────────────────────────────────────────────────────
ESP_IP: str = os.getenv("ESP_IP", "10.210.85.100")
CAM_IP: str = os.getenv("CAM_IP", "10.210.85.207")

ESP_BASE_URL: str = f"http://{ESP_IP}"
CAM_BASE_URL: str = f"http://{CAM_IP}"

# ── API keys ─────────────────────────────────────────────────────────────────
OPENAI_API_KEY: str = os.getenv("CHATGPT_API_KEY", "")

# ── OpenAI TTS ───────────────────────────────────────────────────────────────
# tts-1        → cheapest, good quality  (~$0.015 / 1K chars)
# tts-1-hd     → better quality          (~$0.030 / 1K chars)
# Voices: alloy, echo, fable, onyx, nova, shimmer
# nova / shimmer sound natural in Romanian
TTS_MODEL: str = os.getenv("TTS_MODEL", "tts-1")
TTS_VOICE: str = os.getenv("TTS_VOICE", "nova")
TTS_CACHE_DIR: Path = Path(__file__).parent / "tts_cache"

# ── OpenAI STT (Whisper) ──────────────────────────────────────────────────────
# whisper-1 → only model available via API, $0.006 / min
STT_MODEL: str = "whisper-1"
STT_LANGUAGE: str = "ro"   # Romanian — improves accuracy and speed

# ── Face recognition ─────────────────────────────────────────────────────────
KNOWN_FACES_DIR: Path = Path(__file__).parent / "known_faces"
SUPPORTED_IMG_EXT: set[str] = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
FACE_SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_THRESHOLD", "0.4"))
FACE_COOLDOWN_SEC: int = int(os.getenv("FACE_COOLDOWN", "30"))
FACE_DET_SIZE: tuple[int, int] = (640, 640)
FACE_EVERY_N_FRAMES: int = 3   # run face model every Nth frame

# ── Haptic / distance ────────────────────────────────────────────────────────
OBSTACLE_THRESHOLD_CM: float = float(os.getenv("OBSTACLE_THRESHOLD_CM", "50"))
CRITICAL_THRESHOLD_CM: float = float(os.getenv("CRITICAL_THRESHOLD_CM", "30"))
DISTANCE_POLL_INTERVAL: float = 2.5   # ESP needs ~1.5s per response on this WiFi

# Motor → direction mapping: motor number (1-4) tied to sensor direction
MOTOR_MAP: dict[str, int] = {"front": 1, "left": 2, "right": 3, "all": 4}

# ── OCR ───────────────────────────────────────────────────────────────────────
OCR_DURATION_SEC: int = int(os.getenv("OCR_DURATION", "10"))
OCR_INTERVAL_SEC: float = 2.0
OCR_CONF_THRESHOLD: float = 0.3

# ── YOLO ─────────────────────────────────────────────────────────────────────
YOLO_MODEL: str = os.getenv("YOLO_MODEL", "yolov8n.pt")
YOLO_CONF: float = 0.4
YOLO_EVERY_N_FRAMES: int = 2
YOLO_ALERT_CLASSES: set[str] = {"bus"}

# ── GPT scene description ────────────────────────────────────────────────────
GPT_MODEL: str = "gpt-4o-mini"
GPT_SCENE_DISPLAY_SEC: int = 12

# ── Server ───────────────────────────────────────────────────────────────────
API_PORT: int = int(os.getenv("API_PORT", "8000"))
API_HOST: str = "0.0.0.0"

# ── HTTP client timeouts ─────────────────────────────────────────────────────
ESP_TIMEOUT: float = 5.0
CAM_TIMEOUT: float = 5.0
STREAM_TIMEOUT: float = 30.0

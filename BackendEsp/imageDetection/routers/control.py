"""
FastAPI router — control routes for the Mac-side processing features:
OCR, YOLO, GPT scene description, TTS, face events, haptic toggle,
camera snapshot, and system status.
"""
import threading

import cv2
from fastapi import APIRouter, Body, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

import gpt_engine
import stt
import tts
from config import GPT_SCENE_DISPLAY_SEC, OCR_DURATION_SEC
from state import app_state

router = APIRouter(tags=["Control"])


# ── System status ─────────────────────────────────────────────────────────────

@router.get("/status")
def get_status():
    return app_state.status_dict()


# ── Face events ───────────────────────────────────────────────────────────────

@router.get("/face/events")
def face_events(limit: int = Query(20, ge=1, le=50)):
    """Return the last N face recognition alerts (newest first)."""
    return {
        "events": app_state.get_face_events(limit),
        "faces_in_frame": app_state.faces_in_frame,
        "known_faces": app_state.known_face_names,
    }


@router.get("/face/latest")
def face_latest():
    """Return the most recent face recognition alert."""
    ev = app_state.get_last_face_alert()
    return {
        "latest": ev,
        "faces_in_frame": app_state.faces_in_frame,
    }


# ── Camera snapshot (processed frame with overlays, JPEG) ─────────────────────

@router.get("/cam/snapshot")
def camera_snapshot():
    """Return the latest processed camera frame as JPEG."""
    frame = app_state.get_latest_frame()
    if frame is None:
        raise HTTPException(503, "No camera frame available yet")
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        raise HTTPException(500, "Failed to encode frame")
    return Response(content=buf.tobytes(), media_type="image/jpeg")


# ── OCR ───────────────────────────────────────────────────────────────────────

@router.post("/ocr")
def toggle_ocr():
    active = app_state.toggle_ocr(OCR_DURATION_SEC)
    return {"ocr_active": active, "duration_seconds": OCR_DURATION_SEC if active else 0}


# ── YOLO detection ────────────────────────────────────────────────────────────

@router.post("/detect")
def toggle_detect():
    active = app_state.toggle_yolo()
    return {"yolo_active": active}


# ── GPT scene description ─────────────────────────────────────────────────────

@router.post("/describe")
def trigger_describe():
    frame = app_state.get_latest_frame()
    if frame is None:
        raise HTTPException(503, "No camera frame available yet")
    if not app_state.trigger_describe():
        raise HTTPException(429, "A GPT describe request is already in progress")
    threading.Thread(target=gpt_engine.describe_scene, args=(frame,), daemon=True).start()
    return {"status": "requested", "display_seconds": GPT_SCENE_DISPLAY_SEC}


# ── TTS ───────────────────────────────────────────────────────────────────────

@router.post("/tts")
def speak(text: str = Body(..., embed=True)):
    if not text.strip():
        raise HTTPException(400, "text must not be empty")
    tts.speak(text)
    return {"status": "playing", "text": text}


@router.delete("/tts/cache")
def clear_tts_cache():
    removed = tts.clear_cache()
    return {"removed_files": removed}


# ── STT — Speech-to-Text (Whisper) ───────────────────────────────────────────

@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """
    Transcrie un fisier audio uploadat in romana via OpenAI Whisper.
    Formate acceptate: mp3, wav, m4a, webm, mp4, mpeg.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Fisierul audio e gol")
    text = stt.transcribe_bytes(audio_bytes, filename=file.filename or "audio.wav")
    if not text:
        raise HTTPException(502, "STT nu a putut transcrie audio-ul")
    return {"text": text, "language": "ro"}


# ── Haptic control ────────────────────────────────────────────────────────────

@router.post("/haptic/enable")
def haptic_enable():
    app_state.haptic_enabled = True
    return {"haptic_enabled": True}


@router.post("/haptic/disable")
def haptic_disable():
    app_state.haptic_enabled = False
    return {"haptic_enabled": False}


@router.post("/haptic/threshold")
def set_threshold(cm: float = Body(..., embed=True)):
    if cm <= 0:
        raise HTTPException(400, "threshold must be > 0")
    app_state.obstacle_threshold_cm = cm
    return {"obstacle_threshold_cm": cm}


# ── Help ─────────────────────────────────────────────────────────────────────

@router.get("/help")
def help_routes():
    return {
        "routes": [
            "GET  /status",
            "GET  /face/events?limit=20",
            "GET  /face/latest",
            "GET  /cam/snapshot      (JPEG image)",
            "POST /ocr",
            "POST /detect",
            "POST /describe",
            "POST /tts          body: {\"text\": \"...\"}",
            "DELETE /tts/cache",
            "POST /stt              file: audio upload → text roman",
            "POST /haptic/enable",
            "POST /haptic/disable",
            "POST /haptic/threshold  body: {\"cm\": 50}",
            "GET  /esp/...      (ESP32 proxy — see /esp/help)",
            "GET  /cam/...      (Camera proxy — see /cam/help)",
        ]
    }

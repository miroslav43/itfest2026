"""
Main camera processing loop.

Runs in the foreground (called from main.py) and:
  - Pulls frames from ThreadedCamera
  - Runs InsightFace every FACE_EVERY_N_FRAMES frames
  - Runs YOLO every YOLO_EVERY_N_FRAMES frames (when enabled)
  - Runs EasyOCR on a time interval (when enabled)
  - Overlays results on the OpenCV window
  - Triggers ElevenLabs TTS when a known face is detected
  - Dispatches GPT scene/OCR requests to background threads
"""
import threading
import time

import cv2
import numpy as np

import gpt_engine
import ocr_engine
import yolo_engine
from camera_thread import ThreadedCamera
from config import (
    FACE_COOLDOWN_SEC,
    FACE_EVERY_N_FRAMES,
    FACE_SIMILARITY_THRESHOLD,
    GPT_SCENE_DISPLAY_SEC,
    OCR_DURATION_SEC,
    OCR_INTERVAL_SEC,
    YOLO_ALERT_CLASSES,
    YOLO_EVERY_N_FRAMES,
)
from face_engine import FaceAnalysis, build_face_app, face_label, find_best_match, load_known_faces
from notify import send_notification
from state import app_state
from tts import speak_face


# ── Drawing helpers ───────────────────────────────────────────────────────────

def _draw_face_box(frame, bbox, label: str, color: tuple) -> None:
    x1, y1, x2, y2 = bbox.astype(int)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
    cv2.putText(frame, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)


def _draw_hud(frame, fps: float) -> None:
    h, w = frame.shape[:2]
    modes = []
    if app_state.face_active:
        modes.append("FACE")
    if app_state.ocr_active:
        remaining = max(0, app_state.ocr_end_time - time.time())
        modes.append(f"OCR {remaining:.0f}s")
    if app_state.yolo_active:
        modes.append("YOLO")
    if app_state.gpt_requesting:
        modes.append("GPT…")
    bar = f"  {fps:.0f} FPS | " + " | ".join(modes) + "  "
    cv2.rectangle(frame, (0, 0), (len(bar) * 14, 32), (40, 40, 40), -1)
    cv2.putText(frame, bar, (4, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 200), 2)

    keys_text = "[O]CR  [D]etect  [G]PT describe  [Q]uit"
    cv2.rectangle(frame, (0, h - 30), (w, h), (40, 40, 40), -1)
    cv2.putText(frame, keys_text, (10, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)


# ── Main loop ─────────────────────────────────────────────────────────────────

def run_camera_loop(stream_url: str) -> None:
    """
    Blocking loop — call this from main.py in the main thread (or a dedicated thread).
    """
    face_app = build_face_app()
    known_faces = load_known_faces(face_app)
    app_state.known_face_names = list(known_faces.keys())

    cam = ThreadedCamera(stream_url)
    time.sleep(1.0)
    print(f"[LOOP] Stream thread started for {stream_url}\n")

    alert_cooldowns: dict[str, float] = {}
    yolo_cooldowns: dict[str, float] = {}

    # Cached inference results — re-drawn on duplicate frames
    cached_face_draws: list[tuple] = []
    cached_yolo: list[dict] = []
    ocr_last_texts: list[tuple[list[int], str]] = []

    last_frame_id = -1
    last_good_frame = None
    last_ocr_time = 0.0
    total_frames = 0

    fps_time = time.time()
    fps_count = 0
    current_fps = 0.0

    while True:
        ret, frame, fid = cam.read()

        if not ret or frame is None:
            if last_good_frame is not None:
                placeholder = last_good_frame.copy()
                cv2.putText(placeholder, "Waiting for stream…", (30, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
                cv2.imshow("Camera", placeholder)
            if cv2.waitKey(30) & 0xFF == ord("q"):
                break
            continue

        is_new = fid != last_frame_id
        last_frame_id = fid

        if not is_new:
            # Re-draw cached overlays without running inference again
            for bbox, label, color in cached_face_draws:
                _draw_face_box(frame, bbox, label, color)
            if app_state.ocr_active:
                ocr_engine.draw_ocr(frame, ocr_last_texts)
            if app_state.yolo_active:
                yolo_engine.draw_yolo(frame, cached_yolo)
            gpt_engine.draw_gpt_overlay(frame)
            _draw_hud(frame, current_fps)
            cv2.imshow("Camera", frame)
            key = cv2.waitKey(1) & 0xFF
            _handle_key(key, frame)
            if key == ord("q"):
                break
            continue

        # ── New frame ────────────────────────────────────────────────────────
        last_good_frame = frame
        app_state.set_latest_frame(frame)
        now = time.time()
        total_frames += 1

        # Face recognition
        if app_state.face_active and total_frames % FACE_EVERY_N_FRAMES == 0:
            cached_face_draws = []
            detected_faces = face_app.get(frame)
            app_state.faces_in_frame = len(detected_faces)
            for face in detected_faces:
                name, score = find_best_match(face.embedding, known_faces, FACE_SIMILARITY_THRESHOLD)
                label = face_label(face, name, score)
                color = (0, 200, 0) if name else (0, 0, 200)
                cached_face_draws.append((face.bbox, label, color))
                if name:
                    last_alert = alert_cooldowns.get(name, 0)
                    if now - last_alert > FACE_COOLDOWN_SEC:
                        alert_cooldowns[name] = now
                        age = int(face.age) if hasattr(face, "age") and face.age is not None else None
                        gender = ("M" if face.gender == 1 else "F") if hasattr(face, "gender") else None
                        app_state.add_face_event(name, score, age, gender)
                        speak_face(name)
                        send_notification("Față detectată", f"{name} e în fața ta")
                        print(f"[FACE] {name} (sim={score:.3f})")

        for bbox, label, color in cached_face_draws:
            _draw_face_box(frame, bbox, label, color)

        # OCR burst
        if app_state.ocr_active:
            if now > app_state.ocr_end_time:
                app_state.ocr_active = False
                print(f"[OCR] Burst ended, {len(app_state.ocr_collected_text)} fragments")
                app_state.ocr_last_texts = []
                if app_state.ocr_collected_text:
                    threading.Thread(
                        target=gpt_engine.summarize_ocr_text,
                        args=(list(app_state.ocr_collected_text),),
                        daemon=True,
                    ).start()
            elif now - last_ocr_time >= OCR_INTERVAL_SEC:
                last_ocr_time = now
                ocr_last_texts = ocr_engine.process_ocr(frame)
                app_state.ocr_last_texts = ocr_last_texts
                for _, text in ocr_last_texts:
                    app_state.ocr_collected_text.append(text)
            ocr_engine.draw_ocr(frame, ocr_last_texts)

        # YOLO detection
        if app_state.yolo_active:
            if total_frames % YOLO_EVERY_N_FRAMES == 0:
                cached_yolo = yolo_engine.process_yolo(frame)
                for det in cached_yolo:
                    if det["alert"]:
                        last = yolo_cooldowns.get(det["class"], 0)
                        if now - last > FACE_COOLDOWN_SEC:
                            yolo_cooldowns[det["class"]] = now
                            send_notification("Obiect detectat", f"{det['class']} detectat!")
                            print(f"[YOLO] {det['class']} ({det['conf']:.0%})")
            yolo_engine.draw_yolo(frame, cached_yolo)
        else:
            cached_yolo = []

        gpt_engine.draw_gpt_overlay(frame)

        # FPS counter
        fps_count += 1
        elapsed = now - fps_time
        if elapsed >= 1.0:
            current_fps = fps_count / elapsed
            fps_count = 0
            fps_time = now

        _draw_hud(frame, current_fps)
        cv2.imshow("Camera", frame)
        key = cv2.waitKey(1) & 0xFF
        _handle_key(key, frame)
        if key == ord("q"):
            break

    cam.stop()
    cv2.destroyAllWindows()
    print("[LOOP] Camera loop exited.")


def _handle_key(key: int, frame) -> None:
    if key == ord("o"):
        active = app_state.toggle_ocr(OCR_DURATION_SEC)
        print(f"[KEY] OCR {'ON' if active else 'OFF'}")
    elif key == ord("d"):
        active = app_state.toggle_yolo()
        print(f"[KEY] YOLO {'ON' if active else 'OFF'}")
    elif key == ord("g"):
        if app_state.trigger_describe():
            f = app_state.get_latest_frame()
            if f is not None:
                threading.Thread(target=gpt_engine.describe_scene, args=(f,), daemon=True).start()
                print("[KEY] GPT scene triggered")

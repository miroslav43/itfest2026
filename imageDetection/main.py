import sys
import types

sys.modules["insightface.thirdparty.face3d.mesh.cython.mesh_core_cython"] = types.ModuleType(
    "mesh_core_cython"
)

import argparse
import base64
import os
import subprocess
import textwrap
import threading
import time
import warnings
from pathlib import Path

os.environ["PYTHONUNBUFFERED"] = "1"
warnings.filterwarnings("ignore", message=".*estimate.*deprecated.*", category=FutureWarning)

import certifi
import httpx

import cv2
import numpy as np
from dotenv import load_dotenv
from insightface.app import FaceAnalysis

load_dotenv()

_openai_http = httpx.Client(verify=certifi.where())


def get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.getenv("CHATGPT_API_KEY"), http_client=_openai_http)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
KNOWN_FACES_DIR = Path(__file__).parent / "known_faces"
DET_SIZE = (640, 640)
SUPPORTED_IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_STREAM = "http://10.210.85.207/stream"
DEFAULT_THRESHOLD = 0.4
DEFAULT_COOLDOWN = 30
OCR_DURATION = 10
SCENE_DISPLAY_DURATION = 12
API_PORT = 5000

YOLO_ALERT_CLASSES = {"bus"}

# Frame skipping: only run heavy inference every Nth frame, cache results
FACE_EVERY_N = 3
YOLO_EVERY_N = 2
OCR_INTERVAL_SEC = 2.0

# ---------------------------------------------------------------------------
# Shared state  (accessed from camera loop + FastAPI thread)
# ---------------------------------------------------------------------------
class AppState:
    def __init__(self) -> None:
        self.lock = threading.Lock()

        # Face recognition (always on)
        self.face_active = True

        # OCR burst
        self.ocr_active = False
        self.ocr_end_time = 0.0
        self.ocr_collected_text: list[str] = []
        self.ocr_last_texts: list[tuple[list[int], str]] = []

        # YOLO object detection
        self.yolo_active = False

        # GPT scene description
        self.gpt_requesting = False
        self.gpt_description = ""
        self.gpt_display_until = 0.0

        # Latest frame (for API-triggered GPT describe)
        self.latest_frame: np.ndarray | None = None

    def toggle_ocr(self) -> bool:
        with self.lock:
            if self.ocr_active:
                self.ocr_active = False
                return False
            self.ocr_active = True
            self.ocr_end_time = time.time() + OCR_DURATION
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

    def status_dict(self) -> dict:
        return {
            "face_recognition": self.face_active,
            "ocr_active": self.ocr_active,
            "yolo_active": self.yolo_active,
            "gpt_requesting": self.gpt_requesting,
            "gpt_description": self.gpt_description,
        }


state = AppState()

# ---------------------------------------------------------------------------
# Face recognition helpers
# ---------------------------------------------------------------------------

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def load_known_faces(face_app: FaceAnalysis) -> dict[str, np.ndarray]:
    known: dict[str, np.ndarray] = {}
    if not KNOWN_FACES_DIR.exists():
        print(f"[WARN] Folder '{KNOWN_FACES_DIR}' nu exista.")
        return known

    for img_path in sorted(KNOWN_FACES_DIR.iterdir()):
        if img_path.suffix.lower() not in SUPPORTED_IMG_EXT:
            continue
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"[WARN] Nu pot citi: {img_path.name}")
            continue
        faces = face_app.get(img)
        if not faces:
            print(f"[WARN] Nicio fata in: {img_path.name}")
            continue
        if len(faces) > 1:
            print(f"[WARN] Mai multe fete in {img_path.name}, folosesc prima.")
        name = img_path.stem.replace("_", " ")
        known[name] = faces[0].embedding
        print(f"[OK]   {name}")
    print(f"\nTotal persoane cunoscute: {len(known)}\n")
    return known


def find_best_match(
    embedding: np.ndarray, known_faces: dict[str, np.ndarray], threshold: float
) -> tuple[str | None, float]:
    best_name, best_score = None, -1.0
    for name, known_emb in known_faces.items():
        score = cosine_similarity(embedding, known_emb)
        if score > best_score:
            best_score = score
            best_name = name
    if best_score >= threshold:
        return best_name, best_score
    return None, best_score


def send_notification(title: str, body: str) -> None:
    subprocess.Popen(
        ["notify-send", "--urgency=critical", "--expire-time=5000", title, body],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------

def draw_face_box(frame: np.ndarray, bbox: np.ndarray, label: str, color: tuple) -> None:
    x1, y1, x2, y2 = bbox.astype(int)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
    cv2.putText(frame, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)


def draw_hud(frame: np.ndarray, fps: float) -> None:
    """Status bar in top-left corner."""
    h, w = frame.shape[:2]
    modes = []
    if state.face_active:
        modes.append("FACE")
    if state.ocr_active:
        remaining = max(0, state.ocr_end_time - time.time())
        modes.append(f"OCR {remaining:.0f}s")
    if state.yolo_active:
        modes.append("YOLO")
    if state.gpt_requesting:
        modes.append("GPT...")

    bar = f"  {fps:.0f} FPS | " + " | ".join(modes) + "  "
    cv2.rectangle(frame, (0, 0), (len(bar) * 14, 32), (40, 40, 40), -1)
    cv2.putText(frame, bar, (4, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 200), 2)

    keys_text = "[O]CR  [D]etect  [G]PT describe  [Q]uit"
    cv2.rectangle(frame, (0, h - 30), (w, h), (40, 40, 40), -1)
    cv2.putText(frame, keys_text, (10, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)


def draw_gpt_overlay(frame: np.ndarray) -> None:
    if not state.gpt_description or time.time() > state.gpt_display_until:
        return
    h, w = frame.shape[:2]
    lines = textwrap.wrap(state.gpt_description, width=60)
    box_h = 30 + len(lines) * 26
    y_start = h - 60 - box_h
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, y_start), (w - 10, y_start + box_h), (30, 30, 30), -1)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
    cv2.putText(frame, "GPT-4o-mini:", (20, y_start + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2)
    for i, line in enumerate(lines):
        cv2.putText(frame, line, (20, y_start + 48 + i * 26), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)


# ---------------------------------------------------------------------------
# OCR  (EasyOCR, lazy-loaded)
# ---------------------------------------------------------------------------
_ocr_reader = None


def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        print("[INIT] Loading EasyOCR (GPU) ...")
        _ocr_reader = easyocr.Reader(["en", "ro"], gpu=True)
        print("[INIT] EasyOCR ready.")
    return _ocr_reader


def process_ocr(frame: np.ndarray) -> list[tuple[list[int], str]]:
    reader = get_ocr_reader()
    flipped = cv2.flip(frame, 1)
    results = reader.readtext(flipped)
    h, w = frame.shape[:2]
    texts_with_pos: list[tuple[list[int], str]] = []
    for bbox_pts, text, conf in results:
        if conf < 0.3:
            continue
        pts = np.array(bbox_pts, dtype=np.int32)
        x1, y1 = pts.min(axis=0)
        x2, y2 = pts.max(axis=0)
        # Mirror bbox coords back to original frame space
        texts_with_pos.append(([w - x2, y1, w - x1, y2], text))
    return texts_with_pos


def draw_ocr(frame: np.ndarray, texts: list[tuple[list[int], str]]) -> None:
    for (x1, y1, x2, y2), text in texts:
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 200, 0), 2)
        cv2.putText(frame, text, (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 1)


def summarize_ocr_text(collected: list[str]) -> None:
    """Send collected OCR text to GPT-4o-mini for reformulation (runs in thread)."""
    combined = " ".join(set(collected))
    if not combined.strip():
        return
    try:
        client = get_openai_client()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Reformuleaza si sumarizeaza urmatorul text detectat prin OCR dintr-un stream video. Fii concis, 1-2 propozitii."},
                {"role": "user", "content": combined},
            ],
            max_tokens=150,
        )
        summary = resp.choices[0].message.content or ""
        state.gpt_description = f"[OCR Summary] {summary}"
        state.gpt_display_until = time.time() + SCENE_DISPLAY_DURATION
        print(f"[GPT OCR] {summary}")
    except Exception as e:
        print(f"[ERR] GPT OCR summary failed: {e}")


# ---------------------------------------------------------------------------
# YOLO object detection  (lazy-loaded)
# ---------------------------------------------------------------------------
_yolo_model = None


def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        print("[INIT] Loading YOLOv8n ...")
        _yolo_model = YOLO("yolov8n.pt")
        print("[INIT] YOLOv8n ready.")
    return _yolo_model


def process_yolo(frame: np.ndarray) -> list[dict]:
    model = get_yolo_model()
    results = model(frame, verbose=False, conf=0.4)[0]
    detections: list[dict] = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = results.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
        detections.append({"class": cls_name, "conf": conf, "bbox": [int(x1), int(y1), int(x2), int(y2)]})
    return detections


def draw_yolo(frame: np.ndarray, detections: list[dict]) -> None:
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        label = f"{det['class']} {det['conf']:.0%}"
        color = (255, 100, 50) if det["class"] in YOLO_ALERT_CLASSES else (200, 200, 50)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, label, (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)


# ---------------------------------------------------------------------------
# GPT-4o-mini scene description  (vision API, runs in thread)
# ---------------------------------------------------------------------------

def describe_scene(frame: np.ndarray) -> None:
    """Encode frame and send to GPT-4o-mini vision. Runs in a background thread."""
    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        b64 = base64.b64encode(buf).decode("utf-8")

        client = get_openai_client()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Descrie pe scurt ce vezi in aceasta imagine dintr-un stream video live. 2-3 propozitii, in romana."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}},
                    ],
                }
            ],
            max_tokens=200,
        )
        desc = resp.choices[0].message.content or ""
        state.gpt_description = desc
        state.gpt_display_until = time.time() + SCENE_DISPLAY_DURATION
        print(f"[GPT SCENE] {desc}")
        send_notification("Scene Description", desc)
    except Exception as e:
        print(f"[ERR] GPT scene describe failed: {e}")
    finally:
        state.gpt_requesting = False


# ---------------------------------------------------------------------------
# FastAPI server  (runs in background daemon thread)
# ---------------------------------------------------------------------------

def create_api():
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    api = FastAPI(title="Camera Multi-Feature API", version="1.0")

    @api.post("/ocr")
    def api_ocr():
        activated = state.toggle_ocr()
        return {"ocr_active": activated, "duration_seconds": OCR_DURATION if activated else 0}

    @api.post("/detect")
    def api_detect():
        active = state.toggle_yolo()
        return {"yolo_active": active}

    @api.post("/describe")
    def api_describe():
        if state.latest_frame is None:
            return JSONResponse({"error": "no frame available"}, status_code=503)
        started = state.trigger_describe()
        if not started:
            return JSONResponse({"error": "already requesting"}, status_code=429)
        threading.Thread(target=describe_scene, args=(state.latest_frame.copy(),), daemon=True).start()
        return {"status": "requesting", "display_seconds": SCENE_DISPLAY_DURATION}

    @api.get("/status")
    def api_status():
        return state.status_dict()

    return api


def start_api_server(port: int = API_PORT) -> None:
    import uvicorn
    api = create_api()
    config = uvicorn.Config(api, host="0.0.0.0", port=port, log_level="warning")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    print(f"[API] FastAPI running on http://0.0.0.0:{port}  (docs: http://localhost:{port}/docs)\n")


# ---------------------------------------------------------------------------
# Threaded camera capture  (never blocks main loop)
# ---------------------------------------------------------------------------

class ThreadedCamera:
    """Reads frames in a background thread so the main loop never blocks."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.frame: np.ndarray | None = None
        self.frame_id: int = 0
        self.running = True
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self) -> None:
        cap = cv2.VideoCapture(self.url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        while self.running:
            ret, frame = cap.read()
            if ret:
                with self._lock:
                    self.frame = frame
                    self.frame_id += 1
            else:
                cap.release()
                time.sleep(0.3)
                cap = cv2.VideoCapture(self.url)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.release()

    def read(self) -> tuple[bool, np.ndarray | None, int]:
        with self._lock:
            if self.frame is None:
                return False, None, self.frame_id
            return True, self.frame.copy(), self.frame_id

    def stop(self) -> None:
        self.running = False


# ---------------------------------------------------------------------------
# Main camera loop
# ---------------------------------------------------------------------------

def run(stream_url: str, threshold: float, cooldown: int, port: int = API_PORT) -> None:
    # --- Init models ---
    print("Initializare InsightFace (SCRFD + ArcFace) ...")
    face_app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition", "genderage"],
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    face_app.prepare(ctx_id=0, det_size=DET_SIZE)
    print("Model incarcat.\n")

    known_faces = load_known_faces(face_app)

    # --- Start FastAPI ---
    start_api_server(port)

    # --- Open stream (threaded, non-blocking) ---
    print(f"Conectare la stream: {stream_url}")
    cam = ThreadedCamera(stream_url)
    time.sleep(1.0)
    print("Stream thread pornit.\n")

    alert_cooldowns: dict[str, float] = {}
    fps_time = time.time()
    frame_count = 0
    total_frames = 0
    current_fps = 0.0
    yolo_cooldowns: dict[str, float] = {}

    cached_face_draws: list[tuple[np.ndarray, str, tuple]] = []
    cached_yolo_detections: list[dict] = []
    last_ocr_time = 0.0
    last_good_frame: np.ndarray | None = None
    last_frame_id = -1

    while True:
        ret, frame, fid = cam.read()
        if not ret or frame is None:
            if last_good_frame is not None:
                placeholder = last_good_frame.copy()
                cv2.putText(placeholder, "Waiting for stream...", (30, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
                cv2.imshow("Camera Multi-Feature", placeholder)
            if cv2.waitKey(30) & 0xFF == ord("q"):
                break
            continue

        is_new = fid != last_frame_id
        last_frame_id = fid

        if not is_new:
            # Same frame from stream -- just redraw cached overlays, don't re-run inference
            for bbox, label, color in cached_face_draws:
                draw_face_box(frame, bbox, label, color)
            if state.ocr_active:
                draw_ocr(frame, state.ocr_last_texts)
            if state.yolo_active:
                draw_yolo(frame, cached_yolo_detections)
            draw_gpt_overlay(frame)
            draw_hud(frame, current_fps)
            cv2.imshow("Camera Multi-Feature", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            elif key == ord("o"):
                state.toggle_ocr()
            elif key == ord("d"):
                state.toggle_yolo()
            elif key == ord("g") and state.trigger_describe():
                threading.Thread(target=describe_scene, args=(frame.copy(),), daemon=True).start()
            continue

        last_good_frame = frame
        state.latest_frame = frame
        now = time.time()
        total_frames += 1

        # --- Face recognition: only every Nth frame ---
        if total_frames % FACE_EVERY_N == 0:
            faces = face_app.get(frame)
            cached_face_draws = []
            for face in faces:
                name, score = find_best_match(face.embedding, known_faces, threshold)
                age = int(face.age) if hasattr(face, "age") else None
                gender = "M" if hasattr(face, "gender") and face.gender == 1 else "F" if hasattr(face, "gender") else None
                extra = f" {gender}/{age}" if age is not None and gender is not None else ""
                if name:
                    cached_face_draws.append((face.bbox, f"{name} {score:.2f}{extra}", (0, 200, 0)))
                    last_alert = alert_cooldowns.get(name, 0)
                    if now - last_alert > cooldown:
                        send_notification("Face Recognition", f"{name} detectat!")
                        alert_cooldowns[name] = now
                        print(f"[FACE] {name} (sim={score:.3f})")
                else:
                    cached_face_draws.append((face.bbox, f"Unknown{extra}", (0, 0, 200)))

        for bbox, label, color in cached_face_draws:
            draw_face_box(frame, bbox, label, color)

        # --- OCR burst: only every OCR_INTERVAL_SEC seconds ---
        if state.ocr_active:
            if now > state.ocr_end_time:
                state.ocr_active = False
                print(f"[OCR] Burst finished, {len(state.ocr_collected_text)} fragments")
                state.ocr_last_texts = []
                if state.ocr_collected_text:
                    threading.Thread(
                        target=summarize_ocr_text,
                        args=(list(state.ocr_collected_text),),
                        daemon=True,
                    ).start()
            elif now - last_ocr_time >= OCR_INTERVAL_SEC:
                last_ocr_time = now
                texts = process_ocr(frame)
                state.ocr_last_texts = texts
                for _, text in texts:
                    state.ocr_collected_text.append(text)

            draw_ocr(frame, state.ocr_last_texts)

        # --- YOLO: only every Nth frame ---
        if state.yolo_active:
            if total_frames % YOLO_EVERY_N == 0:
                cached_yolo_detections = process_yolo(frame)
                for det in cached_yolo_detections:
                    if det["class"] in YOLO_ALERT_CLASSES:
                        last = yolo_cooldowns.get(det["class"], 0)
                        if now - last > cooldown:
                            send_notification("Object Detection", f"{det['class']} detectat! ({det['conf']:.0%})")
                            yolo_cooldowns[det["class"]] = now
                            print(f"[YOLO] {det['class']} ({det['conf']:.0%})")
            draw_yolo(frame, cached_yolo_detections)
        else:
            cached_yolo_detections = []

        # --- GPT overlay ---
        draw_gpt_overlay(frame)

        # --- HUD ---
        frame_count += 1
        elapsed = now - fps_time
        if elapsed >= 1.0:
            current_fps = frame_count / elapsed
            frame_count = 0
            fps_time = now
        draw_hud(frame, current_fps)

        # --- Display ---
        cv2.imshow("Camera Multi-Feature", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break
        elif key == ord("o"):
            active = state.toggle_ocr()
            last_ocr_time = 0.0
            print(f"[KEY] OCR {'ON' if active else 'OFF'}")
        elif key == ord("d"):
            active = state.toggle_yolo()
            print(f"[KEY] YOLO {'ON' if active else 'OFF'}")
        elif key == ord("g"):
            if state.trigger_describe():
                threading.Thread(target=describe_scene, args=(frame.copy(),), daemon=True).start()
                print("[KEY] GPT scene describe triggered")

    cam.stop()
    cv2.destroyAllWindows()
    print("Terminat.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Camera Multi-Feature System")
    parser.add_argument("--stream", default=DEFAULT_STREAM, help=f"Stream URL (default: {DEFAULT_STREAM})")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help=f"Face similarity threshold (default: {DEFAULT_THRESHOLD})")
    parser.add_argument("--cooldown", type=int, default=DEFAULT_COOLDOWN, help=f"Alert cooldown seconds (default: {DEFAULT_COOLDOWN})")
    parser.add_argument("--port", type=int, default=API_PORT, help=f"API port (default: {API_PORT})")
    args = parser.parse_args()
    run(args.stream, args.threshold, args.cooldown, args.port)


if __name__ == "__main__":
    main()

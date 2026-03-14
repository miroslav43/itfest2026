import sys
import types

sys.modules["insightface.thirdparty.face3d.mesh.cython.mesh_core_cython"] = types.ModuleType(
    "mesh_core_cython"
)

import argparse
import os
import subprocess
import threading
import time
import warnings
from pathlib import Path

os.environ["PYTHONUNBUFFERED"] = "1"
warnings.filterwarnings("ignore", message=".*estimate.*deprecated.*", category=FutureWarning)

import cv2
import numpy as np
from insightface.app import FaceAnalysis

KNOWN_FACES_DIR = Path(__file__).parent / "known_faces"
SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
STREAM_URL = "http://10.210.85.207/stream"
THRESHOLD = 0.4
COOLDOWN = 30
WINDOW_NAME = "Face Recognition"


class ThreadedCamera:
    """Reads frames in a background thread so cap.read() never blocks the main loop."""

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


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stream", default=STREAM_URL)
    parser.add_argument("--threshold", type=float, default=THRESHOLD)
    args = parser.parse_args()

    print("Loading InsightFace (detection + recognition only) ...")
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    print("OK\n")

    known: dict[str, np.ndarray] = {}
    if KNOWN_FACES_DIR.exists():
        for p in sorted(KNOWN_FACES_DIR.iterdir()):
            if p.suffix.lower() not in SUPPORTED_EXT:
                continue
            img = cv2.imread(str(p))
            if img is None:
                continue
            faces = app.get(img)
            if faces:
                known[p.stem.replace("_", " ")] = faces[0].embedding
                print(f"  [OK] {p.stem}")
    print(f"\n{len(known)} known faces\n")

    cam = ThreadedCamera(args.stream)
    time.sleep(1.0)
    print("Stream thread started.\n")

    cooldowns: dict[str, float] = {}
    fps_t = time.time()
    fps_n = 0
    fps = 0.0
    last_good_frame: np.ndarray | None = None
    last_frame_id = -1
    cached_draws: list[tuple[list[int], str, float, tuple]] = []

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)

    while True:
        if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
            break

        ret, frame, fid = cam.read()
        if not ret or frame is None:
            if last_good_frame is not None:
                placeholder = last_good_frame.copy()
                cv2.putText(placeholder, "Waiting for stream...", (30, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
                cv2.imshow(WINDOW_NAME, placeholder)
            if cv2.waitKey(30) & 0xFF == ord("q"):
                break
            continue

        is_new = fid != last_frame_id
        last_frame_id = fid

        if is_new:
            last_good_frame = frame
            now = time.time()
            cached_draws = []

            for face in app.get(frame):
                x1, y1, x2, y2 = face.bbox.astype(int)
                best_name, best_score = None, -1.0
                for name, emb in known.items():
                    s = cosine_sim(face.embedding, emb)
                    if s > best_score:
                        best_score, best_name = s, name

                if best_score >= args.threshold and best_name:
                    cached_draws.append(([x1, y1, x2, y2], best_name, best_score, (0, 200, 0)))
                    if now - cooldowns.get(best_name, 0) > COOLDOWN:
                        cooldowns[best_name] = now
                        subprocess.Popen(["notify-send", "--urgency=critical", "Face Alert", f"{best_name} detectat!"],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        print(f"[ALERT] {best_name} ({best_score:.3f})")
                else:
                    cached_draws.append(([x1, y1, x2, y2], "Unknown", best_score, (0, 0, 200)))

            fps_n += 1
            elapsed = now - fps_t
            if elapsed >= 1.0:
                fps = fps_n / elapsed
                fps_n = 0
                fps_t = now

        for (x1, y1, x2, y2), label, score, color in cached_draws:
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            txt = f"{label} {score:.2f}" if label != "Unknown" else label
            cv2.putText(frame, txt, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        cv2.putText(frame, f"{fps:.0f} FPS", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        cv2.imshow(WINDOW_NAME, frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cam.stop()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

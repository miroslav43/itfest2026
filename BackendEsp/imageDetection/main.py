"""
Entry point — FastAPI application + OpenCV camera loop.

On macOS, OpenCV's GUI (imshow/waitKey) MUST run on the main thread.
So we start uvicorn + haptic monitor in background threads and keep
the camera loop on the main thread.

Start with:
    conda activate itfest
    cd BackendEsp/imageDetection
    python main.py
"""
import threading
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from cam_client import stream_url
from config import API_HOST, API_PORT
from haptic import start_haptic_thread
from routers import cam, control, dashboard, esp


# ── Lifespan: start haptic thread when FastAPI boots ──────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    haptic_thread = start_haptic_thread()
    print(f"[MAIN] Haptic monitor started (tid={haptic_thread.ident})")
    yield
    print("[MAIN] Shutting down …")


# ── App definition ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="ESP32 Unified Orchestrator",
    version="2.0",
    description=(
        "Unified backend for ESP32 sensor/motor board + ESP32-CAM. "
        "Provides face recognition, haptic obstacle feedback, ElevenLabs TTS, "
        "OCR, YOLO detection, and GPT-4o-mini scene description."
    ),
    lifespan=lifespan,
)

app.include_router(dashboard.router)
app.include_router(control.router)
app.include_router(esp.router)
app.include_router(cam.router)


@app.get("/", include_in_schema=False)
def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/dashboard")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _run_uvicorn() -> None:
    """Run uvicorn in a daemon thread (not on the main thread)."""
    config = uvicorn.Config(
        app,
        host=API_HOST,
        port=API_PORT,
        log_level="info",
    )
    server = uvicorn.Server(config)
    server.run()


def _run_camera_loop(url: str) -> None:
    """Import and run the blocking OpenCV loop — must be on the main thread on macOS."""
    from face_loop import run_camera_loop
    run_camera_loop(url)


# ── Dev runner ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cam_url = stream_url()

    # Start FastAPI / uvicorn in a background thread
    api_thread = threading.Thread(target=_run_uvicorn, daemon=True, name="uvicorn")
    api_thread.start()
    print(f"[MAIN] Uvicorn starting on http://{API_HOST}:{API_PORT}  (docs: http://localhost:{API_PORT}/docs)")

    # Run the OpenCV camera loop on the MAIN thread (required by macOS)
    print(f"[MAIN] Camera loop starting for {cam_url}")
    try:
        _run_camera_loop(cam_url)
    except KeyboardInterrupt:
        print("\n[MAIN] Interrupted.")
    except Exception as exc:
        print(f"[MAIN] Camera loop error: {exc}")
        import traceback
        traceback.print_exc()

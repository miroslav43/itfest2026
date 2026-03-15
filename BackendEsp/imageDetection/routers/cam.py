"""
FastAPI router — proxy to the ESP32-CAM board.

Routes mirror exactly what codCamera.c exposes.
Everything runs on port 80 (single httpd instance).

  /stream         → MJPEG multipart (proxied via async streaming)
  /capture        → image/jpeg
  /flash/on|off|toggle → plain text ("FLASH ON" / "FLASH OFF")
  /flash/status   → plain text ("ON" / "OFF")
  /status         → plain text
  /json           → JSON {device, ip, wifi_connected, rssi, flash, free_heap, psram, uptime}
  /restart        → plain text
  /help           → plain text
"""
import asyncio

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, Response, StreamingResponse

import cam_client
from config import CAM_BASE_URL, STREAM_TIMEOUT

router = APIRouter(prefix="/cam", tags=["ESP32-CAM"])


def _run(fn, *args):
    return asyncio.get_event_loop().run_in_executor(None, fn, *args)


# ── Stream ────────────────────────────────────────────────────────────────────

@router.get("/stream", summary="Proxy MJPEG stream from ESP32-CAM")
async def cam_stream():
    """
    Proxies the live MJPEG stream.
    For best performance point your browser directly at http://{CAM_IP}/stream.
    """
    import httpx as _httpx

    async def _gen():
        async with _httpx.AsyncClient() as client:
            async with client.stream(
                "GET", f"{CAM_BASE_URL}/stream", timeout=STREAM_TIMEOUT
            ) as resp:
                async for chunk in resp.aiter_bytes(4096):
                    yield chunk

    return StreamingResponse(
        _gen(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Capture ───────────────────────────────────────────────────────────────────

@router.get("/capture", summary="Single JPEG frame")
async def cam_capture():
    jpeg = await _run(cam_client.capture_jpeg)
    if not jpeg:
        return Response(content=b"", status_code=503)
    return Response(content=jpeg, media_type="image/jpeg")


# ── Flash LED ─────────────────────────────────────────────────────────────────

@router.get("/flash/on", response_class=PlainTextResponse,
            summary="Turn flash ON → returns 'FLASH ON'")
async def flash_on():
    return await _run(cam_client.flash_on)


@router.get("/flash/off", response_class=PlainTextResponse,
            summary="Turn flash OFF → returns 'FLASH OFF'")
async def flash_off():
    return await _run(cam_client.flash_off)


@router.get("/flash/toggle", response_class=PlainTextResponse,
            summary="Toggle flash → returns 'FLASH ON' or 'FLASH OFF'")
async def flash_toggle():
    return await _run(cam_client.flash_toggle)


@router.get("/flash/status", response_class=PlainTextResponse,
            summary="Flash state → returns 'ON' or 'OFF'")
async def flash_status():
    return await _run(cam_client.flash_status)


# ── Status / info ─────────────────────────────────────────────────────────────

@router.get("/status", response_class=PlainTextResponse)
async def cam_status():
    """Plain text: IP, WiFi, RSSI, Flash state, heap, PSRAM, uptime."""
    return await _run(cam_client.get_status)


@router.get("/json", summary="JSON status")
async def cam_json():
    """{device, ip, wifi_connected, rssi, flash, free_heap, psram, uptime}"""
    return await _run(cam_client.get_json)


# ── System ────────────────────────────────────────────────────────────────────

@router.get("/restart", response_class=PlainTextResponse)
async def cam_restart():
    return await _run(cam_client.restart)


@router.get("/help", response_class=PlainTextResponse)
async def cam_help():
    return await _run(cam_client.help_text)

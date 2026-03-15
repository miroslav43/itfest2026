"""
HTTP client wrapper for the ESP32-CAM board.

All paths mirror exactly what codCamera.c registers in startCameraServer().
Everything runs on port 80 (single httpd instance).

Response types:
  /json           → JSON  {device, ip, wifi_connected, rssi, flash, free_heap, psram, uptime}
  /capture        → image/jpeg bytes
  /stream         → multipart/x-mixed-replace  (consumed by ThreadedCamera / browser)
  /flash/on|off|toggle|status → plain text ("FLASH ON" / "FLASH OFF" / "ON" / "OFF")
  /status         → plain text
  /restart        → plain text then reboot
  /help           → plain text
"""
import httpx

from config import CAM_BASE_URL, CAM_TIMEOUT, STREAM_TIMEOUT


def _get_json(path: str) -> dict:
    try:
        r = httpx.get(f"{CAM_BASE_URL}{path}", timeout=CAM_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print(f"[CAM] GET {path} failed: {exc}")
        return {}


def _get_text(path: str) -> str:
    try:
        r = httpx.get(f"{CAM_BASE_URL}{path}", timeout=CAM_TIMEOUT)
        r.raise_for_status()
        return r.text
    except Exception as exc:
        print(f"[CAM] GET {path} failed: {exc}")
        return ""


def _get_bytes(path: str) -> bytes:
    try:
        r = httpx.get(f"{CAM_BASE_URL}{path}", timeout=CAM_TIMEOUT)
        r.raise_for_status()
        return r.content
    except Exception as exc:
        print(f"[CAM] GET {path} failed: {exc}")
        return b""


# ── Stream / capture ──────────────────────────────────────────────────────────

def stream_url() -> str:
    """Full MJPEG stream URL — port 80, same server as all other routes."""
    return f"{CAM_BASE_URL}/stream"


def capture_jpeg() -> bytes:
    """Single JPEG frame. Returns empty bytes on error."""
    return _get_bytes("/capture")


# ── Flash LED ─────────────────────────────────────────────────────────────────

def flash_on() -> str:
    """Returns 'FLASH ON'."""
    return _get_text("/flash/on")


def flash_off() -> str:
    """Returns 'FLASH OFF'."""
    return _get_text("/flash/off")


def flash_toggle() -> str:
    """Returns 'FLASH ON' or 'FLASH OFF'."""
    return _get_text("/flash/toggle")


def flash_status() -> str:
    """Returns 'ON' or 'OFF'."""
    return _get_text("/flash/status")


# ── Status / info ─────────────────────────────────────────────────────────────

def get_status() -> str:
    """
    Plain text:
      ESP32-CAM STATUS
      IP: ...  WiFi: ...  RSSI: ...  Flash: ...  Free heap: ...  Uptime: ...
    """
    return _get_text("/status")


def get_json() -> dict:
    """
    JSON: {device, ip, wifi_connected, rssi, flash, free_heap, psram, uptime}
    flash value is the string 'ON' or 'OFF'.
    """
    return _get_json("/json")


# ── System ────────────────────────────────────────────────────────────────────

def restart() -> str:
    return _get_text("/restart")


def help_text() -> str:
    return _get_text("/help")

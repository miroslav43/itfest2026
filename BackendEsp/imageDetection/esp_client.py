"""
HTTP client wrapper for the ESP32 sensor/motor board.

All paths mirror exactly what codEsp.c registers in setup().
Response types noted per handler:
  - JSON   : /json, /sensors, /distance
  - text   : /status, /distance1-3, /light, /air, /help, /bt/status
  - 303    : motor routes (/m*/on|off|toggle, /all/*, /bt/start, /bt/stop)
"""
import httpx

from config import ESP_BASE_URL, ESP_TIMEOUT


def _get_json(path: str) -> dict:
    """GET and parse JSON. Returns {} on any error."""
    try:
        r = httpx.get(f"{ESP_BASE_URL}{path}", timeout=ESP_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print(f"[ESP] GET {path} failed: {exc}")
        return {}


def _get_text(path: str) -> str:
    """GET and return plain text. Returns '' on any error."""
    try:
        # follow_redirects=False: motor routes do 303 → home HTML, we only want the ack
        r = httpx.get(
            f"{ESP_BASE_URL}{path}",
            timeout=ESP_TIMEOUT,
            follow_redirects=False,
        )
        # 303 is a success for command routes; return the Location or a status string
        if r.status_code == 303:
            return "OK"
        r.raise_for_status()
        return r.text
    except Exception as exc:
        print(f"[ESP] GET {path} failed: {exc}")
        return ""


# ── Full data ─────────────────────────────────────────────────────────────────

def get_all() -> dict:
    """
    /json → {wifi, bluetooth, mosfets, sensors}
    sensors → {dht11, mq135, aht20, bmp280, distance, light}
    mosfets → {m1, m2, m3, m4}  (values: "ON" / "OFF")
    """
    return _get_json("/json")


def get_sensors() -> dict:
    """
    /sensors → {dht11, mq135, aht20, bmp280, distance, light}
    distance → {sensor1_cm, sensor2_cm, sensor3_cm}
    """
    return _get_json("/sensors")


# ── Distance ──────────────────────────────────────────────────────────────────

def get_distance() -> dict:
    """
    /distance → {"sensor1_cm": float|null, "sensor2_cm": float|null, "sensor3_cm": float|null}
    Mapping: sensor1=front, sensor2=left, sensor3=right
    """
    return _get_json("/distance")


def get_distance1() -> str:
    """Plain text: 'Distance 1: X.X cm'"""
    return _get_text("/distance1")


def get_distance2() -> str:
    return _get_text("/distance2")


def get_distance3() -> str:
    return _get_text("/distance3")


# ── Other sensors ─────────────────────────────────────────────────────────────

def get_light() -> str:
    """Plain text: raw, percent, status."""
    return _get_text("/light")


def get_air() -> str:
    """Plain text: raw MQ135 + status string."""
    return _get_text("/air")


def get_status() -> str:
    """Plain text overview: WiFi, BT, mosfet states."""
    return _get_text("/status")


# ── MOSFET / haptic motor control  (all return 303 → "OK") ───────────────────

def motor_on(n: int) -> str:
    return _get_text(f"/m{n}/on")


def motor_off(n: int) -> str:
    return _get_text(f"/m{n}/off")


def motor_toggle(n: int) -> str:
    return _get_text(f"/m{n}/toggle")


def all_on() -> str:
    return _get_text("/all/on")


def all_off() -> str:
    return _get_text("/all/off")


def all_toggle() -> str:
    return _get_text("/all/toggle")


# ── Bluetooth ─────────────────────────────────────────────────────────────────

def bt_start() -> str:
    """Starts BT A2DP sink; ESP redirects to /."""
    return _get_text("/bt/start")


def bt_stop() -> str:
    """Stops BT A2DP sink; ESP redirects to /."""
    return _get_text("/bt/stop")


def bt_status() -> str:
    """Plain text: started, connection state, audio state."""
    return _get_text("/bt/status")


# ── System ────────────────────────────────────────────────────────────────────

def restart() -> str:
    return _get_text("/restart")


def help_text() -> str:
    return _get_text("/help")

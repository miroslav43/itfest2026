"""
Haptic feedback loop.

Polls the ESP32 /distance endpoint and drives the 4 haptic motors:
  M1 (front)  ← front sensor
  M2 (left)   ← left sensor
  M3 (right)  ← right sensor
  M4 (all)    ← all three sensors simultaneously inside critical range

Runs as a daemon thread started from main.py lifespan.
"""
import time
import threading
from typing import Optional

import esp_client
from config import (
    DISTANCE_POLL_INTERVAL,
    MOTOR_MAP,
    OBSTACLE_THRESHOLD_CM,
    CRITICAL_THRESHOLD_CM,
)
from state import app_state


# Track which motors are currently ON to avoid redundant HTTP calls
_motor_active: dict[str, bool] = {"front": False, "left": False, "right": False, "all": False}
_motor_lock = threading.Lock()


def _set_motor(direction: str, active: bool) -> None:
    motor_num = MOTOR_MAP[direction]
    with _motor_lock:
        if _motor_active[direction] == active:
            return   # already in desired state
        _motor_active[direction] = active

    if active:
        esp_client.motor_on(motor_num)
    else:
        esp_client.motor_off(motor_num)


def _process(distances: dict[str, Optional[float]]) -> None:
    """Evaluate each distance and fire/release the corresponding motor."""
    threshold = app_state.obstacle_threshold_cm
    critical = CRITICAL_THRESHOLD_CM

    all_critical = True
    for direction in ("front", "left", "right"):
        dist = distances.get(direction)
        if dist is None:
            _set_motor(direction, False)
            all_critical = False
            continue

        close = dist < threshold
        _set_motor(direction, close)
        if dist >= critical:
            all_critical = False

    _set_motor("all", all_critical)


def distance_monitor_loop() -> None:
    """Main loop — runs forever until the process exits."""
    print("[HAPTIC] Distance monitor started.")
    while True:
        if app_state.haptic_enabled:
            data = esp_client.get_distance()
            if data:
                # ESP returns sensor1_cm/sensor2_cm/sensor3_cm
                # Mapping: sensor1=front, sensor2=left, sensor3=right
                distances: dict[str, Optional[float]] = {
                    "front": data.get("sensor1_cm"),
                    "left":  data.get("sensor2_cm"),
                    "right": data.get("sensor3_cm"),
                }
                app_state.set_distances(distances)
                _process(distances)

        time.sleep(DISTANCE_POLL_INTERVAL)


def start_haptic_thread() -> threading.Thread:
    t = threading.Thread(target=distance_monitor_loop, daemon=True, name="haptic-monitor")
    t.start()
    return t

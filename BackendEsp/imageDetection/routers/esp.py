"""
FastAPI router — proxy to the ESP32 sensor/motor board.

Routes mirror exactly what codEsp.c exposes.
Response content-types are preserved faithfully:
  - JSON  : /json, /sensors, /distance
  - text  : /status, /light, /air, /help, /bt/status, /distance1-3
  - 303   : motor/BT command routes (we return {"ok": true} instead of following the redirect)
"""
import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

import esp_client

router = APIRouter(prefix="/esp", tags=["ESP32"])


def _run(fn, *args):
    return asyncio.get_event_loop().run_in_executor(None, fn, *args)


# ── Full data ─────────────────────────────────────────────────────────────────

@router.get("/json", summary="All data (sensors + mosfets + BT + WiFi)")
async def esp_json():
    """
    Returns the full nested JSON from the ESP32:
    {wifi, bluetooth, mosfets, sensors{dht11, mq135, aht20, bmp280, distance, light}}
    """
    return await _run(esp_client.get_all)


@router.get("/sensors", summary="Sensor readings only")
async def esp_sensors():
    """
    {dht11, mq135, aht20, bmp280, distance{sensor1_cm, sensor2_cm, sensor3_cm}, light}
    """
    return await _run(esp_client.get_sensors)


# ── Distance ──────────────────────────────────────────────────────────────────

@router.get("/distance", summary="All 3 distance sensors")
async def esp_distance():
    """{"sensor1_cm": float|null, "sensor2_cm": float|null, "sensor3_cm": float|null}"""
    return await _run(esp_client.get_distance)


@router.get("/distance1", response_class=PlainTextResponse,
            summary="Sensor 1 (front) — plain text")
async def esp_distance1():
    return await _run(esp_client.get_distance1)


@router.get("/distance2", response_class=PlainTextResponse,
            summary="Sensor 2 (left) — plain text")
async def esp_distance2():
    return await _run(esp_client.get_distance2)


@router.get("/distance3", response_class=PlainTextResponse,
            summary="Sensor 3 (right) — plain text")
async def esp_distance3():
    return await _run(esp_client.get_distance3)


# ── Other sensors ─────────────────────────────────────────────────────────────

@router.get("/light", response_class=PlainTextResponse)
async def esp_light():
    return await _run(esp_client.get_light)


@router.get("/air", response_class=PlainTextResponse)
async def esp_air():
    return await _run(esp_client.get_air)


@router.get("/status", response_class=PlainTextResponse)
async def esp_status():
    return await _run(esp_client.get_status)


# ── MOSFET / haptic motor control ─────────────────────────────────────────────
# ESP responds with 303 redirect; we follow it silently and return {"ok": true}

@router.get("/m{n}/on")
async def motor_on(n: int):
    if n not in range(1, 5):
        raise HTTPException(400, "Motor number must be 1-4")
    await _run(esp_client.motor_on, n)
    return {"ok": True, "motor": n, "state": "on"}


@router.get("/m{n}/off")
async def motor_off(n: int):
    if n not in range(1, 5):
        raise HTTPException(400, "Motor number must be 1-4")
    await _run(esp_client.motor_off, n)
    return {"ok": True, "motor": n, "state": "off"}


@router.get("/m{n}/toggle")
async def motor_toggle(n: int):
    if n not in range(1, 5):
        raise HTTPException(400, "Motor number must be 1-4")
    await _run(esp_client.motor_toggle, n)
    return {"ok": True, "motor": n, "state": "toggled"}


@router.get("/all/on")
async def all_on():
    await _run(esp_client.all_on)
    return {"ok": True, "state": "all_on"}


@router.get("/all/off")
async def all_off():
    await _run(esp_client.all_off)
    return {"ok": True, "state": "all_off"}


@router.get("/all/toggle")
async def all_toggle():
    await _run(esp_client.all_toggle)
    return {"ok": True, "state": "all_toggled"}


# ── Bluetooth ─────────────────────────────────────────────────────────────────

@router.get("/bt/start")
async def bt_start():
    await _run(esp_client.bt_start)
    return {"ok": True, "bt": "started"}


@router.get("/bt/stop")
async def bt_stop():
    await _run(esp_client.bt_stop)
    return {"ok": True, "bt": "stopped"}


@router.get("/bt/status", response_class=PlainTextResponse)
async def bt_status():
    return await _run(esp_client.bt_status)


# ── System ────────────────────────────────────────────────────────────────────

@router.get("/restart", response_class=PlainTextResponse)
async def esp_restart():
    return await _run(esp_client.restart)


@router.get("/help", response_class=PlainTextResponse)
async def esp_help():
    return await _run(esp_client.help_text)

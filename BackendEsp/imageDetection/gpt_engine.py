"""
GPT-4o-mini integrations:
  - describe_scene()    : vision API, sends a frame and gets a Romanian description
  - summarize_ocr_text(): condenses collected OCR fragments via chat API
"""
import base64
import textwrap

import certifi
import cv2
import httpx
import numpy as np

from config import GPT_MODEL, GPT_SCENE_DISPLAY_SEC, OPENAI_API_KEY
from state import app_state

_openai_http = httpx.Client(verify=certifi.where())


def _get_client():
    from openai import OpenAI
    return OpenAI(api_key=OPENAI_API_KEY, http_client=_openai_http)


def describe_scene(frame: np.ndarray) -> None:
    """
    Encode frame as JPEG base64 and send to GPT-4o-mini vision.
    Updates app_state when done. Designed to run in a daemon thread.
    """
    try:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        b64 = base64.b64encode(buf).decode("utf-8")
        client = _get_client()
        resp = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Descrie pe scurt ce vezi în această imagine dintr-un stream video live. "
                            "2-3 propoziții, în română."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64}",
                            "detail": "low",
                        },
                    },
                ],
            }],
            max_tokens=200,
        )
        desc = resp.choices[0].message.content or ""
        app_state.finish_describe(desc, GPT_SCENE_DISPLAY_SEC)
        print(f"[GPT SCENE] {desc}")
    except Exception as exc:
        print(f"[GPT SCENE] Error: {exc}")
        app_state.finish_describe("", GPT_SCENE_DISPLAY_SEC)


def summarize_ocr_text(collected: list[str]) -> None:
    """
    Condense OCR fragments and store result in app_state.
    Designed to run in a daemon thread.
    """
    combined = " ".join(set(collected)).strip()
    if not combined:
        return
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Reformulează și sumarizează următorul text detectat prin OCR "
                        "dintr-un stream video. Fii concis, 1-2 propoziții."
                    ),
                },
                {"role": "user", "content": combined},
            ],
            max_tokens=150,
        )
        summary = resp.choices[0].message.content or ""
        app_state.finish_describe(f"[OCR] {summary}", GPT_SCENE_DISPLAY_SEC)
        print(f"[GPT OCR] {summary}")
    except Exception as exc:
        print(f"[GPT OCR] Error: {exc}")


def draw_gpt_overlay(frame: np.ndarray) -> None:
    """Draw the semi-transparent GPT description box onto the frame (in-place)."""
    import time
    if not app_state.gpt_description or time.time() > app_state.gpt_display_until:
        return
    h, w = frame.shape[:2]
    lines = textwrap.wrap(app_state.gpt_description, width=60)
    box_h = 30 + len(lines) * 26
    y_start = h - 60 - box_h
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, y_start), (w - 10, y_start + box_h), (30, 30, 30), -1)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
    cv2.putText(frame, "GPT-4o-mini:", (20, y_start + 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2)
    for i, line in enumerate(lines):
        cv2.putText(frame, line, (20, y_start + 48 + i * 26),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

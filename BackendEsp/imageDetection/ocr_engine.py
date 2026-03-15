"""
EasyOCR engine — lazy-loaded on first use to keep startup fast.
"""
import threading
from typing import Optional

import cv2
import numpy as np

from config import OCR_CONF_THRESHOLD

_reader = None
_init_lock = threading.Lock()


def get_reader():
    global _reader
    if _reader is None:
        with _init_lock:
            if _reader is None:
                import easyocr
                print("[OCR] Loading EasyOCR …")
                _reader = easyocr.Reader(["en", "ro"], gpu=True)
                print("[OCR] Ready.")
    return _reader


def process_ocr(frame: np.ndarray) -> list[tuple[list[int], str]]:
    """
    Run OCR on a horizontally-flipped copy (mirror correction) and
    return a list of (bbox [x1,y1,x2,y2], text) for results above threshold.
    """
    reader = get_reader()
    flipped = cv2.flip(frame, 1)
    results = reader.readtext(flipped)
    h, w = frame.shape[:2]
    output: list[tuple[list[int], str]] = []

    for bbox_pts, text, conf in results:
        if conf < OCR_CONF_THRESHOLD:
            continue
        pts = np.array(bbox_pts, dtype=np.int32)
        x1, y1 = pts.min(axis=0)
        x2, y2 = pts.max(axis=0)
        # Mirror bbox back to original frame space
        output.append(([w - x2, y1, w - x1, y2], text))

    return output


def draw_ocr(frame: np.ndarray, texts: list[tuple[list[int], str]]) -> None:
    for (x1, y1, x2, y2), text in texts:
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 200, 0), 2)
        cv2.putText(frame, text, (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 1)

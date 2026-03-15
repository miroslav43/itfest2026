"""
YOLOv8 object detection engine — lazy-loaded on first use.
"""
import threading

import cv2
import numpy as np

from config import YOLO_ALERT_CLASSES, YOLO_CONF, YOLO_MODEL

_model = None
_init_lock = threading.Lock()


def get_model():
    global _model
    if _model is None:
        with _init_lock:
            if _model is None:
                from ultralytics import YOLO
                print(f"[YOLO] Loading {YOLO_MODEL} …")
                _model = YOLO(YOLO_MODEL)
                print("[YOLO] Ready.")
    return _model


def process_yolo(frame: np.ndarray) -> list[dict]:
    """
    Run inference and return a list of detection dicts:
      {"class": str, "conf": float, "bbox": [x1, y1, x2, y2]}
    """
    model = get_model()
    results = model(frame, verbose=False, conf=YOLO_CONF)[0]
    detections: list[dict] = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = results.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
        detections.append({
            "class": cls_name,
            "conf": conf,
            "bbox": [int(x1), int(y1), int(x2), int(y2)],
            "alert": cls_name in YOLO_ALERT_CLASSES,
        })
    return detections


def draw_yolo(frame: np.ndarray, detections: list[dict]) -> None:
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        color = (255, 100, 50) if det["alert"] else (200, 200, 50)
        label = f"{det['class']} {det['conf']:.0%}"
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, label, (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

"""
ThreadedCamera — reads frames from an MJPEG stream in a background thread
so the main processing loop never blocks waiting for the network.
"""
import threading
import time
from typing import Optional

import cv2
import numpy as np


class ThreadedCamera:
    """
    Continuously pulls frames from a URL in a daemon thread.
    Call read() from the main thread to get the latest frame.
    """

    def __init__(self, url: str, buffer_size: int = 1) -> None:
        self.url = url
        self.buffer_size = buffer_size

        self.frame: Optional[np.ndarray] = None
        self.frame_id: int = 0
        self.running: bool = True

        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self) -> None:
        cap = self._open()
        while self.running:
            ret, frame = cap.read()
            if ret:
                with self._lock:
                    self.frame = frame
                    self.frame_id += 1
            else:
                cap.release()
                time.sleep(0.3)
                cap = self._open()
        cap.release()

    def _open(self) -> cv2.VideoCapture:
        cap = cv2.VideoCapture(self.url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, self.buffer_size)
        return cap

    def read(self) -> tuple[bool, Optional[np.ndarray], int]:
        """Return (success, frame_copy, frame_id)."""
        with self._lock:
            if self.frame is None:
                return False, None, self.frame_id
            return True, self.frame.copy(), self.frame_id

    def stop(self) -> None:
        self.running = False

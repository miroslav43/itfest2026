"""
Face recognition engine built on InsightFace.

Responsibilities:
- Load the buffalo_l model once.
- Index known faces from the known_faces/ directory.
- Provide cosine-similarity matching.
"""
import sys
import types

# Suppress the missing Cython extension that InsightFace ships
sys.modules.setdefault(
    "insightface.thirdparty.face3d.mesh.cython.mesh_core_cython",
    types.ModuleType("mesh_core_cython"),
)

import warnings
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from config import (
    FACE_DET_SIZE,
    KNOWN_FACES_DIR,
    SUPPORTED_IMG_EXT,
)

warnings.filterwarnings("ignore", message=".*estimate.*deprecated.*", category=FutureWarning)


def build_face_app() -> FaceAnalysis:
    """Initialise InsightFace with detection + recognition + age/gender."""
    print("[FACE] Loading buffalo_l model …")
    import platform
    if platform.system() == "Darwin":
        providers = ["CoreMLExecutionProvider", "CPUExecutionProvider"]
    else:
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition", "genderage"],
        providers=providers,
    )
    app.prepare(ctx_id=0, det_size=FACE_DET_SIZE)
    print("[FACE] Model ready.")
    return app


def load_known_faces(face_app: FaceAnalysis) -> dict[str, np.ndarray]:
    """
    Read every image from known_faces/, extract the first detected face embedding,
    and return a name → embedding mapping.
    """
    known: dict[str, np.ndarray] = {}
    if not KNOWN_FACES_DIR.exists():
        print(f"[FACE] known_faces/ not found at {KNOWN_FACES_DIR}")
        return known

    for img_path in sorted(KNOWN_FACES_DIR.iterdir()):
        if img_path.suffix.lower() not in SUPPORTED_IMG_EXT:
            continue
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"[FACE] Cannot read: {img_path.name}")
            continue
        faces = face_app.get(img)
        if not faces:
            print(f"[FACE] No face in: {img_path.name}")
            continue
        if len(faces) > 1:
            print(f"[FACE] Multiple faces in {img_path.name}, using first.")
        name = img_path.stem.replace("_", " ")
        known[name] = faces[0].embedding
        print(f"[FACE] Loaded: {name}")

    print(f"[FACE] {len(known)} known face(s) indexed.\n")
    return known


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def find_best_match(
    embedding: np.ndarray,
    known_faces: dict[str, np.ndarray],
    threshold: float,
) -> tuple[Optional[str], float]:
    """Return (best_name, best_score). name is None when below threshold."""
    best_name, best_score = None, -1.0
    for name, known_emb in known_faces.items():
        score = cosine_similarity(embedding, known_emb)
        if score > best_score:
            best_score = score
            best_name = name
    if best_score >= threshold:
        return best_name, best_score
    return None, best_score


def face_label(face, name: Optional[str], score: float) -> str:
    """Build the overlay label string including gender/age if available."""
    age = int(face.age) if hasattr(face, "age") and face.age is not None else None
    gender = (
        "M" if hasattr(face, "gender") and face.gender == 1
        else "F" if hasattr(face, "gender")
        else None
    )
    extra = f" {gender}/{age}" if age is not None and gender is not None else ""
    if name:
        return f"{name} {score:.2f}{extra}"
    return f"Unknown{extra}"

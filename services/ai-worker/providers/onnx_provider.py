import asyncio
import time
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image
import onnxruntime as ort

from .base import AIProvider, DetectionResult, CrackType, Severity

# ── Stage-1 labels ───────────────────────────────────────────────────────────
STAGE1_CLASSES = ["Normal Road", "Damaged Road", "Other/Obstacle"]

# ── Stage-2 labels → crack type + fixed severity (per manual) ────────────────
MOBILENET_CLASSES = [
    "Alligator Crack",
    "Deep Foundation Consolidation",
    "Pot Hole",
    "Reflection Crack",
]

CLASS_TO_CRACK_TYPE: dict[str, CrackType] = {
    "Alligator Crack":               CrackType.ALLIGATOR_CRACK,
    "Deep Foundation Consolidation": CrackType.DEEP_FOUNDATION_CONSOLIDATION,
    "Pot Hole":                      CrackType.POT_HOLE,
    "Reflection Crack":              CrackType.REFLECTION_CRACK,
}

# Severity fixed by crack type as specified in model_usage_manual.md
CLASS_TO_SEVERITY: dict[str, Severity] = {
    "Alligator Crack":               Severity.HIGH,
    "Deep Foundation Consolidation": Severity.CRITICAL,
    "Pot Hole":                      Severity.CRITICAL,
    "Reflection Crack":              Severity.MEDIUM,
}

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _preprocess(image_path: str) -> np.ndarray:
    img = Image.open(image_path).convert("RGB").resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    arr = np.transpose(arr, (2, 0, 1))   # HWC → CHW
    return np.expand_dims(arr, axis=0)   # add batch dim → (1, C, H, W)


def _softmax(logits: np.ndarray) -> np.ndarray:
    e = np.exp(logits - np.max(logits))
    return e / e.sum(axis=1, keepdims=True)


def _run_session(session: ort.InferenceSession, tensor: np.ndarray) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    logits = session.run(None, {input_name: tensor})[0]
    return _softmax(logits)[0]


class OnnxProvider(AIProvider):
    """
    Two-stage ONNX inference pipeline:
      Stage 1 — EfficientNet-B0: Normal / Damaged / Other
      Stage 2 — MobileNetV2:    4 crack types
    """

    MODEL_NAME    = "onnx-two-stage-v1"
    MODEL_VERSION = "1.0.0"

    def __init__(
        self,
        stage1_path: str = "/models/stage1_efficientnet_b0.onnx",
        stage2_path: str = "/models/mobilenet_v2_model.onnx",
    ):
        self._stage1_path = stage1_path
        self._stage2_path = stage2_path
        self._stage1: Optional[ort.InferenceSession] = None
        self._stage2: Optional[ort.InferenceSession] = None

    def _load_sessions(self) -> None:
        if self._stage1 is None:
            self._stage1 = ort.InferenceSession(
                self._stage1_path,
                providers=["CPUExecutionProvider"],
            )
        if self._stage2 is None:
            self._stage2 = ort.InferenceSession(
                self._stage2_path,
                providers=["CPUExecutionProvider"],
            )

    def _infer(self, image_path: str) -> DetectionResult:
        self._load_sessions()
        start = time.time()

        tensor = _preprocess(image_path)

        # ── Stage 1: filter ──────────────────────────────────────────────────
        stage1_probs = _run_session(self._stage1, tensor)
        stage1_label = STAGE1_CLASSES[int(np.argmax(stage1_probs))]
        stage1_conf  = float(np.max(stage1_probs))

        if stage1_label != "Damaged Road":
            return DetectionResult(
                crack_type=CrackType.NONE,
                severity=Severity.LOW,
                confidence=stage1_conf,
                detections=[],
                model_name=self.MODEL_NAME,
                model_version=self.MODEL_VERSION,
                inference_ms=int((time.time() - start) * 1000),
            )

        # ── Stage 2: classify crack type ─────────────────────────────────────
        stage2_probs = _run_session(self._stage2, tensor)
        top_idx      = int(np.argmax(stage2_probs))
        class_label  = MOBILENET_CLASSES[top_idx]
        confidence   = float(stage2_probs[top_idx])

        return DetectionResult(
            crack_type=CLASS_TO_CRACK_TYPE[class_label],
            severity=CLASS_TO_SEVERITY[class_label],
            confidence=confidence,
            detections=[],
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            inference_ms=int((time.time() - start) * 1000),
        )

    async def detect(self, image_path: str) -> DetectionResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._infer, image_path)

    async def health_check(self) -> bool:
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._load_sessions)
            return True
        except Exception:
            return False

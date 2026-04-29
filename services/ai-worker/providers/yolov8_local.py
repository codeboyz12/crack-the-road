import asyncio
import time
from pathlib import Path
from .base import AIProvider, DetectionResult, BoundingBox, CrackType, Severity

YOLO_CLASS_MAP = {
    0: CrackType.LONGITUDINAL,
    1: CrackType.TRANSVERSE,
    2: CrackType.ALLIGATOR,
    3: CrackType.POTHOLE,
    4: CrackType.EDGE_CRACK,
    5: CrackType.BLOCK_CRACK,
    6: CrackType.DEPRESSION,
}


class YOLOv8LocalProvider(AIProvider):
    def __init__(self, model_path: str, device: str = "cuda"):
        self.model_path = model_path
        self.device     = device
        self._model     = None

    async def _load_model(self):
        if self._model is None:
            from ultralytics import YOLO
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(None, lambda: YOLO(self.model_path))

    async def detect(self, image_path: str) -> DetectionResult:
        await self._load_model()
        start = time.time()

        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None, lambda: self._model(image_path, conf=0.4, device=self.device)
        )

        inference_ms = int((time.time() - start) * 1000)
        detections = []

        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf   = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxyn[0].tolist()
                detections.append(BoundingBox(
                    x1=x1, y1=y1, x2=x2, y2=y2,
                    crack_type=YOLO_CLASS_MAP.get(cls_id, CrackType.NONE),
                    confidence=conf,
                ))

        if not detections:
            return DetectionResult(
                crack_type=CrackType.NONE, severity=Severity.LOW, confidence=0.0,
                detections=[], model_name="yolov8-crack",
                model_version=Path(self.model_path).stem,
                inference_ms=inference_ms,
            )

        best = max(detections, key=lambda d: d.confidence)
        return DetectionResult(
            crack_type=best.crack_type,
            severity=self.confidence_to_severity(best.confidence, best.crack_type),
            confidence=best.confidence,
            detections=detections,
            model_name="yolov8-crack",
            model_version=Path(self.model_path).stem,
            inference_ms=inference_ms,
        )

    async def health_check(self) -> bool:
        try:
            await self._load_model()
            return self._model is not None
        except Exception:
            return False

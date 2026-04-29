import asyncio
import random
import time
from .base import AIProvider, DetectionResult, BoundingBox, CrackType, Severity


class MockYOLOProvider(AIProvider):
    MODEL_NAME    = "mock-yolo-v1"
    MODEL_VERSION = "1.0.0-dev"

    async def detect(self, image_path: str) -> DetectionResult:
        await asyncio.sleep(random.uniform(0.05, 0.3))
        start = time.time()

        has_crack = random.random() > 0.15

        if not has_crack:
            return DetectionResult(
                crack_type=CrackType.NONE,
                severity=Severity.LOW,
                confidence=random.uniform(0.7, 0.95),
                detections=[],
                model_name=self.MODEL_NAME,
                model_version=self.MODEL_VERSION,
                inference_ms=int((time.time() - start) * 1000),
            )

        crack_type = random.choice([
            CrackType.LONGITUDINAL, CrackType.TRANSVERSE,
            CrackType.ALLIGATOR, CrackType.POTHOLE,
        ])
        confidence = random.uniform(0.55, 0.97)

        detections = [
            BoundingBox(
                x1=random.uniform(0, 0.5),
                y1=random.uniform(0, 0.5),
                x2=random.uniform(0.5, 1.0),
                y2=random.uniform(0.5, 1.0),
                crack_type=crack_type,
                confidence=random.uniform(max(0, confidence - 0.1), min(confidence + 0.05, 0.99)),
            )
            for _ in range(random.randint(1, 4))
        ]

        return DetectionResult(
            crack_type=crack_type,
            severity=self.confidence_to_severity(confidence, crack_type),
            confidence=confidence,
            detections=detections,
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            inference_ms=int((time.time() - start) * 1000),
        )

    async def health_check(self) -> bool:
        return True

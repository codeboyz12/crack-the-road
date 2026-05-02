from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class CrackType(str, Enum):
    ALLIGATOR_CRACK               = "alligator_crack"
    DEEP_FOUNDATION_CONSOLIDATION = "deep_foundation_consolidation"
    POT_HOLE                      = "pot_hole"
    REFLECTION_CRACK              = "reflection_crack"
    NONE                          = "none"


class Severity(str, Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


@dataclass
class BoundingBox:
    x1: float
    y1: float
    x2: float
    y2: float
    crack_type: CrackType
    confidence: float


@dataclass
class DetectionResult:
    crack_type:    CrackType
    severity:      Severity
    confidence:    float
    detections:    list[BoundingBox]
    model_name:    str
    model_version: str
    inference_ms:  int
    raw_output:    Optional[dict] = None


class AIProvider(ABC):
    @abstractmethod
    async def detect(self, image_path: str) -> DetectionResult: ...

    @abstractmethod
    async def health_check(self) -> bool: ...

    def confidence_to_severity(self, confidence: float, crack_type: CrackType) -> Severity:
        if crack_type == CrackType.NONE:
            return Severity.LOW
        # Fixed severity per manual — confidence only affects NONE case
        if crack_type in (CrackType.DEEP_FOUNDATION_CONSOLIDATION, CrackType.POT_HOLE):
            return Severity.CRITICAL
        if crack_type == CrackType.ALLIGATOR_CRACK:
            return Severity.HIGH
        if crack_type == CrackType.REFLECTION_CRACK:
            return Severity.MEDIUM
        return Severity.LOW

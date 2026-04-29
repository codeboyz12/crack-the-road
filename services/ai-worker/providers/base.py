from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class CrackType(str, Enum):
    LONGITUDINAL = "longitudinal"
    TRANSVERSE   = "transverse"
    ALLIGATOR    = "alligator"
    POTHOLE      = "pothole"
    EDGE_CRACK   = "edge_crack"
    BLOCK_CRACK  = "block_crack"
    DEPRESSION   = "depression"
    NONE         = "none"


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
        if confidence >= 0.85 or crack_type in (CrackType.ALLIGATOR, CrackType.POTHOLE):
            return Severity.CRITICAL
        if confidence >= 0.70:
            return Severity.HIGH
        if confidence >= 0.50:
            return Severity.MEDIUM
        return Severity.LOW

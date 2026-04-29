from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AIDetectionOut(BaseModel):
    crack_type: Optional[str]
    severity: Optional[str]
    confidence: float
    detections: Optional[list]
    model_name: Optional[str]
    processed_at: datetime

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    road_name: Optional[str] = None
    source: str = "web"


class ReportOut(BaseModel):
    id: uuid.UUID
    lat: float
    lng: float
    address: Optional[str]
    province: Optional[str]
    district: Optional[str]
    road_name: Optional[str]
    status: str
    source: str
    image_path: str
    reported_at: datetime
    reviewed_at: Optional[datetime]
    review_note: Optional[str]
    ai_detection: Optional[AIDetectionOut]

    class Config:
        from_attributes = True


class ReportListOut(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int


class ReviewAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    note: Optional[str] = None

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class BoundingBoxOut(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    crack_type: str
    confidence: float


class AlertZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    threshold: int = Field(5, ge=1)
    window_hours: int = Field(24, ge=1, le=720)
    severity: str = Field("medium", pattern="^(low|medium|high|critical)$")
    notify_channels: list[str] = Field(default_factory=lambda: ["line"])


class AlertZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    threshold: Optional[int] = Field(None, ge=1)
    window_hours: Optional[int] = Field(None, ge=1, le=720)
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    notify_channels: Optional[list[str]] = None
    is_active: Optional[bool] = None


class AlertZoneOut(BaseModel):
    id: str
    name: str
    threshold: int
    window_hours: int
    severity: str
    notify_channels: list[str]
    is_active: bool

    class Config:
        from_attributes = True

# 🛣️ Road Crack Monitoring System — claude.md

> ระบบตรวจสอบและติดตามรอยราวของถนนในประเทศไทย  
> พร้อม AI-assisted detection, Human-in-the-loop verification และ Docker-native deployment

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Road Crack Monitor System                       │
│                                                                       │
│  [Reporter App]  ──►  [API Gateway]  ──►  [AI Detection Service]    │
│  (Mobile/Web)           (FastAPI)          (YOLO / Mock YOLO)        │
│                              │                      │                │
│                         [PostgreSQL]         [Human Review UI]       │
│                         + PostGIS            (Admin Dashboard)       │
│                              │                      │                │
│                         [Redis Queue]    [Notification Service]      │
│                              │                                        │
│                      [Map Dashboard]                                  │
│                   (React + Leaflet.js)                                │
└─────────────────────────────────────────────────────────────────────┘
```

ระบบแบ่งออกเป็น **7 microservices** ทั้งหมดอยู่ใน Docker Compose และสามารถ scale ได้แยกอิสระ

---

## 2. Architecture Decision Records (ADR)

### ADR-001: AI Service Abstraction Layer
ออกแบบ `AIProvider` interface เพื่อรองรับการสลับ engine ในอนาคต:
- **ตอนนี้**: Mock YOLO (rule-based + random confidence สำหรับ dev/testing)
- **ระยะสั้น**: YOLOv8 ผ่าน Triton Inference Server
- **ระยะยาว**: Custom fine-tuned model หรือ cloud vision API

### ADR-002: Human-in-the-loop Mandatory
AI ทำหน้าที่ **pre-screening เท่านั้น** — ไม่มี auto-approve  
ทุก report ต้องผ่าน human reviewer ก่อน status = `verified`

### ADR-003: PostGIS สำหรับ Geospatial Queries
ใช้ PostgreSQL + PostGIS extension เพื่อ:
- Cluster reports ในรัศมีที่กำหนด
- Heat map query ตาม province / district
- Spatial index บน `geom` column

### ADR-004: Event-driven Notification
ใช้ Redis Pub/Sub สำหรับ real-time event:  
`report.created` → `report.ai_processed` → `report.verified` → `alert.threshold_exceeded`

---

## 3. Project Structure

```
road-crack-monitor/
├── claude.md                        ← this file
├── docker-compose.yml               ← orchestration (dev)
├── docker-compose.prod.yml          ← production overrides
├── .env.example
│
├── services/
│   ├── api/                         ← FastAPI backend
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── reports.py
│   │   │   ├── admin.py
│   │   │   ├── alerts.py
│   │   │   └── map.py
│   │   ├── models/
│   │   │   ├── report.py            ← SQLAlchemy ORM
│   │   │   ├── alert_zone.py
│   │   │   └── user.py
│   │   ├── schemas/
│   │   │   ├── report.py            ← Pydantic schemas
│   │   │   └── detection.py
│   │   ├── services/
│   │   │   ├── ai_service.py        ← AI abstraction layer
│   │   │   ├── notification.py
│   │   │   └── geo_service.py
│   │   └── core/
│   │       ├── config.py
│   │       ├── database.py
│   │       └── security.py
│   │
│   ├── ai-worker/                   ← AI Detection Worker (Celery)
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── worker.py
│   │   ├── providers/
│   │   │   ├── base.py              ← Abstract AIProvider
│   │   │   ├── mock_yolo.py         ← Development mock
│   │   │   ├── yolov8_local.py      ← Local YOLO model
│   │   │   └── triton.py            ← Triton Inference Server
│   │   └── tasks/
│   │       └── detect_crack.py
│   │
│   ├── frontend/                    ← React dashboard
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── MapDashboard.tsx  ← หน้าแผนที่หลัก
│   │   │   │   ├── ReportDetail.tsx
│   │   │   │   ├── AdminReview.tsx   ← Human review queue
│   │   │   │   └── AlertSettings.tsx
│   │   │   ├── components/
│   │   │   │   ├── CrackMap/
│   │   │   │   │   ├── index.tsx    ← Leaflet map + Thailand bounds
│   │   │   │   │   ├── HeatLayer.tsx
│   │   │   │   │   └── ReportMarker.tsx
│   │   │   │   ├── AIResultCard.tsx
│   │   │   │   └── AlertBanner.tsx
│   │   │   └── hooks/
│   │   │       ├── useReports.ts
│   │   │       └── useAlerts.ts
│   │   └── public/
│   │
│   └── notification/                ← Notification microservice
│       ├── Dockerfile
│       ├── main.py
│       └── channels/
│           ├── line_notify.py
│           ├── email.py
│           └── webhook.py
│
├── nginx/
│   ├── nginx.conf
│   └── ssl/
│
├── database/
│   ├── init.sql                     ← PostGIS setup + seed data
│   └── migrations/
│
└── scripts/
    ├── seed_demo_data.py            ← สร้าง demo reports ทั่วประเทศ
    └── healthcheck.sh
```

---

## 4. Docker Compose

```yaml
# docker-compose.yml
version: "3.9"

services:
  # ─── Database ────────────────────────────────────────────────────────
  postgres:
    image: postgis/postgis:15-3.3
    container_name: rcm-postgres
    environment:
      POSTGRES_DB: road_crack_db
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: rcm-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # ─── Backend API ─────────────────────────────────────────────────────
  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    container_name: rcm-api
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/road_crack_db
      REDIS_URL: redis://redis:6379/0
      AI_PROVIDER: ${AI_PROVIDER:-mock}        # mock | yolov8_local | triton
      AI_CONFIDENCE_THRESHOLD: ${AI_CONFIDENCE_THRESHOLD:-0.6}
    volumes:
      - uploads:/app/uploads
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  # ─── AI Worker ───────────────────────────────────────────────────────
  ai-worker:
    build:
      context: ./services/ai-worker
      dockerfile: Dockerfile
    container_name: rcm-ai-worker
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/road_crack_db
      REDIS_URL: redis://redis:6379/0
      AI_PROVIDER: ${AI_PROVIDER:-mock}
      MODEL_PATH: /models/crack_yolov8.pt   # mount actual model here
      TRITON_URL: ${TRITON_URL:-http://triton:8001}
    volumes:
      - uploads:/app/uploads
      - ./models:/models:ro                 # model weights (read-only)
    depends_on:
      - api
      - redis
    restart: unless-stopped
    # For GPU support (uncomment when using real YOLO):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - capabilities: [gpu]

  # ─── Frontend ────────────────────────────────────────────────────────
  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile
    container_name: rcm-frontend
    environment:
      VITE_API_URL: http://api:8000
      VITE_MAPBOX_TOKEN: ${MAPBOX_TOKEN:-}   # optional; Leaflet works without it
    ports:
      - "3000:3000"
    depends_on:
      - api

  # ─── Notification Service ────────────────────────────────────────────
  notification:
    build:
      context: ./services/notification
      dockerfile: Dockerfile
    container_name: rcm-notification
    env_file: .env
    environment:
      REDIS_URL: redis://redis:6379/0
      LINE_NOTIFY_TOKEN: ${LINE_NOTIFY_TOKEN:-}
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-587}
    depends_on:
      - redis
    restart: unless-stopped

  # ─── Nginx Reverse Proxy ─────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: rcm-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - frontend

  # ─── Optional: Triton Inference Server ──────────────────────────────
  # Uncomment when ready to deploy real YOLO model
  # triton:
  #   image: nvcr.io/nvidia/tritonserver:23.10-py3
  #   container_name: rcm-triton
  #   command: tritonserver --model-repository=/models
  #   volumes:
  #     - ./models/triton:/models
  #   ports:
  #     - "8001:8001"   # HTTP
  #     - "8002:8002"   # gRPC
  #   deploy:
  #     resources:
  #       reservations:
  #         devices:
  #           - capabilities: [gpu]

volumes:
  postgres_data:
  redis_data:
  uploads:
```

---

## 5. Database Schema (PostgreSQL + PostGIS)

```sql
-- database/init.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Reports ─────────────────────────────────────────────────────────────
CREATE TABLE reports (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Location
    lat             DECIMAL(10, 7)  NOT NULL,
    lng             DECIMAL(10, 7)  NOT NULL,
    geom            GEOGRAPHY(POINT, 4326)  -- PostGIS spatial column
                    GENERATED ALWAYS AS (
                        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                    ) STORED,
    address         TEXT,
    province        VARCHAR(100),
    district        VARCHAR(100),
    road_name       VARCHAR(255),
    
    -- Report metadata
    reported_by     UUID REFERENCES users(id),
    reported_at     TIMESTAMPTZ DEFAULT NOW(),
    source          VARCHAR(50) DEFAULT 'web',  -- web | mobile | iot | api
    
    -- Image
    image_path      TEXT NOT NULL,              -- /uploads/{uuid}.jpg
    image_hash      VARCHAR(64),                -- SHA-256 (ป้องกัน duplicate)
    
    -- Status workflow
    status          VARCHAR(30) DEFAULT 'pending'
                    CHECK (status IN (
                        'pending',              -- รอ AI ประมวลผล
                        'ai_processed',         -- AI ประมวลผลแล้ว รอ human
                        'under_review',         -- human กำลัง review
                        'verified',             -- human ยืนยันแล้ว
                        'rejected',             -- human ปฏิเสธ
                        'resolved'              -- แก้ไขแล้ว
                    )),

    -- Human review
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_geom  ON reports USING GIST(geom);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_province ON reports(province);
CREATE INDEX idx_reports_reported_at ON reports(reported_at DESC);

-- ── AI Detection Results ─────────────────────────────────────────────────
CREATE TABLE ai_detections (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    report_id       UUID REFERENCES reports(id) ON DELETE CASCADE,
    
    -- YOLO outputs
    crack_type      VARCHAR(50)     -- longitudinal | transverse | alligator | pothole | none
                    CHECK (crack_type IN (
                        'longitudinal',         -- รอยแตกตามยาว
                        'transverse',           -- รอยแตกขวาง
                        'alligator',            -- รอยแตกแบบตาข่าย (ผิวหนังจระเข้)
                        'pothole',              -- หลุมบ่อ
                        'edge_crack',           -- รอยแตกที่ขอบถนน
                        'block_crack',          -- รอยแตกเป็นบล็อก
                        'depression',           -- ผิวถนนยุบตัว
                        'none'                  -- ไม่พบความเสียหาย
                    )),
    severity        VARCHAR(20)                 -- low | medium | high | critical
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence      DECIMAL(5, 4)   NOT NULL,   -- 0.0000 – 1.0000
    
    -- Bounding boxes (array of detections per image)
    detections      JSONB,
    -- Format: [{"bbox": [x1,y1,x2,y2], "class": "alligator", "conf": 0.87}, ...]
    
    -- Model info
    model_name      VARCHAR(100),               -- yolov8n-crack | mock-v1
    model_version   VARCHAR(50),
    inference_ms    INTEGER,                    -- processing time
    
    processed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_detections_report ON ai_detections(report_id);

-- ── Alert Zones ──────────────────────────────────────────────────────────
CREATE TABLE alert_zones (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    geom            GEOGRAPHY(POLYGON, 4326),
    threshold       INTEGER DEFAULT 5,          -- จำนวน reports ที่ trigger alert
    window_hours    INTEGER DEFAULT 24,         -- ช่วงเวลา (ชั่วโมง)
    severity        VARCHAR(20) DEFAULT 'medium',
    notify_channels JSONB DEFAULT '["line"]',   -- ["line","email","webhook"]
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Alert Events ─────────────────────────────────────────────────────────
CREATE TABLE alert_events (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    zone_id         UUID REFERENCES alert_zones(id),
    province        VARCHAR(100),
    report_count    INTEGER,
    triggered_at    TIMESTAMPTZ DEFAULT NOW(),
    notified        BOOLEAN DEFAULT FALSE
);

-- ── Users ────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT,
    role            VARCHAR(20) DEFAULT 'reporter'
                    CHECK (role IN ('reporter', 'reviewer', 'admin')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Materialized View: Province Stats (refresh every 15 min) ────────────
CREATE MATERIALIZED VIEW mv_province_stats AS
SELECT
    province,
    COUNT(*)                                    AS total_reports,
    COUNT(*) FILTER (WHERE status = 'verified') AS verified_reports,
    COUNT(*) FILTER (WHERE status = 'pending')  AS pending_reports,
    AVG(d.confidence)                           AS avg_ai_confidence,
    MAX(r.reported_at)                          AS last_reported_at,
    ST_Centroid(ST_Collect(r.geom::geometry))   AS centroid
FROM reports r
LEFT JOIN ai_detections d ON d.report_id = r.id
WHERE r.province IS NOT NULL
GROUP BY province;

CREATE UNIQUE INDEX ON mv_province_stats(province);
```

---

## 6. AI Service — Abstraction Layer

### 6.1 Base Provider Interface

```python
# services/ai-worker/providers/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
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
    x1: float; y1: float
    x2: float; y2: float
    crack_type: CrackType
    confidence: float

@dataclass
class DetectionResult:
    crack_type:   CrackType         # dominant crack type
    severity:     Severity
    confidence:   float             # overall confidence (0.0–1.0)
    detections:   list[BoundingBox] # all detected instances
    model_name:   str
    model_version: str
    inference_ms: int
    raw_output:   Optional[dict] = None

class AIProvider(ABC):
    """
    Abstract interface สำหรับ AI detection engine
    ทุก provider ต้องใช้ interface นี้
    """
    
    @abstractmethod
    async def detect(self, image_path: str) -> DetectionResult:
        """
        รับ path ของรูปภาพ → คืน DetectionResult
        ต้องไม่ raise exception ปกติ (ใช้ DetectionResult กับ confidence=0 แทน)
        """
        ...
    
    @abstractmethod
    async def health_check(self) -> bool:
        """ตรวจสอบว่า provider พร้อมใช้งานหรือไม่"""
        ...
    
    def confidence_to_severity(self, confidence: float, crack_type: CrackType) -> Severity:
        """Default severity mapping — override ได้ใน subclass"""
        if crack_type == CrackType.NONE:
            return Severity.LOW
        if confidence >= 0.85 or crack_type in (CrackType.ALLIGATOR, CrackType.POTHOLE):
            return Severity.CRITICAL
        if confidence >= 0.70:
            return Severity.HIGH
        if confidence >= 0.50:
            return Severity.MEDIUM
        return Severity.LOW
```

### 6.2 Mock YOLO Provider (Development)

```python
# services/ai-worker/providers/mock_yolo.py

import asyncio, random, time
from .base import AIProvider, DetectionResult, BoundingBox, CrackType, Severity

class MockYOLOProvider(AIProvider):
    """
    Mock provider สำหรับ development — ไม่ต้องการ GPU หรือ model weights
    จำลอง latency และ output ที่สมจริง
    """
    
    MODEL_NAME    = "mock-yolo-v1"
    MODEL_VERSION = "1.0.0-dev"
    
    async def detect(self, image_path: str) -> DetectionResult:
        # Simulate inference time (50–300ms)
        await asyncio.sleep(random.uniform(0.05, 0.3))
        start_ms = time.time()
        
        # สุ่ม result (weighted toward detecting something)
        has_crack = random.random() > 0.15
        
        if not has_crack:
            return DetectionResult(
                crack_type=CrackType.NONE, severity=Severity.LOW,
                confidence=random.uniform(0.7, 0.95),
                detections=[], model_name=self.MODEL_NAME,
                model_version=self.MODEL_VERSION,
                inference_ms=int((time.time() - start_ms) * 1000)
            )
        
        crack_type = random.choice([
            CrackType.LONGITUDINAL, CrackType.TRANSVERSE,
            CrackType.ALLIGATOR, CrackType.POTHOLE,
        ])
        confidence = random.uniform(0.55, 0.97)
        
        # สร้าง bounding boxes จำลอง
        num_boxes = random.randint(1, 4)
        detections = [
            BoundingBox(
                x1=random.uniform(0, 0.5), y1=random.uniform(0, 0.5),
                x2=random.uniform(0.5, 1.0), y2=random.uniform(0.5, 1.0),
                crack_type=crack_type,
                confidence=random.uniform(confidence - 0.1, min(confidence + 0.05, 0.99))
            )
            for _ in range(num_boxes)
        ]
        
        return DetectionResult(
            crack_type=crack_type,
            severity=self.confidence_to_severity(confidence, crack_type),
            confidence=confidence,
            detections=detections,
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            inference_ms=int((time.time() - start_ms) * 1000)
        )
    
    async def health_check(self) -> bool:
        return True
```

### 6.3 YOLOv8 Local Provider (Production)

```python
# services/ai-worker/providers/yolov8_local.py

import asyncio, time
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
    """
    ใช้ ultralytics YOLOv8 รัน inference บน local GPU/CPU
    ต้องการ: pip install ultralytics, model weights ที่ /models/crack_yolov8.pt
    """
    
    def __init__(self, model_path: str, device: str = "cuda"):
        self.model_path = model_path
        self.device     = device
        self._model     = None
    
    async def _load_model(self):
        if self._model is None:
            from ultralytics import YOLO
            # รัน load ใน thread pool เพื่อไม่ block event loop
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(
                None, lambda: YOLO(self.model_path)
            )
    
    async def detect(self, image_path: str) -> DetectionResult:
        await self._load_model()
        start = time.time()
        
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: self._model(image_path, conf=0.4, device=self.device)
        )
        
        inference_ms = int((time.time() - start) * 1000)
        
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id     = int(box.cls[0])
                conf       = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxyn[0].tolist()  # normalized coords
                detections.append(BoundingBox(
                    x1=x1, y1=y1, x2=x2, y2=y2,
                    crack_type=YOLO_CLASS_MAP.get(cls_id, CrackType.NONE),
                    confidence=conf
                ))
        
        if not detections:
            return DetectionResult(
                crack_type=CrackType.NONE, severity=Severity.LOW, confidence=0.0,
                detections=[], model_name="yolov8-crack",
                model_version=Path(self.model_path).stem,
                inference_ms=inference_ms
            )
        
        # เลือก dominant detection (confidence สูงสุด)
        best = max(detections, key=lambda d: d.confidence)
        return DetectionResult(
            crack_type=best.crack_type,
            severity=self.confidence_to_severity(best.confidence, best.crack_type),
            confidence=best.confidence,
            detections=detections,
            model_name="yolov8-crack",
            model_version=Path(self.model_path).stem,
            inference_ms=inference_ms
        )
    
    async def health_check(self) -> bool:
        try:
            await self._load_model()
            return self._model is not None
        except Exception:
            return False
```

### 6.4 Provider Factory

```python
# services/ai-worker/providers/__init__.py

import os
from .base import AIProvider
from .mock_yolo      import MockYOLOProvider
from .yolov8_local   import YOLOv8LocalProvider
from .triton         import TritonProvider

def get_ai_provider() -> AIProvider:
    provider_name = os.getenv("AI_PROVIDER", "mock").lower()
    
    match provider_name:
        case "mock":
            return MockYOLOProvider()
        
        case "yolov8_local":
            model_path = os.getenv("MODEL_PATH", "/models/crack_yolov8.pt")
            device     = os.getenv("MODEL_DEVICE", "cuda")
            return YOLOv8LocalProvider(model_path=model_path, device=device)
        
        case "triton":
            triton_url  = os.getenv("TRITON_URL", "http://triton:8001")
            model_name  = os.getenv("TRITON_MODEL_NAME", "crack_yolov8")
            return TritonProvider(url=triton_url, model_name=model_name)
        
        case _:
            raise ValueError(f"Unknown AI_PROVIDER: {provider_name}")
```

---

## 7. API Endpoints

### Core Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/reports` | ส่ง report พร้อมรูปภาพ |
| `GET`  | `/api/v1/reports` | ดึง list reports (paginated, filterable) |
| `GET`  | `/api/v1/reports/{id}` | รายละเอียด report + AI result |
| `PATCH` | `/api/v1/reports/{id}/review` | Human reviewer ยืนยัน/ปฏิเสธ |
| `GET`  | `/api/v1/map/heatmap` | GeoJSON สำหรับ heatmap |
| `GET`  | `/api/v1/map/clusters` | Clustered markers พร้อม count |
| `GET`  | `/api/v1/alerts` | Alert zones และ threshold status |
| `GET`  | `/api/v1/stats/province` | สถิติแยกตามจังหวัด |
| `GET`  | `/api/v1/stats/trend` | Time-series report count |

### Report Lifecycle Flow

```
POST /reports
    │
    ▼
[status: pending] ─── image stored → Celery task queued
    │
    ▼ (ai-worker picks up)
[status: ai_processed] ─── ai_detections row inserted
    │
    ▼ (reviewer opens queue)
[status: under_review]
    │
    ├─ PATCH /review { action: "approve" }
    │   ▼
    │  [status: verified] ─── alert check → notification if threshold exceeded
    │
    └─ PATCH /review { action: "reject", note: "..." }
        ▼
       [status: rejected]
```

---

## 8. Frontend — Map Dashboard

### หน้าหลัก (MapDashboard)

```typescript
// services/frontend/src/pages/MapDashboard.tsx

/*
  แสดง:
  1. แผนที่ประเทศไทย (Leaflet.js + OpenStreetMap)
     - Thailand bounds: [[5.5, 97.5], [20.5, 105.7]]
  2. Heatmap layer (leaflet.heat) — intensity ∝ จำนวน reports ต่อพื้นที่
  3. Cluster markers (Leaflet.MarkerCluster) — คลิกเพื่อดูรายละเอียด
  4. Sidebar แสดง Top 5 provinces by report count
  5. Alert banner เมื่อมี zone เกิน threshold
*/

const THAILAND_BOUNDS = [[5.5, 97.5], [20.5, 105.7]] as LatLngBoundsExpression;
const THAILAND_CENTER = [13.7563, 100.5018] as LatLngExpression; // Bangkok

// Color coding by severity
const SEVERITY_COLORS = {
  low:      "#22c55e",   // green
  medium:   "#f59e0b",   // amber
  high:     "#ef4444",   // red
  critical: "#7c3aed",   // purple
};
```

### Component: ReportMarker

```tsx
// แต่ละ marker แสดง popup พร้อม:
// - ภาพถ่าย (thumbnail)
// - AI result: crack_type, severity badge, confidence bar
// - Status chip (pending / ai_processed / verified / rejected)
// - ปุ่ม "ดูรายละเอียด" → ReportDetail page
```

---

## 9. Alert System

### Logic

```python
# services/api/services/notification.py

async def check_alert_thresholds(province: str, db: AsyncSession):
    """
    เรียกทุกครั้งที่ report ถูก verify
    นับ verified reports ใน province นั้นในช่วง window_hours ที่ผ่านมา
    ถ้าเกิน threshold → ส่ง notification
    """
    zones = await get_active_zones_for_province(province, db)
    
    for zone in zones:
        cutoff = datetime.utcnow() - timedelta(hours=zone.window_hours)
        count = await count_reports_in_zone(
            zone_id=zone.id, since=cutoff, 
            status="verified", db=db
        )
        
        if count >= zone.threshold:
            event = AlertEvent(
                zone_id=zone.id, province=province,
                report_count=count, triggered_at=datetime.utcnow()
            )
            await db.add(event)
            await publish_alert(event)  # Redis Pub/Sub
```

### Alert Severity Levels

| Level | สี | เงื่อนไข (default) |
|-------|----|--------------------|
| 🟡 Watch | เหลือง | 3–5 reports / 24h |
| 🟠 Warning | ส้ม | 6–10 reports / 24h |
| 🔴 Critical | แดง | >10 reports / 24h |
| 🟣 Emergency | ม่วง | >20 reports / 6h |

---

## 10. Environment Variables

```env
# .env.example

# ── Database ────────────────────
DB_USER=rcm_user
DB_PASSWORD=changeme_in_production
DB_NAME=road_crack_db

# ── AI Provider ─────────────────
# Options: mock | yolov8_local | triton
AI_PROVIDER=mock
AI_CONFIDENCE_THRESHOLD=0.60
MODEL_PATH=/models/crack_yolov8.pt
MODEL_DEVICE=cpu          # cpu | cuda | mps

# Triton (ใช้เมื่อ AI_PROVIDER=triton)
TRITON_URL=http://triton:8001
TRITON_MODEL_NAME=crack_yolov8

# ── Auth ────────────────────────
JWT_SECRET=change_this_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# ── Notifications ───────────────
LINE_NOTIFY_TOKEN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
ALERT_WEBHOOK_URL=

# ── Frontend ────────────────────
MAPBOX_TOKEN=          # optional; Leaflet ใช้ OpenStreetMap ได้เลย
VITE_API_URL=http://localhost:8000
```

---

## 11. Quick Start

```bash
# 1. Clone และ setup
git clone https://github.com/your-org/road-crack-monitor.git
cd road-crack-monitor
cp .env.example .env

# 2. Build และ start (dev mode with mock AI)
docker compose up --build

# 3. Seed demo data (optional)
docker compose exec api python scripts/seed_demo_data.py

# 4. Access
#   Dashboard:    http://localhost:80
#   API Docs:     http://localhost:8000/docs
#   Admin Review: http://localhost:80/admin

# ─── Switch to real YOLO ───────────────────────────────
# 1. วาง model weights ที่ ./models/crack_yolov8.pt
# 2. แก้ .env: AI_PROVIDER=yolov8_local  MODEL_DEVICE=cuda
# 3. Uncomment GPU section ใน docker-compose.yml
# 4. docker compose up ai-worker --build
```

---

## 12. Data Flow Diagram

```
Reporter (Mobile/Web)
        │
        │  POST /api/v1/reports
        │  multipart: { lat, lng, image, description }
        ▼
┌──────────────────┐
│   FastAPI (api)  │──── save image ──► /uploads/{uuid}.jpg
│                  │──── insert DB ───► reports (status=pending)
│                  │──── enqueue ─────► Redis Queue: "crack.detect"
└──────────────────┘
                                              │
                           ┌──────────────────┘
                           ▼
                  ┌─────────────────┐
                  │   ai-worker     │
                  │  (Celery task)  │
                  │                 │
                  │  provider.detect(image_path)
                  │       │
                  │  ┌────┴──────────────────────────┐
                  │  │ AI_PROVIDER=mock               │
                  │  │   → MockYOLOProvider           │
                  │  │                                │
                  │  │ AI_PROVIDER=yolov8_local       │
                  │  │   → YOLOv8LocalProvider        │
                  │  │                                │
                  │  │ AI_PROVIDER=triton             │
                  │  │   → TritonProvider             │
                  │  └────────────────────────────────┘
                  │       │
                  │  DetectionResult
                  │  { crack_type, severity, confidence,
                  │    detections: [{bbox, class, conf}] }
                  │       │
                  │  save → ai_detections table
                  │  update reports.status = 'ai_processed'
                  │  publish → Redis: "report.ai_processed"
                  └─────────────────┘
                                │
                                ▼
                   ┌─────────────────────┐
                   │   Admin Dashboard   │
                   │   (Human Reviewer)  │
                   │                     │
                   │  เห็น report queue  │
                   │  ดูรูปภาพ + AI result│
                   │  YOLO bounding boxes│
                   │  confidence meter   │
                   │         │           │
                   │  [Approve] [Reject] │
                   └─────────────────────┘
                         │
                         ▼
              reports.status = 'verified'
                         │
                         ▼
              check_alert_thresholds()
                         │
                    threshold exceeded?
                    ┌────┴────┐
                   Yes        No
                    │
                    ▼
           Notification Service
           ├─ LINE Notify
           ├─ Email
           └─ Webhook
```

---

## 13. Scaling Considerations

### Horizontal Scaling
```yaml
# docker-compose.prod.yml overrides
services:
  api:
    deploy:
      replicas: 3
  ai-worker:
    deploy:
      replicas: 2    # เพิ่ม GPU workers ตาม load
```

### ถ้า report volume สูง (>1,000 รายการ/วัน)
- เพิ่ม `ai-worker` replicas (Celery auto-distributes tasks)
- ใช้ PostgreSQL read replicas สำหรับ map queries
- เปิด `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_province_stats` ด้วย pg_cron

### ถ้าต้องการ real-time map update
- เพิ่ม WebSocket endpoint ใน FastAPI (`/ws/reports`)
- Frontend subscribe เพื่อรับ new pins โดยไม่ต้อง reload

---

## 14. AI Model Upgrade Path

| Phase | Provider | Setup |
|-------|----------|-------|
| **Dev** | `mock` | ไม่ต้องการ GPU, ใช้ได้ทันที |
| **Staging** | `yolov8_local` | วาง `.pt` weights, รัน CPU ได้ |
| **Production** | `yolov8_local` (GPU) | เปิด Docker GPU passthrough |
| **Scale** | `triton` | Triton server, model versioning, batch inference |
| **Future** | Custom fine-tuned | เทรน dataset ถนนไทยโดยเฉพาะ |

เพียงแค่เปลี่ยน `AI_PROVIDER=` ใน `.env` แล้ว restart `ai-worker` — ไม่ต้องแก้โค้ด API หรือ frontend

---

## 15. Security Checklist

- [ ] JWT authentication บน `/admin` และ `/api/v1/reports/{id}/review`
- [ ] Rate limiting บน `POST /reports` (max 10 req/min per IP)
- [ ] Image validation: ตรวจ MIME type, max size 10MB, scan for malicious content
- [ ] UUID สำหรับ upload filename (ไม่ใช้ original filename)
- [ ] HTTPS only ใน production (nginx SSL termination)
- [ ] Secrets ผ่าน Docker secrets หรือ Vault (ไม่ใช้ .env ใน production)
- [ ] PostGIS query ใช้ parameterized queries (SQLAlchemy ORM)

---

*สร้างด้วย Claude — อัปเดต: 2025*

# Road Crack Monitor

ระบบตรวจสอบและติดตามรอยราวของถนนในประเทศไทย พร้อม AI-assisted detection, Human-in-the-loop verification และ Docker-native deployment

## System Architecture

```
Reporter (Mobile/Web)
        │
        │  POST /api/v1/reports
        ▼
┌──────────────────┐     ┌──────────────────────────────────────┐
│   FastAPI (api)  │────►│           AI Worker (Celery)         │
│   :8000          │     │                                      │
│                  │     │  AI_PROVIDER=onnx (default)          │
│  - Auth (JWT)    │     │    Stage 1: EfficientNet-B0          │
│  - Reports       │     │    Stage 2: MobileNetV2              │
│  - Admin Queue   │     │                                      │
│  - Map/Stats     │     │  AI_PROVIDER=mock (dev)              │
│  - Alerts        │     │  AI_PROVIDER=yolov8_local            │
└──────────────────┘     │  AI_PROVIDER=triton                  │
        │                └──────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌──────────────┐           ┌──────────────────────┐
│  PostgreSQL  │           │  Notification Service │
│  + PostGIS   │           │                      │
│  :5432       │           │  - LINE Notify        │
└──────────────┘           │  - Email (SMTP)       │
        │                  │  - Webhook            │
        ▼                  └──────────────────────┘
┌──────────────┐
│    Redis     │  ← Celery task queue + Pub/Sub events
│    :6379     │
└──────────────┘
        │
        ▼
┌──────────────────────────┐     ┌─────────────────┐
│  React Frontend  :3000   │     │  Nginx  :80/443  │
│                          │◄────│  Reverse Proxy   │
│  - Map Dashboard         │     └─────────────────┘
│  - Admin Review Queue    │
│  - Report Detail         │
│  - Alert Settings        │
└──────────────────────────┘
```

7 microservices ทั้งหมดอยู่ใน Docker Compose และ scale ได้แยกอิสระ

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Backend API | FastAPI + SQLAlchemy (async) |
| Database | PostgreSQL 15 + PostGIS 3.3 |
| AI Worker | Celery + ONNX Runtime (pluggable providers) |
| Message Queue | Redis 7 (task queue + Pub/Sub events) |
| Frontend | React 18 + Vite + Leaflet.js |
| Reverse Proxy | Nginx |

## Quick Start

### Prerequisites

- Docker + Docker Compose
- (GPU only) NVIDIA Container Toolkit

### 1. Clone and configure

```bash
git clone https://github.com/codeboyz12/crack_the_road.git
cd crack_the_road
cp .env.example .env
```

### 2. Start services

```bash
docker compose up --build
```

### 3. Seed demo data (optional)

```bash
docker compose exec api python scripts/seed_demo_data.py
```

### 4. Access

| URL | Description |
|---|---|
| http://localhost | Map Dashboard |
| http://localhost/admin | Admin Review Queue |
| http://localhost:8000/docs | Swagger API Docs |

## Report Lifecycle

```
POST /api/v1/reports  (image + lat/lng)
         │
         ▼ status: pending
  ┌──────────────┐
  │  AI Worker   │  ← Celery picks up task from Redis
  │              │
  │  detect()    │  → DetectionResult { crack_type, severity, confidence, bboxes }
  └──────────────┘
         │
         ▼ status: ai_processed → ai_detections row saved
  ┌───────────────────┐
  │  Human Reviewer   │  ← Admin queue at /admin
  │  (Admin Dashboard)│
  └───────────────────┘
         │
         ├─ Approve → status: verified → check_alert_thresholds()
         │                                        │
         │                               threshold exceeded?
         │                                        │
         │                               Notification Service
         │                               (LINE / Email / Webhook)
         │
         └─ Reject  → status: rejected
```

## AI Providers

Swap via `AI_PROVIDER` in `.env` — no code changes required.

| Provider | Value | Requirements | Notes |
|---|---|---|---|
| ONNX Two-Stage (default) | `onnx` | model files in `./models/` | EfficientNet-B0 + MobileNetV2 pipeline |
| Mock (dev) | `mock` | none | random detections, simulated latency |
| YOLOv8 Local | `yolov8_local` | `./models/crack_yolov8.pt` | CPU / CUDA / MPS |
| Triton Server | `triton` | Triton Inference Server | batch inference, model versioning |

### ONNX Two-Stage Pipeline (recommended)

Stage 1 — **EfficientNet-B0** classifies: `Normal` / `Damaged` / `Other`

Stage 2 — **MobileNetV2** classifies crack type with fixed severity mapping:

| Crack Type | Severity |
|---|---|
| Alligator Crack | HIGH |
| Pot Hole | CRITICAL |
| Deep Foundation Consolidation | CRITICAL |
| Reflection Crack | MEDIUM |

```bash
# Place model weights
cp stage1_efficientnet_b0.onnx ./models/
cp mobilenet_v2_model.onnx ./models/

# Set in .env
AI_PROVIDER=onnx
```

### Switch to YOLOv8

```bash
cp crack_yolov8.pt ./models/

# .env
AI_PROVIDER=yolov8_local
MODEL_DEVICE=cuda   # cpu | cuda | mps

docker compose up ai-worker --build
```

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/token` | Login → JWT token |
| `POST` | `/api/v1/auth/register` | Register user |

### Reports
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/reports` | Submit report (multipart: image + lat/lng) |
| `GET` | `/api/v1/reports` | List reports (paginated, filter by status/province) |
| `GET` | `/api/v1/reports/{id}` | Detail + AI detection result |
| `PATCH` | `/api/v1/reports/{id}/review` | Approve / Reject |

### Admin
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/queue` | Reports awaiting human review |
| `PATCH` | `/api/v1/admin/queue/{id}/claim` | Claim report for review |
| `GET` | `/api/v1/admin/stats` | Status/crack-type breakdown |

### Map & Stats
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/map/heatmap` | Intensity points for heatmap |
| `GET` | `/api/v1/map/clusters` | GeoJSON clustered markers |
| `GET` | `/api/v1/stats/province` | Per-province aggregates |
| `GET` | `/api/v1/stats/trend` | Daily report count time-series |

### Alerts
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/alerts/zones` | List alert zones |
| `POST` | `/api/v1/alerts/zones` | Create zone with polygon + threshold |
| `PATCH` | `/api/v1/alerts/zones/{id}` | Update zone |
| `DELETE` | `/api/v1/alerts/zones/{id}` | Delete zone |
| `GET` | `/api/v1/alerts/events` | Latest 50 triggered alerts |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | API liveness |
| `GET` | `/health/ai` | AI model file accessibility check |

## Alert System

Alert zones are geographic polygons with configurable thresholds. When verified reports in a zone exceed the threshold within a rolling time window, notifications are sent.

| Level | Condition (default) |
|---|---|
| Watch | 3–5 reports / 24h |
| Warning | 6–10 reports / 24h |
| Critical | >10 reports / 24h |
| Emergency | >20 reports / 6h |

**Notification channels:** LINE Notify · Email (SMTP) · Webhook (HTTP POST)

Configure via `ALERT_*` environment variables (see `.env.example`).

## Environment Variables

```env
# Database
DB_USER=rcm_user
DB_PASSWORD=changeme_in_production
DB_NAME=road_crack_db

# AI Provider: onnx | mock | yolov8_local | triton
AI_PROVIDER=onnx
AI_CONFIDENCE_THRESHOLD=0.60
STAGE1_MODEL_PATH=/models/stage1_efficientnet_b0.onnx
STAGE2_MODEL_PATH=/models/mobilenet_v2_model.onnx

# YOLOv8 (when AI_PROVIDER=yolov8_local)
MODEL_PATH=/models/crack_yolov8.pt
MODEL_DEVICE=cpu

# Triton (when AI_PROVIDER=triton)
TRITON_URL=http://triton:8001
TRITON_MODEL_NAME=crack_yolov8

# Auth
JWT_SECRET=change_this_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Notifications (all optional)
LINE_NOTIFY_TOKEN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
ALERT_EMAIL_TO=
ALERT_WEBHOOK_URL=

# Frontend
VITE_API_URL=http://localhost:8000
MAPBOX_TOKEN=   # optional; Leaflet uses OpenStreetMap by default
```

## Scaling

```bash
# Scale API replicas
docker compose up --scale api=3

# Scale AI workers (Celery distributes tasks automatically)
docker compose up --scale ai-worker=2
```

For higher volume (>1,000 reports/day):
- Add PostgreSQL read replicas for map queries
- Enable `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_province_stats` via pg_cron
- Enable Triton provider for batched inference

## Project Structure

```
├── services/
│   ├── api/                   # FastAPI backend
│   │   ├── routers/           # reports, admin, alerts, map, stats, auth
│   │   ├── models/            # SQLAlchemy ORM (report, alert_zone, user)
│   │   ├── schemas/           # Pydantic schemas
│   │   └── services/          # ai_service, notification, geo_service
│   ├── ai-worker/             # Celery worker
│   │   ├── providers/         # mock, onnx, yolov8_local, triton
│   │   └── tasks/             # detect_crack.py
│   ├── frontend/              # React + Vite
│   │   └── src/
│   │       ├── pages/         # MapDashboard, AdminReview, ReportDetail, AlertSettings
│   │       ├── components/    # CrackMap, AIResultCard, AlertBanner
│   │       └── hooks/         # useReports, useAlerts, useAlertZones
│   └── notification/          # LINE / Email / Webhook service
├── database/
│   └── init.sql               # PostGIS schema + materialized views
├── nginx/
│   └── nginx.conf
├── models/                    # Mount ONNX / YOLO weights here
├── scripts/
│   └── seed_demo_data.py
└── docker-compose.yml
```

## Security Checklist

- JWT authentication on `/admin` and review endpoints
- Rate limiting on `POST /reports` (10 req/min per IP)
- Image validation: MIME type check, 10MB max, UUID filenames
- HTTPS via Nginx SSL termination in production
- Parameterized queries via SQLAlchemy ORM (no raw SQL injection risk)
- Secrets via Docker secrets or Vault in production (not `.env`)

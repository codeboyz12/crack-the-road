# Road Crack Monitor

ระบบตรวจสอบและติดตามรอยราวของถนนในประเทศไทย พร้อม AI-assisted detection, Human-in-the-loop verification และ Docker-native deployment

## ภาพรวมระบบ

```
[Reporter App]  ──►  [API Gateway]  ──►  [AI Detection Worker]
(Mobile/Web)         (FastAPI)            (YOLO / Mock YOLO)
                          │                       │
                     [PostgreSQL]          [Human Review UI]
                     + PostGIS             (Admin Dashboard)
                          │                       │
                     [Redis Queue]    [Notification Service]
                          │
                    [Map Dashboard]
                 (React + Leaflet.js)
```

7 microservices ทั้งหมดอยู่ใน Docker Compose และ scale ได้แยกอิสระ

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Backend API | FastAPI + SQLAlchemy (async) |
| Database | PostgreSQL 15 + PostGIS 3.3 |
| AI Worker | Celery + YOLOv8 (mock สำหรับ dev) |
| Message Queue | Redis 7 |
| Frontend | React 18 + Vite + Leaflet.js |
| Reverse Proxy | Nginx |

## เริ่มต้นใช้งาน

### ข้อกำหนด

- Docker + Docker Compose
- (ถ้าใช้ GPU) NVIDIA Container Toolkit

### 1. Clone และตั้งค่า

```bash
git clone https://github.com/your-org/road-crack-monitor.git
cd road-crack-monitor
cp .env.example .env
```

### 2. Start ระบบ

```bash
docker compose up --build
```

### 3. เพิ่มข้อมูลตัวอย่าง (ไม่บังคับ)

```bash
docker compose exec api python scripts/seed_demo_data.py
```

### 4. เข้าใช้งาน

| URL | รายละเอียด |
|---|---|
| http://localhost | Map Dashboard หน้าหลัก |
| http://localhost/admin | Admin Review Queue |
| http://localhost:8000/docs | API Documentation (Swagger) |

## AI Provider

เปลี่ยนได้ผ่าน `AI_PROVIDER` ใน `.env` โดยไม่ต้องแก้โค้ด

| Mode | ค่า | ต้องการ |
|---|---|---|
| Mock (dev) | `mock` | ไม่ต้องการ GPU หรือ model |
| YOLOv8 local | `yolov8_local` | model weights ที่ `./models/crack_yolov8.pt` |
| Triton server | `triton` | Triton Inference Server |

**เปลี่ยนเป็น YOLOv8:**

```bash
# 1. วาง model weights
cp crack_yolov8.pt ./models/

# 2. แก้ .env
AI_PROVIDER=yolov8_local
MODEL_DEVICE=cuda   # หรือ cpu / mps

# 3. Restart worker
docker compose up ai-worker --build
```

## Report Lifecycle

```
POST /reports
    │
    ▼ status: pending
AI Worker ประมวลผล
    │
    ▼ status: ai_processed
Human Reviewer เปิดคิว
    │
    ├─ อนุมัติ → status: verified → ตรวจ alert threshold
    └─ ปฏิเสธ → status: rejected
```

## API Endpoints หลัก

| Method | Path | รายละเอียด |
|---|---|---|
| `POST` | `/api/v1/reports` | ส่ง report พร้อมรูปภาพ |
| `GET` | `/api/v1/reports` | ดึง list (paginated, filterable) |
| `GET` | `/api/v1/reports/{id}` | รายละเอียด + ผล AI |
| `PATCH` | `/api/v1/reports/{id}/review` | Approve / Reject |
| `GET` | `/api/v1/map/heatmap` | GeoJSON สำหรับ heatmap |
| `GET` | `/api/v1/map/clusters` | Clustered markers |
| `GET` | `/api/v1/admin/queue` | คิวรอ human review |
| `GET` | `/api/v1/admin/stats` | สถิติภาพรวม |

## Environment Variables

```env
# Database
DB_USER=rcm_user
DB_PASSWORD=changeme_in_production

# AI Provider: mock | yolov8_local | triton
AI_PROVIDER=mock
AI_CONFIDENCE_THRESHOLD=0.60

# Auth
JWT_SECRET=change_this_secret_key

# Notifications (ไม่บังคับ)
LINE_NOTIFY_TOKEN=
SMTP_HOST=
ALERT_WEBHOOK_URL=
```

ดู `.env.example` สำหรับค่าครบทั้งหมด

## การแจ้งเตือน (Alert System)

เมื่อจำนวน report ใน zone เกิน threshold จะส่งแจ้งเตือนผ่าน:

- **LINE Notify** — ตั้งค่าด้วย `LINE_NOTIFY_TOKEN`
- **Email** — ตั้งค่าด้วย `SMTP_*`
- **Webhook** — ตั้งค่าด้วย `ALERT_WEBHOOK_URL`

## Scaling

```bash
# เพิ่ม API replicas
docker compose up --scale api=3

# เพิ่ม AI Worker (กรณี load สูง)
docker compose up --scale ai-worker=2
```

## โครงสร้างโปรเจกต์

```
├── services/
│   ├── api/           # FastAPI backend
│   ├── ai-worker/     # Celery + YOLO providers
│   ├── frontend/      # React + Vite
│   └── notification/  # LINE / Email / Webhook
├── database/
│   └── init.sql       # PostGIS schema
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── seed_demo_data.py
└── docker-compose.yml
```

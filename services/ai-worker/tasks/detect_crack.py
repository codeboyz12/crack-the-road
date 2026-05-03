import asyncio
import json
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import redis

from providers import get_ai_provider

_ASYNC_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://rcm_user:changeme@postgres:5432/road_crack_db",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Celery tasks are synchronous — use psycopg2 (already in requirements) to
# avoid asyncpg event-loop lifecycle issues that cause "another operation is
# in progress" on every second request.
_SYNC_DB_URL = _ASYNC_DB_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

# Per-process singleton: safe because Celery prefork gives each worker its
# own process and tasks run one at a time per process.
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(_SYNC_DB_URL)
    return _engine


def run_detection(report_id: str):
    Session = sessionmaker(_get_engine())
    provider = get_ai_provider()

    # ── Phase 1: read ────────────────────────────────────────────────────
    with Session() as db:
        row = db.execute(
            text("SELECT image_path FROM reports WHERE id = :id"),
            {"id": report_id},
        ).fetchone()

    if not row:
        return

    image_path = f"/app{row.image_path}"

    # ── AI detection (async provider, isolated loop) ──────────────────────
    # asyncio.run() here is safe: it only wraps the provider call, no DB
    # connection is open during the loop's lifetime.
    detection = asyncio.run(provider.detect(image_path))

    detections_json = [
        {
            "bbox": [d.x1, d.y1, d.x2, d.y2],
            "class": d.crack_type.value,
            "conf": d.confidence,
        }
        for d in detection.detections
    ]

    # ── Phase 2: write ───────────────────────────────────────────────────
    with Session() as db:
        db.execute(
            text("""
                INSERT INTO ai_detections
                    (report_id, crack_type, severity, confidence,
                     detections, model_name, model_version, inference_ms)
                VALUES
                    (:report_id, :crack_type, :severity, :confidence,
                     :detections, :model_name, :model_version, :inference_ms)
            """),
            {
                "report_id":     report_id,
                "crack_type":    detection.crack_type.value,
                "severity":      detection.severity.value,
                "confidence":    detection.confidence,
                "detections":    json.dumps(detections_json),
                "model_name":    detection.model_name,
                "model_version": detection.model_version,
                "inference_ms":  detection.inference_ms,
            },
        )
        db.execute(
            text("UPDATE reports SET status = 'ai_processed', updated_at = NOW() WHERE id = :id"),
            {"id": report_id},
        )
        db.commit()

    r = redis.from_url(REDIS_URL)
    r.publish("report.ai_processed", json.dumps({"report_id": report_id}))
    r.close()

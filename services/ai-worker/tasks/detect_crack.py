import asyncio
import json
import os
from dataclasses import asdict

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
import redis

from providers import get_ai_provider

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://rcm_user:changeme@postgres:5432/road_crack_db")
REDIS_URL    = os.getenv("REDIS_URL", "redis://redis:6379/0")

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _run_detection(report_id: str):
    from sqlalchemy import text

    provider = get_ai_provider()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT image_path FROM reports WHERE id = :id"),
            {"id": report_id},
        )
        row = result.fetchone()
        if not row:
            return

        image_path = f"/app{row.image_path}"
        detection  = await provider.detect(image_path)

        detections_json = [
            {
                "bbox": [d.x1, d.y1, d.x2, d.y2],
                "class": d.crack_type.value,
                "conf": d.confidence,
            }
            for d in detection.detections
        ]

        await db.execute(
            text("""
                INSERT INTO ai_detections
                    (report_id, crack_type, severity, confidence,
                     detections, model_name, model_version, inference_ms)
                VALUES
                    (:report_id, :crack_type, :severity, :confidence,
                     :detections, :model_name, :model_version, :inference_ms)
            """),
            {
                "report_id":    report_id,
                "crack_type":   detection.crack_type.value,
                "severity":     detection.severity.value,
                "confidence":   detection.confidence,
                "detections":   json.dumps(detections_json),
                "model_name":   detection.model_name,
                "model_version": detection.model_version,
                "inference_ms": detection.inference_ms,
            },
        )

        await db.execute(
            text("UPDATE reports SET status = 'ai_processed', updated_at = NOW() WHERE id = :id"),
            {"id": report_id},
        )
        await db.commit()

    r = redis.from_url(REDIS_URL)
    r.publish("report.ai_processed", json.dumps({"report_id": report_id}))
    r.close()


def run_detection(report_id: str):
    asyncio.run(_run_detection(report_id))

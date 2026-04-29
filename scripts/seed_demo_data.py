"""
Generate demo road crack reports across Thailand.
Run inside the api container: docker compose exec api python scripts/seed_demo_data.py
"""
import asyncio
import random
import uuid
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://rcm_user:changeme@postgres:5432/road_crack_db")

PROVINCES = [
    ("กรุงเทพมหานคร", 13.76, 100.50),
    ("เชียงใหม่", 18.79, 98.98),
    ("ขอนแก่น", 16.43, 102.83),
    ("นครราชสีมา", 14.97, 102.10),
    ("สงขลา", 7.19, 100.59),
    ("ภูเก็ต", 7.88, 98.39),
    ("อุดรธานี", 17.41, 102.79),
    ("ชลบุรี", 13.36, 100.99),
    ("สุราษฎร์ธานี", 9.14, 99.33),
    ("เชียงราย", 19.91, 99.83),
]

CRACK_TYPES  = ["longitudinal", "transverse", "alligator", "pothole", "edge_crack", "block_crack"]
SEVERITIES   = ["low", "medium", "high", "critical"]
STATUSES     = ["pending", "ai_processed", "verified", "rejected"]


async def seed():
    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine)

    async with Session() as db:
        for i in range(100):
            province, base_lat, base_lng = random.choice(PROVINCES)
            lat = base_lat + random.uniform(-0.5, 0.5)
            lng = base_lng + random.uniform(-0.5, 0.5)
            report_id   = str(uuid.uuid4())
            image_hash  = hashlib.sha256(report_id.encode()).hexdigest()
            status      = random.choice(STATUSES)
            reported_at = datetime.utcnow() - timedelta(days=random.randint(0, 30))

            await db.execute(text("""
                INSERT INTO reports (id, lat, lng, province, image_path, image_hash, status, reported_at, source)
                VALUES (:id, :lat, :lng, :province, :image_path, :image_hash, :status, :reported_at, 'seed')
            """), {
                "id": report_id, "lat": lat, "lng": lng, "province": province,
                "image_path": f"/uploads/{report_id}.jpg",
                "image_hash": image_hash,
                "status": status, "reported_at": reported_at,
            })

            if status in ("ai_processed", "verified", "rejected"):
                crack_type = random.choice(CRACK_TYPES)
                severity   = random.choice(SEVERITIES)
                confidence = round(random.uniform(0.5, 0.98), 4)
                await db.execute(text("""
                    INSERT INTO ai_detections (report_id, crack_type, severity, confidence, model_name, model_version)
                    VALUES (:report_id, :crack_type, :severity, :confidence, 'mock-yolo-v1', '1.0.0-dev')
                """), {
                    "report_id": report_id, "crack_type": crack_type,
                    "severity": severity, "confidence": confidence,
                })

        await db.commit()
    print("Seeded 100 demo reports.")

asyncio.run(seed())

"""
Seed reports from local data/ folder images.

Maps folder name → crack_type, copies images to uploads/, then inserts
reports (status=ai_processed) + ai_detections so they appear in admin queue.

Run from project root on the host:
    python3 scripts/seed_images.py

Requires: pip3 install asyncpg
Postgres must be reachable at localhost:5432 (docker compose up first).
"""

import asyncio
import hashlib
import os
import random
import shutil
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import asyncpg

# ── Config ───────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR     = PROJECT_ROOT / "data"
UPLOADS_DIR  = PROJECT_ROOT / "uploads"

DB_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://rcm_user:changeme_in_production@localhost:5432/road_crack_db",
).replace("postgresql+asyncpg://", "postgresql://")

# ── Folder → crack_type mapping ───────────────────────────────────────────────

FOLDER_MAP = {
    "Alligator Crack":              "alligator_crack",
    "Deep Foundation Consolidation": "deep_foundation_consolidation",
    "Pot Hole":                     "pot_hole",
    "Reflection Crack":             "reflection_crack",
}

SEVERITY_MAP = {
    "alligator_crack":               "high",
    "deep_foundation_consolidation": "critical",
    "pot_hole":                      "critical",
    "reflection_crack":              "medium",
}

# ── Thailand provinces with approximate centre coords ────────────────────────

# Curated inland points — confirmed on land, ±0.02° offset stays on land
INLAND_POINTS = [
    ("กรุงเทพมหานคร", 13.7563, 100.5018), ("กรุงเทพมหานคร", 13.7800, 100.5607),
    ("กรุงเทพมหานคร", 13.8200, 100.5500), ("กรุงเทพมหานคร", 13.7381, 100.5209),
    ("เชียงใหม่",     18.7880,  98.9853), ("เชียงใหม่",     18.8200,  99.0300),
    ("เชียงราย",      19.9105,  99.8406), ("เชียงราย",      20.0000,  99.8500),
    ("ลำปาง",         18.2852,  99.4921), ("แพร่",           18.1450, 100.1414),
    ("พิษณุโลก",      16.8211, 100.2659), ("นครสวรรค์",     15.7030, 100.1372),
    ("ลพบุรี",        14.7995, 100.6534), ("สระบุรี",        14.5289, 100.9101),
    ("ปทุมธานี",      14.0280, 100.5440), ("นนทบุรี",        13.8600, 100.5330),
    ("นครปฐม",        13.8190, 100.0620), ("สมุทรปราการ",   13.5990, 100.6050),
    ("ขอนแก่น",       16.4322, 102.8236), ("ขอนแก่น",       16.4600, 102.8000),
    ("อุดรธานี",      17.4138, 102.7872), ("อุดรธานี",      17.4300, 102.8100),
    ("นครราชสีมา",    14.9799, 102.0978), ("นครราชสีมา",    15.0100, 102.0700),
    ("อุบลราชธานี",   15.2287, 104.8576), ("ร้อยเอ็ด",      16.0538, 103.6520),
    ("ชลบุรี",        13.3611, 100.9847), ("ชลบุรี",         13.4000, 101.0200),
    ("ระยอง",         12.7100, 101.2570), ("ระยอง",          12.7400, 101.3000),
    ("สงขลา",          7.2060, 100.5950), ("สงขลา",           7.1800, 100.6100),
    ("สุราษฎร์ธานี",   9.1400,  99.3270), ("สุราษฎร์ธานี",   9.2000,  99.2800),
    ("ภูเก็ต",         7.9800,  98.3600), ("ภูเก็ต",          8.0200,  98.3800),
    ("นครศรีธรรมราช",  8.4322,  99.9600), ("พัทลุง",          7.6167, 100.0742),
    ("กระบี่",         8.0863,  98.9063), ("ตรัง",            7.5593,  99.6118),
]

ROAD_NAMES = [
    "ถนนพหลโยธิน", "ถนนสุขุมวิท", "ถนนวิภาวดีรังสิต",
    "ถนนรัชดาภิเษก", "ถนนลาดพร้าว", "ถนนเพชรบุรี",
    "ถนนบางนา–ตราด", "ถนนกาญจนาภิเษก", "ทางหลวงหมายเลข 1",
    "ทางหลวงหมายเลข 2", "ทางหลวงหมายเลข 4",
]


def collect_images() -> list[tuple[Path, str]]:
    """Return [(image_path, crack_type), ...] for all images found."""
    items: list[tuple[Path, str]] = []
    for folder_name, crack_type in FOLDER_MAP.items():
        folder = DATA_DIR / folder_name
        if not folder.exists():
            print(f"  [skip] {folder_name} — folder not found")
            continue
        images = [
            p for p in folder.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        if not images:
            print(f"  [skip] {folder_name} — no images")
            continue
        print(f"  {folder_name}: {len(images)} images → crack_type={crack_type}")
        for img in images:
            items.append((img, crack_type))
    return items


def copy_to_uploads(src: Path) -> tuple[str, str]:
    """Copy image to uploads/ with a UUID filename. Returns (image_path, image_hash)."""
    UPLOADS_DIR.mkdir(exist_ok=True)
    stem       = str(uuid.uuid4())
    dest       = UPLOADS_DIR / f"{stem}{src.suffix.lower()}"
    shutil.copy2(src, dest)
    image_path = f"/uploads/{stem}{src.suffix.lower()}"
    image_hash = hashlib.sha256(src.read_bytes()).hexdigest()
    return image_path, image_hash


def random_location() -> tuple[float, float, str, str]:
    province, base_lat, base_lng = random.choice(INLAND_POINTS)
    lat  = round(base_lat + random.uniform(-0.02, 0.02), 7)
    lng  = round(base_lng + random.uniform(-0.02, 0.02), 7)
    road = random.choice(ROAD_NAMES)
    return lat, lng, province, road


async def seed():
    images = collect_images()
    if not images:
        print("No images found — nothing to seed.")
        sys.exit(1)

    print(f"\nTotal images found: {len(images)}")

    conn = await asyncpg.connect(DB_DSN)

    try:
        # Load all existing hashes to skip duplicates
        rows = await conn.fetch("SELECT image_hash FROM reports WHERE image_hash IS NOT NULL")
        existing_hashes = {r["image_hash"] for r in rows}
        print(f"Existing records in DB: {len(existing_hashes)}")

        inserted = skipped = 0
        async with conn.transaction():
            for src_path, crack_type in images:
                image_hash = hashlib.sha256(src_path.read_bytes()).hexdigest()

                if image_hash in existing_hashes:
                    skipped += 1
                    continue

                image_path, _ = copy_to_uploads(src_path)
                existing_hashes.add(image_hash)

                lat, lng, province, road = random_location()
                report_id   = str(uuid.uuid4())
                reported_at = datetime.utcnow() - timedelta(days=random.randint(0, 14))
                confidence  = round(random.uniform(0.65, 0.97), 4)
                severity    = SEVERITY_MAP.get(crack_type, "medium")

                await conn.execute("""
                    INSERT INTO reports
                        (id, lat, lng, province, road_name, image_path, image_hash,
                         status, reported_at, source)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7,
                         'ai_processed', $8, 'seed')
                """, report_id, lat, lng, province, road,
                    image_path, image_hash, reported_at)

                await conn.execute("""
                    INSERT INTO ai_detections
                        (report_id, crack_type, severity, confidence,
                         model_name, model_version)
                    VALUES ($1, $2, $3, $4, 'mock-yolo-v1', '1.0.0-dev')
                """, report_id, crack_type, severity, confidence)

                inserted += 1

        print(f"Inserted: {inserted}  Skipped (duplicate): {skipped}")
        print("Reports are visible at /api/v1/admin/queue")

    finally:
        await conn.close()


asyncio.run(seed())

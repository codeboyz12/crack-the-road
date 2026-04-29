from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db

router = APIRouter(prefix="/api/v1/map", tags=["map"])


@router.get("/heatmap")
async def heatmap(db: AsyncSession = Depends(get_db)):
    """Returns [lat, lng, intensity] points for leaflet.heat."""
    result = await db.execute(
        text("""
            SELECT
                ST_Y(geom::geometry) AS lat,
                ST_X(geom::geometry) AS lng,
                CASE severity
                    WHEN 'critical' THEN 1.0
                    WHEN 'high'     THEN 0.75
                    WHEN 'medium'   THEN 0.5
                    ELSE 0.25
                END AS intensity
            FROM reports r
            LEFT JOIN ai_detections d ON d.report_id = r.id
            WHERE r.status IN ('ai_processed', 'under_review', 'verified')
              AND r.geom IS NOT NULL
        """)
    )
    rows = result.fetchall()
    return {"points": [[r.lat, r.lng, r.intensity] for r in rows]}


@router.get("/clusters")
async def clusters(db: AsyncSession = Depends(get_db)):
    """Returns GeoJSON FeatureCollection for marker clustering."""
    result = await db.execute(
        text("""
            SELECT
                r.id, r.lat, r.lng, r.status, r.province,
                d.crack_type, d.severity, d.confidence
            FROM reports r
            LEFT JOIN ai_detections d ON d.report_id = r.id
            WHERE r.geom IS NOT NULL
            ORDER BY r.reported_at DESC
            LIMIT 2000
        """)
    )
    rows = result.fetchall()

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [row.lng, row.lat]},
            "properties": {
                "id": str(row.id),
                "status": row.status,
                "province": row.province,
                "crack_type": row.crack_type,
                "severity": row.severity,
                "confidence": float(row.confidence) if row.confidence else None,
            },
        })

    return {"type": "FeatureCollection", "features": features}

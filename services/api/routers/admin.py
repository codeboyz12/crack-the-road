from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db
from core.security import require_reviewer

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/queue")
async def review_queue(
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(require_reviewer),
):
    """Reports waiting for human review."""
    result = await db.execute(
        text("""
            SELECT r.id, r.lat, r.lng, r.province, r.district, r.road_name,
                   r.image_path, r.status, r.reported_at,
                   d.crack_type, d.severity, d.confidence
            FROM reports r
            LEFT JOIN ai_detections d ON d.report_id = r.id
            WHERE r.status IN ('ai_processed', 'under_review')
            ORDER BY r.reported_at DESC
            LIMIT 100
        """)
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    status_result = await db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'pending')      AS pending,
                COUNT(*) FILTER (WHERE status = 'ai_processed') AS ai_processed,
                COUNT(*) FILTER (WHERE status = 'under_review') AS under_review,
                COUNT(*) FILTER (WHERE status = 'verified')     AS verified,
                COUNT(*) FILTER (WHERE status = 'rejected')     AS rejected,
                COUNT(*) FILTER (WHERE status = 'resolved')     AS resolved,
                COUNT(*)                                         AS total
            FROM reports
        """)
    )
    crack_result = await db.execute(
        text("""
            SELECT crack_type, COUNT(*) AS count
            FROM ai_detections
            WHERE crack_type IS NOT NULL AND crack_type != 'none'
            GROUP BY crack_type
            ORDER BY count DESC
        """)
    )
    status_row = status_result.fetchone()
    crack_rows = crack_result.fetchall()
    return {
        **dict(status_row._mapping),
        "by_crack_type": {r.crack_type: r.count for r in crack_rows},
    }

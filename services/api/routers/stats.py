from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("/province")
async def province_stats(db: AsyncSession = Depends(get_db)):
    """Per-province report counts from the materialized view."""
    result = await db.execute(
        text("""
            SELECT
                province,
                total_reports,
                verified_reports,
                pending_reports,
                ROUND(avg_ai_confidence::numeric, 4) AS avg_ai_confidence,
                last_reported_at
            FROM mv_province_stats
            ORDER BY total_reports DESC
        """)
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/trend")
async def trend(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Daily report count over the past N days."""
    result = await db.execute(
        text("""
            SELECT
                DATE(reported_at AT TIME ZONE 'Asia/Bangkok') AS day,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'verified') AS verified
            FROM reports
            WHERE reported_at >= NOW() - INTERVAL '1 day' * :days
            GROUP BY day
            ORDER BY day
        """),
        {"days": days},
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]

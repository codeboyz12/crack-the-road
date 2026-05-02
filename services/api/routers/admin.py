import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.security import require_reviewer
from models.report import Report
from schemas.report import ReportOut, ReportListOut

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/queue", response_model=ReportListOut)
async def review_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Reports waiting for human review — paginated, with nested ai_detection."""
    q = select(Report).where(Report.status.in_(["ai_processed", "under_review"]))

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = (
        q.options(selectinload(Report.ai_detection))
        .order_by(Report.reported_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    items = result.scalars().all()

    return {"items": items, "total": total, "page": page, "page_size": page_size}


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


@router.patch("/queue/{report_id}/claim")
async def claim_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(require_reviewer),
):
    """Transition report from ai_processed → under_review (reviewer claims it)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    if report.status != "ai_processed":
        raise HTTPException(409, f"Cannot claim report in status '{report.status}'")

    await db.execute(
        text("UPDATE reports SET status = 'under_review', updated_at = NOW() WHERE id = :id"),
        {"id": str(report_id)},
    )
    await db.commit()
    return {"report_id": str(report_id), "status": "under_review"}

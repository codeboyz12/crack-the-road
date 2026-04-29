from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.alert_zone import AlertZone, AlertEvent

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("/zones")
async def list_zones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertZone).where(AlertZone.is_active == True))
    zones = result.scalars().all()
    return [
        {
            "id": str(z.id),
            "name": z.name,
            "threshold": z.threshold,
            "window_hours": z.window_hours,
            "severity": z.severity,
            "notify_channels": z.notify_channels,
        }
        for z in zones
    ]


@router.get("/events")
async def list_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AlertEvent).order_by(AlertEvent.triggered_at.desc()).limit(50)
    )
    events = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "province": e.province,
            "report_count": e.report_count,
            "triggered_at": e.triggered_at.isoformat(),
            "notified": e.notified,
        }
        for e in events
    ]

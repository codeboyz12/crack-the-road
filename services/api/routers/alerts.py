from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from models.alert_zone import AlertZone, AlertEvent
from schemas.detection import AlertZoneCreate, AlertZoneUpdate, AlertZoneOut

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


def _zone_dict(z: AlertZone) -> dict:
    return {
        "id": str(z.id),
        "name": z.name,
        "threshold": z.threshold,
        "window_hours": z.window_hours,
        "severity": z.severity,
        "notify_channels": z.notify_channels,
        "is_active": z.is_active,
    }


@router.get("/zones")
async def list_zones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertZone).order_by(AlertZone.created_at.desc()))
    return [_zone_dict(z) for z in result.scalars().all()]


@router.post("/zones", status_code=201)
async def create_zone(body: AlertZoneCreate, db: AsyncSession = Depends(get_db)):
    zone = AlertZone(**body.model_dump())
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return _zone_dict(zone)


@router.patch("/zones/{zone_id}")
async def update_zone(zone_id: str, body: AlertZoneUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertZone).where(AlertZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(404, "Zone not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(zone, field, value)
    await db.commit()
    await db.refresh(zone)
    return _zone_dict(zone)


@router.delete("/zones/{zone_id}", status_code=204)
async def delete_zone(zone_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertZone).where(AlertZone.id == zone_id))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(404, "Zone not found")
    await db.delete(zone)
    await db.commit()


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

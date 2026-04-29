import json
from datetime import datetime, timedelta
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.config import settings
from models.report import Report
from models.alert_zone import AlertZone, AlertEvent


async def publish_event(channel: str, payload: dict):
    r = aioredis.from_url(settings.redis_url)
    await r.publish(channel, json.dumps(payload))
    await r.aclose()


async def check_alert_thresholds(province: str, db: AsyncSession):
    zones_result = await db.execute(
        select(AlertZone).where(AlertZone.is_active == True)
    )
    zones = zones_result.scalars().all()

    for zone in zones:
        cutoff = datetime.utcnow() - timedelta(hours=zone.window_hours)
        count_result = await db.execute(
            select(func.count()).select_from(Report).where(
                Report.province == province,
                Report.status == "verified",
                Report.reported_at >= cutoff,
            )
        )
        count = count_result.scalar() or 0

        if count >= zone.threshold:
            event = AlertEvent(
                zone_id=zone.id,
                province=province,
                report_count=count,
                triggered_at=datetime.utcnow(),
            )
            db.add(event)
            await db.commit()

            await publish_event("alert.threshold_exceeded", {
                "zone_id": str(zone.id),
                "zone_name": zone.name,
                "province": province,
                "report_count": count,
                "severity": zone.severity,
                "notify_channels": zone.notify_channels,
            })

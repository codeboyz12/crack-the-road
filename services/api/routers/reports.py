import hashlib
import uuid
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import aiofiles

from core.database import get_db
from core.config import settings
from core.security import require_reviewer, get_current_user_role
from models.report import Report, AIDetection
from schemas.report import ReportOut, ReportListOut, ReviewAction
from services.geo_service import reverse_geocode
from services.notification import check_alert_thresholds, publish_event

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}


@router.post("", response_model=ReportOut, status_code=201)
async def create_report(
    lat: float = Form(...),
    lng: float = Form(...),
    source: str = Form("web"),
    address: Optional[str] = Form(None),
    province: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    road_name: Optional[str] = Form(None),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if image.content_type not in ALLOWED_MIME:
        raise HTTPException(400, "Only JPEG/PNG/WebP images are allowed")

    content = await image.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(400, f"Image exceeds {settings.max_upload_size_mb}MB limit")

    image_hash = hashlib.sha256(content).hexdigest()

    existing = await db.execute(select(Report).where(Report.image_hash == image_hash))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Duplicate image: this report already exists")

    filename = f"{uuid.uuid4()}.jpg"
    upload_path = Path(settings.upload_dir) / filename
    os.makedirs(settings.upload_dir, exist_ok=True)
    async with aiofiles.open(upload_path, "wb") as f:
        await f.write(content)

    # Reverse geocode if province not provided
    if not province:
        geo = await reverse_geocode(lat, lng)
        address = address or geo["address"]
        province = province or geo["province"]
        district = district or geo["district"]
        road_name = road_name or geo["road_name"]

    report = Report(
        lat=lat, lng=lng,
        address=address, province=province,
        district=district, road_name=road_name,
        source=source,
        image_path=f"/uploads/{filename}",
        image_hash=image_hash,
        status="pending",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    await publish_event("report.created", {"report_id": str(report.id)})

    return report


@router.get("", response_model=ReportListOut)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    province: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Report)
    if status:
        q = q.where(Report.status == status)
    if province:
        q = q.where(Report.province == province)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = q.order_by(Report.reported_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    return report


@router.patch("/{report_id}/review", response_model=ReportOut)
async def review_report(
    report_id: uuid.UUID,
    body: ReviewAction,
    db: AsyncSession = Depends(get_db),
    _role: str = Depends(require_reviewer),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")

    from datetime import datetime
    report.status = "verified" if body.action == "approve" else "rejected"
    report.reviewed_at = datetime.utcnow()
    report.review_note = body.note
    await db.commit()
    await db.refresh(report)

    if report.status == "verified" and report.province:
        await check_alert_thresholds(report.province, db)

    await publish_event(f"report.{report.status}", {"report_id": str(report.id)})
    return report

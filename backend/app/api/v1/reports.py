"""
Reports endpoints.

- ``POST /v1/reports``  — Citizen weather report submission (public, X-Device-Id required)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import select, func, or_
from pydantic import BaseModel

from app.api.deps import get_db, get_device_id, get_current_admin, get_optional_admin
from app.core.errors import AppError
from app.ingestion.citizen_app import normalize_citizen_report
from app.ingestion.pipeline import ingest_report
from app.models.admin import AdminUser, AuditLog
from app.models.source import CitizenSession, Source
from app.models.report import Report, DuplicateCluster
from app.schemas.common import PaginatedResponse
from app.schemas.reports import ReportResponse, ReportDetailResponse

reports_router = APIRouter(prefix="/reports", tags=["Reports"])


@reports_router.post(
    "",
    status_code=201,
    summary="Submit a citizen weather report",
    description=(
        "Public endpoint for citizen weather report submissions. "
        "Requires the `X-Device-Id` header (anonymous device identifier). "
        "Accepts multipart/form-data with optional photo/video attachments."
    ),
)
async def submit_report(
    event_category: str = Form(..., description="One of: rainfall, thunderstorm, flooding, heatwave, fog, dust_storm, strong_wind"),
    location_method: str = Form(..., description="gps | manual | denied"),
    description: Optional[str] = Form(None, description="Free-text report description"),
    lat: Optional[float] = Form(None, description="Latitude (required if location_method is gps or manual)"),
    lon: Optional[float] = Form(None, description="Longitude (required if location_method is gps or manual)"),
    reported_at: Optional[datetime] = Form(None, description="ISO 8601 timestamp (defaults to server receipt time)"),
    media: list[UploadFile] = File(default=[]),
    session: CitizenSession = Depends(get_device_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Validate, normalize, and ingest a citizen weather report."""

    # Read uploaded file bytes
    media_files = []
    for upload in media:
        file_bytes = await upload.read()
        if file_bytes:
            media_files.append(
                {
                    "file_bytes": file_bytes,
                    "filename": upload.filename or f"upload_{uuid.uuid4()}",
                    "content_type": upload.content_type or "application/octet-stream",
                }
            )

    # Map to CanonicalReport (raises AppError on validation failure)
    canonical = normalize_citizen_report(
        event_category=event_category,
        description=description,
        lat=lat,
        lon=lon,
        location_method=location_method,
        reported_at=reported_at,
        media_files=media_files,
        device_id=session.device_id,
    )

    # Run the full pipeline: DLQ, idempotency, DB persistence, Redis stream
    report, result = await ingest_report(canonical, db)

    # Immediately serialize and publish to the raw.citizen Kafka topic
    if result.report_id:
        try:
            from app.services.kafka_service import kafka_service
            from app.core.config import settings
            kafka_payload = {
                "report_id": result.report_id,
                "device_id": session.device_id,
                "event_category": event_category,
                "description": description,
                "lat": lat,
                "lon": lon,
                "location_method": location_method,
                "status": "pending",
                "reported_at": (reported_at or datetime.now(timezone.utc)).isoformat() if hasattr(datetime, "now") else str(reported_at),
                "source": "citizen_app",
            }
            await kafka_service.publish_message(
                topic=settings.KAFKA_TOPIC_RAW_CITIZEN,
                key=result.report_id,
                value=kafka_payload,
            )
        except Exception as exc:
            pass

    if result.status == "dead_letter":
        return {
            "id": result.dead_letter_id,
            "status": "failed",
            "message": "Report could not be processed and has been logged for review.",
        }

    if result.status == "duplicate_skipped":
        return {
            "id": result.report_id,
            "status": "pending",
            "message": "Report already received.",
        }

    return {
        "id": result.report_id,
        "status": "pending",
        "message": "Report received and queued for verification.",
    }


class BatchSyncReportItem(BaseModel):
    client_report_id: str
    event_category: str
    description: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    location_method: str = "gps"
    reported_at: Optional[datetime] = None
    media_urls: Optional[list[str]] = None


class BatchSyncRequest(BaseModel):
    reports: list[BatchSyncReportItem]


class BatchSyncResponse(BaseModel):
    synced_count: int
    skipped_count: int
    synced_ids: list[str]
    skipped_ids: list[str]


@reports_router.post(
    "/batch-sync",
    response_model=BatchSyncResponse,
    status_code=200,
    summary="Batch sync offline reports (PWA offline sync)",
    description=(
        "Public endpoint accepting a JSON array of reports collected offline. "
        "Requires the `X-Device-Id` header. "
        "Enforces idempotency using `client_report_id` to prevent duplicate inserts."
    ),
)
async def batch_sync_reports(
    payload: list[BatchSyncReportItem] | BatchSyncRequest,
    session: CitizenSession = Depends(get_device_id),
    db: AsyncSession = Depends(get_db),
) -> BatchSyncResponse:
    """Synchronize offline PWA reports with idempotency enforcement on client_report_id."""
    report_items = payload.reports if isinstance(payload, BatchSyncRequest) else payload

    # Ensure a source record for citizen_app exists
    source_stmt = select(Source).where(Source.platform == "citizen_app")
    source = (await db.execute(source_stmt)).scalars().first()
    if not source:
        source = Source(platform="citizen_app", handle=session.device_id)
        db.add(source)
        await db.flush()

    synced_ids: list[str] = []
    skipped_ids: list[str] = []

    for item in report_items:
        # Check idempotency: if report with this client_report_id exists, skip
        check_stmt = select(Report).where(
            Report.source_native_id == item.client_report_id,
            or_(Report.citizen_session_id == session.id, Report.source_id == source.id),
        )
        existing = (await db.execute(check_stmt)).scalars().first()
        if existing:
            skipped_ids.append(item.client_report_id)
            continue

        report_id = uuid.uuid4()
        location_wkt = None
        if item.lat is not None and item.lon is not None:
            location_wkt = f"SRID=4326;POINT({item.lon} {item.lat})"

        rep_time = item.reported_at or datetime.now(timezone.utc)
        new_report = Report(
            id=report_id,
            source_id=source.id,
            citizen_session_id=session.id,
            source_native_id=item.client_report_id,
            raw_text=item.description,
            clean_text=item.description.strip() if item.description else None,
            event_category=item.event_category,
            status="pending",
            reported_at=rep_time,
            ingested_at=datetime.now(timezone.utc),
            location=location_wkt,
        )
        db.add(new_report)
        await db.flush()

        # Save media item references if provided
        if item.media_urls:
            from app.models.report import MediaItem
            for url in item.media_urls:
                db.add(
                    MediaItem(
                        report_id=new_report.id,
                        media_type="image",
                        storage_url=url,
                    )
                )

        # Publish immediately to raw.citizen Kafka topic
        try:
            from app.services.kafka_service import kafka_service
            from app.core.config import settings
            await kafka_service.publish_message(
                topic=settings.KAFKA_TOPIC_RAW_CITIZEN,
                key=str(new_report.id),
                value={
                    "report_id": str(new_report.id),
                    "client_report_id": item.client_report_id,
                    "device_id": session.device_id,
                    "event_category": item.event_category,
                    "description": item.description,
                    "lat": item.lat,
                    "lon": item.lon,
                    "status": "pending",
                    "source": "citizen_app_batch_sync",
                },
            )
        except Exception:
            pass

        synced_ids.append(str(new_report.id))

    await db.commit()

    return BatchSyncResponse(
        synced_count=len(synced_ids),
        skipped_count=len(skipped_ids),
        synced_ids=synced_ids,
        skipped_ids=skipped_ids,
    )



@reports_router.get(
    "",
    response_model=PaginatedResponse[ReportResponse],
    summary="List all reports (Admin)",
)
async def list_reports(
    status: Optional[str] = Query(None),
    event_category: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    source_platform: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: str = Query("recency_desc"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: Optional[AdminUser] = Depends(get_optional_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Report).options(joinedload(Report.source), selectinload(Report.media_items))

    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if len(statuses) == 1:
            stmt = stmt.where(Report.status == statuses[0])
        else:
            stmt = stmt.where(Report.status.in_(statuses))
    if event_category:
        stmt = stmt.where(Report.event_category == event_category)
    if state:
        stmt = stmt.where(Report.state == state)
    if city:
        stmt = stmt.where(Report.city == city)
    if region:
        stmt = stmt.where(Report.region == region)
    if date_from:
        stmt = stmt.where(Report.reported_at >= date_from)
    if date_to:
        stmt = stmt.where(Report.reported_at <= date_to)
    if source_platform:
        stmt = stmt.where(Report.source.has(platform=source_platform))
    if q:
        stmt = stmt.where(or_(
            Report.clean_text.ilike(f"%{q}%"),
            Report.raw_location_text.ilike(f"%{q}%")
        ))
    
    if sort == "confidence_asc":
        stmt = stmt.order_by(Report.p_misleading.desc().nullslast(), Report.ingested_at.desc())
    else:
        stmt = stmt.order_by(Report.ingested_at.desc())
    
    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.limit(limit).offset(offset)
    result = await db.scalars(stmt)
    items = result.all()
    
    return {"results": items, "total": total, "limit": limit, "offset": offset}


@reports_router.get(
    "/mine",
    response_model=PaginatedResponse[ReportResponse],
    summary="Citizen report history",
)
async def list_my_reports(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: CitizenSession = Depends(get_device_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Report).options(joinedload(Report.source), selectinload(Report.media_items))
    stmt = stmt.where(Report.citizen_session_id == session.id)
    stmt = stmt.order_by(Report.reported_at.desc())
    
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.limit(limit).offset(offset)
    result = await db.scalars(stmt)
    items = result.all()
    
    return {"results": items, "total": total, "limit": limit, "offset": offset}


@reports_router.get(
    "/{report_id}",
    response_model=ReportDetailResponse,
    summary="Get report details (Admin)",
)
async def get_report(
    report_id: uuid.UUID,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Report).options(
        joinedload(Report.source),
        selectinload(Report.media_items),
        selectinload(Report.duplicate_cluster).selectinload(DuplicateCluster.members)
    ).where(Report.id == report_id)
    
    report = (await db.scalars(stmt)).first()
    if not report:
        raise AppError(status_code=404, code="not_found", message="Report not found")
        
    return report


class RejectRequest(BaseModel):
    reason: Optional[str] = None


@reports_router.post("/{report_id}/verify")
async def verify_report(
    report_id: uuid.UUID,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise AppError(status_code=404, code="not_found", message="Report not found")
    
    report.status = "verified"
    
    audit = AuditLog(
        admin_user_id=admin.id,
        action="verify_report",
        target_type="report",
        target_id=report.id,
    )
    db.add(audit)
    await db.commit()
    
    return {"id": str(report.id), "status": "verified"}


@reports_router.post("/{report_id}/reject")
async def reject_report(
    report_id: uuid.UUID,
    payload: RejectRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise AppError(status_code=404, code="not_found", message="Report not found")
    
    report.status = "rejected"
    
    details = {}
    if payload.reason:
        details["reason"] = payload.reason
        
    audit = AuditLog(
        admin_user_id=admin.id,
        action="reject_report",
        target_type="report",
        target_id=report.id,
        details=details if details else None
    )
    db.add(audit)
    await db.commit()
    
    return {"id": str(report.id), "status": "rejected"}


class BulkActionRequest(BaseModel):
    report_ids: list[uuid.UUID]
    action: str


@reports_router.post("/bulk-action")
async def bulk_action_reports(
    payload: BulkActionRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if payload.action not in ["verify", "reject"]:
        raise AppError(status_code=400, code="invalid_action", message="Action must be verify or reject")
        
    stmt = select(Report).where(Report.id.in_(payload.report_ids))
    reports = (await db.scalars(stmt)).all()
    
    new_status = "verified" if payload.action == "verify" else "rejected"
    action_type = "verify_report" if payload.action == "verify" else "reject_report"
    
    updated_count = 0
    for r in reports:
        r.status = new_status
        audit = AuditLog(
            admin_user_id=admin.id,
            action=action_type,
            target_type="report",
            target_id=r.id,
        )
        db.add(audit)
        updated_count += 1
        
    await db.commit()
    return {"updated": updated_count}

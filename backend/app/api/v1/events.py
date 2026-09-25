from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func, or_, desc, asc

from app.api.deps import get_db, get_current_admin, get_optional_admin
from app.core.errors import AppError
from app.models.admin import AdminUser, AuditLog
from app.models.event import Event, EventLifecycleLog, EventReportMap, SensorReading
from app.models.report import Report, DuplicateCluster, MediaItem
from app.schemas.common import PaginatedResponse
from app.schemas.events import (
    EventResponse, 
    EventDetailResponse, 
    EventEvidenceSchema, 
    OfficialSensorEvidence,
    LifecycleTransitionSchema
)
from app.schemas.reports import ReportResponse

events_router = APIRouter(prefix="/events", tags=["Events"])

@events_router.get(
    "",
    response_model=PaginatedResponse[EventResponse],
    summary="List events (Public/Admin)",
)
async def list_events(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None, description="Comma-separated list"),
    region: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    min_confidence: Optional[float] = Query(None),
    q: Optional[str] = Query(None),
    bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat"),
    lat: Optional[float] = Query(None, description="Center latitude for radial search"),
    lon: Optional[float] = Query(None, description="Center longitude for radial search"),
    radius_km: Optional[float] = Query(None, description="Search radius in kilometers (default 25km)"),
    sort: str = Query("recency_desc"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: AdminUser | None = Depends(get_optional_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Event)

    # Public Guard & Data Scoping:
    # If accessed without authentication, the API MUST force a database query filter
    # where lifecycle_status IN ('confirmed', 'active'). It must ignore any other status
    # requested by a guest so they cannot leak pending/emerging/detected events.
    if not admin:
        if status in ("confirmed", "active"):
            stmt = stmt.where(Event.lifecycle_status == status)
        else:
            stmt = stmt.where(Event.lifecycle_status.in_(["confirmed", "active"]))
    else:
        # Admins using the token bypass this restriction and can query any status
        if status:
            stmt = stmt.where(Event.lifecycle_status == status)

    if category:
        stmt = stmt.where(Event.category == category)
    if severity:
        severities = [s.strip() for s in severity.split(",")]
        stmt = stmt.where(Event.severity.in_(severities))
    if region:
        stmt = stmt.where(Event.region == region)
    if state:
        stmt = stmt.where(Event.state == state)
    if city:
        stmt = stmt.where(Event.city == city)
    if date_from:
        stmt = stmt.where(Event.detected_at >= date_from)
    if date_to:
        stmt = stmt.where(Event.detected_at <= date_to)
    if min_confidence is not None:
        stmt = stmt.where(Event.confidence >= min_confidence)
    if q:
        stmt = stmt.where(or_(
            Event.title.ilike(f"%{q}%"),
            Event.city.ilike(f"%{q}%"),
            Event.state.ilike(f"%{q}%"),
        ))
    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(","))
            stmt = stmt.where(func.ST_Intersects(
                Event.centroid,
                func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
            ))
        except ValueError:
            raise AppError(status_code=400, code="invalid_bbox", message="bbox must be minLon,minLat,maxLon,maxLat")

    if lat is not None and lon is not None:
        radius_meters = (radius_km or 25.0) * 1000.0
        stmt = stmt.where(
            func.ST_DWithin(
                Event.centroid,
                func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                radius_meters,
            )
        )

    if sort == "confidence_desc":
        stmt = stmt.order_by(Event.confidence.desc(), Event.detected_at.desc())
    elif sort == "confidence_asc":
        stmt = stmt.order_by(Event.confidence.asc(), Event.detected_at.desc())
    else:
        stmt = stmt.order_by(Event.detected_at.desc())
    
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.limit(limit).offset(offset)
    result = await db.scalars(stmt)
    items = result.all()
    
    return {"results": items, "total": total, "limit": limit, "offset": offset}


@events_router.get(
    "/{event_id}",
    response_model=EventDetailResponse,
    summary="Get event detail",
)
async def get_event(
    event_id: uuid.UUID,
    admin: AdminUser | None = Depends(get_optional_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Event).where(Event.id == event_id)
    event = (await db.scalars(stmt)).first()
    
    if not event:
        raise AppError(status_code=404, code="not_found", message="Event not found")
        
    if not admin and event.lifecycle_status not in ["confirmed", "active"]:
        raise AppError(status_code=404, code="not_found", message="Event not found")

    # Fetch evidence aggregate
    # Official sensor
    sensor_stmt = select(SensorReading).where(SensorReading.corroborates_event_id == event.id).limit(1)
    sensor = (await db.scalars(sensor_stmt)).first()
    
    official_sensor = OfficialSensorEvidence(
        present=sensor is not None,
        station_id=sensor.station_id if sensor else None,
        rainfall_mm=sensor.rainfall_mm if sensor else None
    )
    
    # Reports mapped
    reports_stmt = select(Report).join(EventReportMap).options(
        selectinload(Report.source),
        selectinload(Report.media_items),
        selectinload(Report.duplicate_cluster).selectinload(DuplicateCluster.members)
    ).where(EventReportMap.event_id == event.id)
    
    reports = (await db.scalars(reports_stmt)).all()
    
    unique_photos = sum(1 for r in reports for m in r.media_items if m.media_type == "image")
    news_articles = sum(1 for r in reports if r.source and r.source.platform == "news")
    duplicate_merged = sum(
        (r.duplicate_cluster.member_count - 1) if r.duplicate_cluster else 0
        for r in reports
    )
    
    evidence = EventEvidenceSchema(
        official_sensor=official_sensor,
        independent_reports=len(reports),
        unique_photos=unique_photos,
        duplicate_reports_merged=duplicate_merged,
        news_articles=news_articles
    )
    
    # Construct response
    response_data = EventDetailResponse.model_validate(event)
    response_data.evidence = evidence
    
    if admin:
        history_stmt = select(EventLifecycleLog).where(EventLifecycleLog.event_id == event.id).order_by(EventLifecycleLog.transitioned_at.asc())
        history = (await db.scalars(history_stmt)).all()
        response_data.lifecycle_history = [
            LifecycleTransitionSchema.model_validate(h) for h in history
        ]
        
        response_data.reports = [
            ReportResponse.model_validate(r) for r in reports
        ]
    else:
        # Guests receive ONLY aggregate top-level fields (no underlying report arrays or transitions)
        response_data.reports = None
        response_data.lifecycle_history = None
        
    return response_data


@events_router.post("/{event_id}/verify")
async def verify_event(
    event_id: uuid.UUID,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise AppError(status_code=404, code="not_found", message="Event not found")
        
    event.lifecycle_status = "confirmed"
    event.last_updated_at = datetime.now(timezone.utc)
    
    transition = EventLifecycleLog(
        event_id=event.id,
        from_status=event.lifecycle_status,
        to_status="confirmed",
        trigger_reason="manual admin override"
    )
    db.add(transition)
    
    audit = AuditLog(
        admin_user_id=admin.id,
        action="verify_event",
        target_type="event",
        target_id=event.id,
    )
    db.add(audit)
    await db.commit()
    
    return {"id": str(event.id), "status": "confirmed"}


@events_router.post("/{event_id}/reject")
async def reject_event(
    event_id: uuid.UUID,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise AppError(status_code=404, code="not_found", message="Event not found")
        
    event.lifecycle_status = "resolved"
    event.resolved_at = datetime.now(timezone.utc)
    event.last_updated_at = datetime.now(timezone.utc)
    
    transition = EventLifecycleLog(
        event_id=event.id,
        from_status=event.lifecycle_status,
        to_status="resolved",
        trigger_reason="admin marked invalid/false positive"
    )
    db.add(transition)
    
    audit = AuditLog(
        admin_user_id=admin.id,
        action="reject_event",
        target_type="event",
        target_id=event.id,
    )
    db.add(audit)
    await db.commit()
    
    return {"id": str(event.id), "status": "resolved"}


from pydantic import BaseModel
class MergeRequest(BaseModel):
    with_event_id: uuid.UUID

@events_router.post("/{event_id}/merge")
async def merge_event(
    event_id: uuid.UUID,
    payload: MergeRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # This logic assumes simple migration of reports.
    # Recomputing the full confidence & severity requires the fusion logic.
    # To keep it within API bounds, we'll reassign the report maps and let the next async worker pass handle centroid if needed, 
    # OR we can manually invoke the fusion orchestrator for the target event.
    
    source_event = await db.get(Event, event_id)
    target_event = await db.get(Event, payload.with_event_id)
    
    if not source_event or not target_event:
        raise AppError(status_code=404, code="not_found", message="Event not found")
        
    # Move reports mapping
    stmt = select(EventReportMap).where(EventReportMap.event_id == source_event.id)
    mappings = (await db.scalars(stmt)).all()
    
    moved_count = 0
    for m in mappings:
        # Check if already linked
        check_stmt = select(EventReportMap).where(
            EventReportMap.event_id == target_event.id,
            EventReportMap.report_id == m.report_id
        )
        existing = (await db.scalars(check_stmt)).first()
        if not existing:
            new_map = EventReportMap(event_id=target_event.id, report_id=m.report_id, linked_at=datetime.now(timezone.utc))
            db.add(new_map)
            moved_count += 1
        await db.delete(m)
        
    source_event.lifecycle_status = "resolved"
    source_event.resolved_at = datetime.now(timezone.utc)
    
    transition = EventLifecycleLog(
        event_id=source_event.id,
        from_status=source_event.lifecycle_status,
        to_status="resolved",
        trigger_reason=f"merged into event {target_event.id}"
    )
    db.add(transition)
    
    audit = AuditLog(
        admin_user_id=admin.id,
        action="merge_event",
        target_type="event",
        target_id=source_event.id,
        details={"merged_into": str(target_event.id)}
    )
    db.add(audit)
    
    # Fire the fusion orchestrator to recompute centroid, confidence, severity for target_event
    # For now, just increment independent count
    target_event.independent_source_count += source_event.independent_source_count
    
    await db.commit()
    
    return {"merged_into": str(target_event.id), "reports_moved": moved_count}


class EscalateRequest(BaseModel):
    note: Optional[str] = None

@events_router.post("/{event_id}/escalate")
async def escalate_event(
    event_id: uuid.UUID,
    payload: EscalateRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise AppError(status_code=404, code="not_found", message="Event not found")
        
    details = {}
    if payload.note:
        details["note"] = payload.note
        
    audit = AuditLog(
        admin_user_id=admin.id,
        action="escalate_event",
        target_type="event",
        target_id=event.id,
        details=details if details else None
    )
    db.add(audit)
    await db.commit()
    
    return {"id": str(event.id), "escalated": True}

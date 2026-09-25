"""
Spatiotemporal clustering of reports into canonical Events.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select, literal
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import Geography

from app.core.constants import get_indian_region
from app.models.event import Event, EventLifecycleLog, EventReportMap
from app.models.report import Report

logger = logging.getLogger("skygrid.fusion.clustering")

# Configurable clustering defaults
CLUSTER_RADIUS_METERS = 25000.0  # 25 km
CLUSTER_TIME_HOURS = 6.0


async def cluster_report_spatiotemporally(
    report: Report, db: AsyncSession, radius: float = CLUSTER_RADIUS_METERS, time_window: float = CLUSTER_TIME_HOURS
) -> tuple[Event, bool]:
    """
    Cluster a new report into an existing Event, or create a new Event if none matches.

    Returns:
        tuple[Event, bool]: The fused Event and a boolean (True if newly created).
    """
    # Time bounds
    reported_at = report.reported_at or datetime.now(timezone.utc)
    earliest_time = reported_at - timedelta(hours=time_window)
    latest_time = reported_at + timedelta(hours=time_window)

    if not report.location:
        if report.city and report.state:
            text_stmt = (
                select(Event)
                .where(
                    Event.lifecycle_status != "resolved",
                    Event.category == report.event_category,
                    Event.last_updated_at >= earliest_time,
                    Event.last_updated_at <= latest_time,
                    Event.city == report.city,
                    Event.state == report.state
                )
                .order_by(Event.last_updated_at.desc())
                .limit(1)
            )
            event = (await db.execute(text_stmt)).scalar_one_or_none()
            if not event:
                report.status = "under_review"
                logger.warning("Report %s lacks location and no text match found; flagged for review.", report.id)
                return None, False
        else:
            report.status = "under_review"
            logger.warning("Report %s lacks location and city/state; flagged for review.", report.id)
            return None, False
    else:
        # 1. Spatial candidate matching
        # Find closest active event of same category within time window and radius
        stmt = (
            select(Event)
            .where(
                Event.lifecycle_status != "resolved",
                Event.category == report.event_category,
                Event.last_updated_at >= earliest_time,
                Event.last_updated_at <= latest_time,
                func.ST_DWithin(Event.centroid, report.location, radius),
            )
            .order_by(func.ST_Distance(Event.centroid, report.location))
            .limit(1)
        )
        result = await db.execute(stmt)
        event = result.scalar_one_or_none()

    is_new = False

    if event:
        # Match found: update existing event
        logger.info("Report %s clustered into existing Event %s", report.id, event.id)
        
        # Link report
        db.add(EventReportMap(event_id=event.id, report_id=report.id))
        await db.flush()

        # Recalculate centroid from all linked reports
        # ST_Centroid(ST_Collect(location::geometry))::geography
        # First gather the geometry from all reports mapped to this event.
        centroid_stmt = (
            select(
                func.ST_SetSRID(
                    func.ST_Centroid(
                        func.ST_Collect(func.ST_GeomFromWKB(Report.location))
                    ),
                    4326
                ).cast(Geography)
            )
            .select_from(Report)
            .join(EventReportMap, EventReportMap.report_id == Report.id)
            .where(
                EventReportMap.event_id == event.id,
                Report.location.is_not(None)
            )
        )
        new_centroid = await db.scalar(centroid_stmt)
        if new_centroid is not None:
            event.centroid = func.ST_GeographyFromText(func.ST_AsText(new_centroid))
        
        event.last_updated_at = datetime.now(timezone.utc)
    else:
        # No match: create new event
        is_new = True
        logger.info("Report %s spawned new Event", report.id)

        city = report.city or "Regional"
        title = f"{report.event_category.replace('_', ' ').title()} — {city}"
        region = report.region or get_indian_region(report.state or "")

        event = Event(
            title=title,
            category=report.event_category,
            centroid=report.location,
            city=report.city,
            state=report.state,
            region=region,
            severity="moderate",  # Placeholder
            confidence=0.5,       # Initial score
            lifecycle_status="detected",
            detected_at=reported_at,
            last_updated_at=datetime.now(timezone.utc),
        )
        db.add(event)
        await db.flush()

        # Link report
        db.add(EventReportMap(event_id=event.id, report_id=report.id))
        
        # Insert initial lifecycle log
        db.add(
            EventLifecycleLog(
                event_id=event.id,
                from_status=None,
                to_status="detected",
                trigger_reason="Initial event detection from report",
            )
        )
        await db.flush()

    return event, is_new

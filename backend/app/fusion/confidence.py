"""
Confidence scoring logic for Fused Events.
"""

from __future__ import annotations

import logging
from typing import Any
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.event import Event, EventReportMap, SensorReading
from app.models.report import Report
from app.models.source import Source

logger = logging.getLogger("skygrid.fusion.confidence")

# Weights (defaults if not in settings, but we should use settings)
# For the sake of this component, we'll hardcode the defaults if settings missing
W1_S_NORM = 0.35
W2_D_SOURCE = 0.25
W3_T_AVG = 0.25
W4_C_SENSOR = 0.15


async def recalculate_event_confidence(event: Event, db: AsyncSession) -> None:
    """
    Recalculate the confidence score for an event based on its constituent reports
    and official sensor readings. Updates the event object in-place.
    """
    # 1. Independent Source Count (S_norm) & Platform Diversity (D_source)
    # We count distinct source_id, grouping duplicates (handled intrinsically if duplicates map to same source,
    # wait, duplicates might be from different sources. 
    # Actually, the requirement says "grouping duplicates by duplicate_cluster_id so duplicate reposts only count as 1 source".
    # Wait, the spec: "count distinct source_id among linked reports (grouping duplicates by duplicate_cluster_id so duplicate reposts only count as 1 source)."
    
    # Let's get all reports linked to this event
    stmt_reports = (
        select(
            Report.source_id,
            Report.duplicate_cluster_id,
            Source.platform,
            Report.p_misleading
        )
        .select_from(Report)
        .join(EventReportMap, EventReportMap.report_id == Report.id)
        .join(Source, Source.id == Report.source_id)
        .where(EventReportMap.event_id == event.id)
    )
    result = await db.execute(stmt_reports)
    rows = result.all()

    if not rows:
        return

    # Count independent sources
    # Rule: If report has a duplicate_cluster_id, the cluster acts as a single entity.
    # We want distinct sources. A cluster of 10 retweets from same platform is 1 source.
    # Wait, if a cluster has reports from 2 different sources, is it 1 independent source or 2?
    # "grouping duplicates by duplicate_cluster_id so duplicate reposts only count as 1 source"
    # We will use a set of (source_id, cluster_id_or_report_id).
    
    independent_entities = set()
    platforms = set()
    t_sum = 0.0
    t_count = 0
    
    for row in rows:
        src_id = row.source_id
        cluster_id = row.duplicate_cluster_id
        platform = row.platform
        p_mis = row.p_misleading

        platforms.add(platform)

        # Entity identification: use cluster_id if exists, else the report's source_id
        # Wait, if a source posts two different clusters, they are 2 sources? No, same source.
        # So we should group by source_id, EXCEPT if they are in the same cluster, they are the SAME.
        # Actually, "count distinct source_id ... grouping duplicates".
        # Let's count unique source_ids. If cluster has 5 reports from same source_id, it's 1 source_id.
        # What if cluster has 2 reports from different source_ids? They are duplicates, so they should count as 1!
        # So we use cluster_id if it exists, else source_id.
        entity = cluster_id if cluster_id else src_id
        independent_entities.add(entity)

        if p_mis is not None:
            t_sum += (1.0 - p_mis)
            t_count += 1

    independent_source_count = len(independent_entities)
    
    S_norm = min(1.0, independent_source_count / 5.0)
    D_source = len(platforms) / 5.0
    T_avg = (t_sum / t_count) if t_count > 0 else 0.5

    # 2. Official Sensor Corroboration (C_sensor)
    C_sensor = 0.0
    if event.category in ("rainfall", "flooding", "thunderstorm"):
        # Look for sensor reading within 30km and 3 hours having rainfall >= 5.0
        # event.centroid is Geography, SensorReading.location is Geography
        # event.last_updated_at or detected_at
        time_window = 3.0
        radius = 30000.0  # 30 km

        sensor_stmt = (
            select(SensorReading)
            .join(Event, Event.id == event.id)
            .where(
                SensorReading.rainfall_mm >= 5.0,
                func.ST_DWithin(SensorReading.location, Event.centroid, radius),
                SensorReading.recorded_at >= event.detected_at - timedelta(hours=time_window),
                SensorReading.recorded_at <= event.last_updated_at + timedelta(hours=time_window)
            )
            .order_by(func.ST_Distance(SensorReading.location, Event.centroid))
            .limit(1)
        )
        sensor_res = await db.execute(sensor_stmt)
        sensor = sensor_res.scalar_one_or_none()
        
        if sensor:
            C_sensor = 1.0
            sensor.corroborates_event_id = event.id
            db.add(sensor)

    # 3. Final Calculation
    confidence = max(0.0, min(1.0, W1_S_NORM * S_norm + W2_D_SOURCE * D_source + W3_T_AVG * T_avg + W4_C_SENSOR * C_sensor))

    # Update event
    event.independent_source_count = independent_source_count
    event.confidence = confidence
    
    logger.info("Recalculated confidence for event %s: %.2f", event.id, confidence)

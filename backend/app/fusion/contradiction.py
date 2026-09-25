"""
Contradiction detection for Fused Events based on sensor ground truth.
"""

from __future__ import annotations

import logging
from typing import Any
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, SensorReading

logger = logging.getLogger("skygrid.fusion.contradiction")


async def evaluate_event_contradictions(event: Event, db: AsyncSession) -> None:
    """
    Evaluate if ground truth sensors contradict the fused reports.
    Updates event.has_contradiction in-place.
    """
    if event.lifecycle_status == "resolved":
        return

    # Look for nearest sensor within 25km and 3 hours
    radius = 25000.0
    time_window = 3.0

    stmt = (
        select(SensorReading)
        .join(Event, Event.id == event.id)
        .where(
            func.ST_DWithin(SensorReading.location, Event.centroid, radius),
            SensorReading.recorded_at >= event.detected_at - timedelta(hours=time_window),
            SensorReading.recorded_at <= event.last_updated_at + timedelta(hours=time_window)
        )
        .order_by(func.ST_Distance(SensorReading.location, Event.centroid))
        .limit(1)
    )
    result = await db.execute(stmt)
    sensor = result.scalar_one_or_none()

    if not sensor:
        event.has_contradiction = False
        return

    # Contradiction Logic
    is_water_event = event.category in ("flooding", "rainfall", "thunderstorm")
    has_contradiction = False

    if is_water_event and event.independent_source_count >= 3:
        if sensor.rainfall_mm is not None and sensor.rainfall_mm < 0.2:
            # Lots of water reports, but sensor says dry
            has_contradiction = True

    if not is_water_event:
        if sensor.rainfall_mm is not None and sensor.rainfall_mm >= 50.0:
            # Sensor says extreme rain, but event is heatwave/fog/dust storm, etc.
            has_contradiction = True

    event.has_contradiction = has_contradiction
    
    if has_contradiction:
        logger.warning("Contradiction flagged for Event %s based on sensor %s", event.id, sensor.id)

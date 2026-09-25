"""
Baseline Severity Evaluation.

Calculates the geographic spread of an event and applies deterministic threshold rules
to classify an event into 'low', 'moderate', 'high', or 'critical' severity.
"""

from __future__ import annotations

import itertools
import math
from typing import Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event, EventReportMap, SensorReading
from app.models.report import Report


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth surface in km."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def calculate_baseline_severity(event: Event, db: AsyncSession) -> str:
    """
    Calculate the baseline severity based on report volume, geographic spread, 
    authoritative sources, and sensor corroboration.
    """
    # 1. Calculate Geographic Spread (in km)
    # Fetch all raw lat/lon coordinates from linked reports
    from geoalchemy2 import Geometry
    stmt = (
        select(func.ST_Y(func.cast(Report.location, Geometry)), func.ST_X(func.cast(Report.location, Geometry)))
        .select_from(Report)
        .join(EventReportMap, EventReportMap.report_id == Report.id)
        .where(
            EventReportMap.event_id == event.id,
            Report.location.is_not(None)
        )
    )
    coords = (await db.execute(stmt)).all()

    geographic_spread_km = 0.0
    if len(coords) > 1:
        geographic_spread_km = max(
            _haversine(lat1, lon1, lat2, lon2) 
            for (lat1, lon1), (lat2, lon2) in itertools.combinations(coords, 2)
        )

    # 2. Check for authoritative sources
    stmt_auth = (
        select(Report.id)
        .select_from(Report)
        .join(EventReportMap, EventReportMap.report_id == Report.id)
        .join(Report.source)
        .where(
            EventReportMap.event_id == event.id,
            Report.source.has(platform="imd_official")
        )
        .limit(1)
    )
    has_authoritative = (await db.execute(stmt_auth)).scalar_one_or_none() is not None

    # 3. Check for extreme rainfall corroboration
    stmt_sensor = (
        select(SensorReading.id)
        .where(
            SensorReading.corroborates_event_id == event.id,
            SensorReading.rainfall_mm >= 75.0
        )
        .limit(1)
    )
    has_extreme_rainfall = (await db.execute(stmt_sensor)).scalar_one_or_none() is not None

    # 4. Apply threshold logic
    count = event.independent_source_count

    # Critical thresholds
    if count >= 10 and geographic_spread_km >= 15.0:
        return "critical"
    if event.category in ("flooding", "thunderstorm") and count >= 6 and geographic_spread_km >= 5.0:
        return "critical"
    if has_extreme_rainfall:
        return "critical"

    # High thresholds
    if count >= 5:
        return "high"
    if geographic_spread_km >= 8.0:
        return "high"
    if event.category in ("flooding", "thunderstorm", "dust_storm") and count >= 3:
        return "high"

    # Moderate thresholds
    if count >= 2:
        return "moderate"
    if has_authoritative:
        return "moderate"

    # Low threshold
    return "low"

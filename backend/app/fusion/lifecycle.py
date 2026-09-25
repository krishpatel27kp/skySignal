"""
Lifecycle state machine for Events, including event transitions and time-based decay.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.event import Event, EventLifecycleLog, SensorReading

logger = logging.getLogger("skygrid.fusion.lifecycle")

REDIS_PUB_SUB_CHANNEL = "channel:events:live"


async def _publish_event_update(event: Event, action: str) -> None:
    """Publish live update to Redis Pub/Sub for the SSE endpoint."""
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        
        if action == "event_created":
            payload = {
                "event": "event_created",
                "id": str(event.id),
                "title": event.title,
                "severity": event.severity
            }
        else:
            payload = {
                "event": "event_updated",
                "id": str(event.id),
                "lifecycle_status": event.lifecycle_status,
                "confidence": event.confidence
            }
            
        await r.publish(REDIS_PUB_SUB_CHANNEL, json.dumps(payload))
        await r.aclose()
    except Exception as exc:
        logger.warning("Failed to publish to Redis Pub/Sub: %s", exc)


async def evaluate_lifecycle_transitions(event: Event, db: AsyncSession, trigger_reason: str = "") -> None:
    """
    Evaluate transitions based on new reports and confidence metrics.
    Updates event status, writes audit log, and publishes to Redis.
    """
    original_status = event.lifecycle_status
    new_status = original_status
    
    # Check for linked sensor readings to represent C_sensor == 1.0
    stmt = select(SensorReading).where(SensorReading.corroborates_event_id == event.id).limit(1)
    has_sensor = (await db.scalar(stmt)) is not None

    if event.independent_source_count >= 3 or has_sensor:
        if original_status in ("detected", "emerging"):
            new_status = "confirmed"
    elif event.independent_source_count >= 2:
        if original_status == "detected":
            new_status = "emerging"

    if new_status == "confirmed" or original_status == "confirmed":
        # Reports continue arriving within a 2-hour window
        # Meaning the event duration (last_updated_at - detected_at) is >= 2 hours
        # Or, just any new report after 2 hours
        duration_hours = (event.last_updated_at - event.detected_at).total_seconds() / 3600.0
        if duration_hours >= 2.0:
            new_status = "active"

    if original_status == "declining":
        # "a new report links to an event currently in declining status"
        new_status = "active"

    if new_status != original_status:
        logger.info("Event %s transitioned %s -> %s", event.id, original_status, new_status)
        event.lifecycle_status = new_status
        db.add(
            EventLifecycleLog(
                event_id=event.id,
                from_status=original_status,
                to_status=new_status,
                trigger_reason=trigger_reason or "Report arrival triggered state progression",
            )
        )
        await _publish_event_update(event, "event_updated")


async def evaluate_time_based_decays(db: AsyncSession) -> None:
    """
    Celery beat task function to evaluate decays for all active/declining events.
    active -> declining (>= 4 hours since last report)
    declining -> resolved (>= 12 hours since last report)
    """
    now = datetime.now(timezone.utc)
    
    stmt = select(Event).where(Event.lifecycle_status.in_(["active", "declining", "emerging", "confirmed", "detected"]))
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    for event in events:
        hours_since_last_report = (now - event.last_updated_at).total_seconds() / 3600.0
        original_status = event.lifecycle_status
        new_status = original_status
        reason = ""
        
        if original_status in ("detected", "emerging", "confirmed", "active"):
            if hours_since_last_report >= 4.0:
                new_status = "declining"
                reason = "No new reports for 4+ hours"
                
        if new_status == "declining" or original_status == "declining":
            if hours_since_last_report >= 12.0:
                new_status = "resolved"
                event.resolved_at = now
                reason = "No new reports for 12+ hours"
                
        if new_status != original_status:
            logger.info("Event %s decayed %s -> %s", event.id, original_status, new_status)
            event.lifecycle_status = new_status
            db.add(
                EventLifecycleLog(
                    event_id=event.id,
                    from_status=original_status,
                    to_status=new_status,
                    trigger_reason=reason,
                )
            )
            await _publish_event_update(event, "event_updated")

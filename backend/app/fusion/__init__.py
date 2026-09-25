"""
Event Fusion Engine orchestration.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report, MediaItem
from app.fusion.clustering import cluster_report_spatiotemporally
from app.fusion.confidence import recalculate_event_confidence
from app.fusion.contradiction import evaluate_event_contradictions
from app.fusion.lifecycle import evaluate_lifecycle_transitions, _publish_event_update
from app.fusion.severity import calculate_baseline_severity
from app.utils.cv_severity import estimate_visual_severity

logger = logging.getLogger("skygrid.fusion")

def _max_severity(s1: str | None, s2: str | None) -> str | None:
    if not s1:
        return s2
    if not s2:
        return s1
    levels = {"low": 1, "moderate": 2, "high": 3, "critical": 4}
    return s1 if levels.get(s1, 0) >= levels.get(s2, 0) else s2


async def fuse_report(report_id: str, db: AsyncSession) -> str:
    """
    Orchestrate the fusion pipeline for a new report.
    Returns the ID of the fused Event.
    """
    report = await db.get(Report, uuid.UUID(report_id))
    if not report:
        logger.error("Report %s not found for fusion", report_id)
        return ""

    if not report.location:
        logger.info("Report %s has no location, cannot fuse", report_id)
        return ""

    # 1. Clustering
    event, is_new = await cluster_report_spatiotemporally(report, db)

    if is_new:
        # Publish event_created notification
        await _publish_event_update(event, "event_created")

    # 2. Confidence Scoring
    await recalculate_event_confidence(event, db)

    # 3. Contradiction Detection
    await evaluate_event_contradictions(event, db)

    # 4. Severity Estimation
    baseline_severity = await calculate_baseline_severity(event, db)
    
    # Extract media items for the visual estimator
    from sqlalchemy import select
    from app.models.event import EventReportMap
    stmt = (
        select(MediaItem)
        .select_from(MediaItem)
        .join(EventReportMap, EventReportMap.report_id == MediaItem.report_id)
        .where(EventReportMap.event_id == event.id)
    )
    media_items = (await db.scalars(stmt)).all()
    
    visual_severity = await estimate_visual_severity(list(media_items))
    final_severity = _max_severity(baseline_severity, visual_severity) or "low"
    
    if event.severity != final_severity:
        trigger_reason = f"Severity updated to {final_severity} (baseline: {baseline_severity}, visual: {visual_severity})"
        event.severity = final_severity
        
        from app.models.event import EventLifecycleLog
        db.add(
            EventLifecycleLog(
                event_id=event.id,
                from_status=event.lifecycle_status,
                to_status=event.lifecycle_status,
                trigger_reason=trigger_reason,
            )
        )
        await db.flush()
        
        # Publish update to Redis Pub/Sub
        import json
        try:
            import redis.asyncio as aioredis
            from app.core.config import settings
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await r.publish("channel:events:live", json.dumps({"event": "event_updated", "id": str(event.id), "severity": event.severity}))
            await r.aclose()
        except Exception as exc:
            logger.warning("Redis pub/sub failed for severity update %s: %s", event.id, exc)

    # 5. Lifecycle Transitions
    await evaluate_lifecycle_transitions(event, db, trigger_reason=f"Arrival of report {report.id}")

    return str(event.id)

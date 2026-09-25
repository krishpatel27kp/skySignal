"""
Asynchronous Kafka Pipeline Workers.

Implements structural pass-through workers using rule-based/mock logic to ensure
the real-time weather intelligence pipeline flows end-to-end:

1. Dedup Worker:
   - Consumer Group: skysignal-dedup-group
   - Input Topic: normalized.reports
   - Output Topic: processed.dedup
   - Mock Logic: 10% chance to assign a random duplicate_cluster_id.

2. Classification Worker:
   - Consumer Group: skysignal-classification-group
   - Input Topic: processed.dedup
   - Output Topic: processed.classified
   - Mock Logic: Pass through citizen's selected category, assign random category_confidence (0.6 - 0.99).

3. Trust Worker:
   - Consumer Group: skysignal-trust-group
   - Input Topic: processed.classified
   - Output Topic: processed.trusted
   - Mock Logic: Generate random p_misleading (0.01 - 0.99), update DB report record.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session
from app.models.event import Event, EventReportMap
from app.models.report import Report

logger = logging.getLogger("skysignal.workers")


# ── Standalone Pure Transform Functions ──────────────────────────────

def process_dedup_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Mock Dedup Logic:
    10% chance to assign a random duplicate_cluster_id.
    """
    result = dict(payload)
    is_duplicate = random.random() < 0.10
    if is_duplicate:
        result["duplicate_cluster_id"] = str(uuid.uuid4())
        result["is_duplicate"] = True
    else:
        result["duplicate_cluster_id"] = None
        result["is_duplicate"] = False
    return result


def process_classification_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Mock Classification Logic:
    Pass through citizen's selected category, assign random category_confidence (0.60 - 0.99).
    """
    result = dict(payload)
    category = result.get("event_category") or "rainfall"
    confidence = round(random.uniform(0.60, 0.99), 2)
    result["event_category"] = category
    result["category_confidence"] = confidence
    return result


async def process_trust_payload(
    payload: dict[str, Any],
    db_session: Optional[AsyncSession] = None,
) -> dict[str, Any]:
    """
    Mock Trust Logic:
    Generate random p_misleading (0.01 - 0.99) and update the DB Report record.
    """
    result = dict(payload)
    p_misleading = round(random.uniform(0.01, 0.99), 2)
    result["p_misleading"] = p_misleading

    report_id_val = result.get("report_id") or result.get("id")
    if report_id_val:
        try:
            report_uuid = uuid.UUID(str(report_id_val))
            
            async def _update_db(session: AsyncSession) -> None:
                update_values: dict[str, Any] = {
                    "p_misleading": p_misleading,
                    "updated_at": datetime.now(timezone.utc),
                }
                if "category_confidence" in result and result["category_confidence"] is not None:
                    update_values["category_confidence"] = result["category_confidence"]
                if "event_category" in result and result["event_category"]:
                    update_values["event_category"] = result["event_category"]
                
                stmt = update(Report).where(Report.id == report_uuid).values(**update_values)
                await session.execute(stmt)
                await session.commit()

            if db_session is not None:
                await _update_db(db_session)
            else:
                async with async_session() as session:
                    await _update_db(session)
            logger.debug("TrustWorker updated report %s with p_misleading=%.2f", report_uuid, p_misleading)
        except Exception as exc:
            logger.warning("TrustWorker DB update failed for report %s: %s", report_id_val, exc)

    return result


async def process_fusion_payload(
    payload: dict[str, Any],
    db_session: Optional[AsyncSession] = None,
    redis_client: Optional[Any] = None,
) -> dict[str, Any]:
    """
    Core Intelligence Event Fusion Logic:
    1. Consumes from processed.trusted.
    2. Executes a PostGIS spatial query (ST_DWithin) to find any active Event
       of the same category within a 10km radius occurring in the last 6 hours.
    3. If Match:
       - Inserts into EventReportMap.
       - Recalculates event confidence: base confidence + (0.05 * independent_source_count).
       - Updates DB.
    4. If No Match:
       - Creates new Event with lifecycle_status='detected' and severity='moderate'.
       - Inserts into EventReportMap.
    5. After DB commit:
       - Publishes JSON message to Redis Pub/Sub channel 'events_telemetry':
         {"type": "event_updated", "data": {...}}
    """
    category = payload.get("event_category") or "rainfall"
    raw_lat = payload.get("lat")
    raw_lon = payload.get("lon")
    report_id_val = payload.get("report_id") or payload.get("id")
    report_uuid = uuid.UUID(str(report_id_val)) if report_id_val else None

    # Fallback to default coordinates if not provided (e.g. Mumbai center)
    lat = float(raw_lat) if raw_lat is not None else 19.0760
    lon = float(raw_lon) if raw_lon is not None else 72.8777

    async def _execute_fusion(session: AsyncSession) -> tuple[Event, str]:
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=6)
        active_statuses = ["detected", "emerging", "confirmed", "active"]

        # PostGIS ST_DWithin query: 10km (10,000 meters)
        point_geom = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        stmt = (
            select(Event)
            .where(
                Event.category == category,
                Event.lifecycle_status.in_(active_statuses),
                Event.last_updated_at >= cutoff_time,
                func.ST_DWithin(Event.centroid, point_geom, 10000.0),
            )
            .order_by(func.ST_Distance(Event.centroid, point_geom))
            .limit(1)
        )
        existing_event = (await session.execute(stmt)).scalars().first()

        if existing_event:
            # ── Match Found: Link report & recalculate confidence ──
            if report_uuid:
                check_map = select(EventReportMap).where(
                    EventReportMap.event_id == existing_event.id,
                    EventReportMap.report_id == report_uuid,
                )
                existing_map = (await session.execute(check_map)).scalars().first()
                if not existing_map:
                    session.add(
                        EventReportMap(
                            event_id=existing_event.id,
                            report_id=report_uuid,
                            linked_at=datetime.now(timezone.utc),
                        )
                    )
                    await session.flush()

            # Recalculate independent source count
            source_count_stmt = (
                select(func.count(func.distinct(Report.source_id)))
                .select_from(EventReportMap)
                .join(Report, Report.id == EventReportMap.report_id)
                .where(EventReportMap.event_id == existing_event.id)
            )
            distinct_sources = (await session.execute(source_count_stmt)).scalar() or 1
            independent_source_count = max(
                distinct_sources, (existing_event.independent_source_count or 0) + 1
            )
            existing_event.independent_source_count = independent_source_count

            # Recalculate event confidence: base confidence + (0.05 * independent_source_count)
            base_conf = existing_event.confidence if existing_event.confidence is not None else 0.50
            new_confidence = min(0.99, round(base_conf + (0.05 * independent_source_count), 2))
            existing_event.confidence = new_confidence
            existing_event.last_updated_at = datetime.now(timezone.utc)
            await session.flush()
            await session.commit()
            logger.info("EventFusion: Clustered into existing Event %s (confidence=%.2f)", existing_event.id, new_confidence)
            return existing_event, "event_updated"

        else:
            # ── No Match Found: Create new Event with status='detected', severity='moderate' ──
            city_name = payload.get("city") or "Identified Area"
            cat_display = category.replace("_", " ").title()
            event_id = uuid.uuid4()
            location_wkt = f"SRID=4326;POINT({lon} {lat})"

            new_event = Event(
                id=event_id,
                title=f"{cat_display} Alert near {city_name}",
                category=category,
                centroid=location_wkt,
                severity="moderate",
                confidence=payload.get("category_confidence") or 0.60,
                lifecycle_status="detected",
                independent_source_count=1,
                detected_at=datetime.now(timezone.utc),
                last_updated_at=datetime.now(timezone.utc),
                city=payload.get("city"),
                state=payload.get("state"),
                region=payload.get("region"),
            )
            session.add(new_event)
            await session.flush()

            if report_uuid:
                session.add(
                    EventReportMap(
                        event_id=new_event.id,
                        report_id=report_uuid,
                        linked_at=datetime.now(timezone.utc),
                    )
                )
                await session.flush()

            await session.commit()
            logger.info("EventFusion: Created new Event %s (detected, moderate)", new_event.id)
            return new_event, "event_updated"

    if db_session is not None:
        event, action_type = await _execute_fusion(db_session)
    else:
        async with async_session() as session:
            event, action_type = await _execute_fusion(session)

    telemetry_payload = {
        "type": action_type,
        "data": {
            "id": str(event.id),
            "title": event.title,
            "category": event.category,
            "severity": event.severity,
            "lifecycle_status": event.lifecycle_status,
            "confidence": float(event.confidence),
            "independent_source_count": int(event.independent_source_count),
            "lat": lat,
            "lon": lon,
            "last_updated_at": event.last_updated_at.isoformat()
            if event.last_updated_at
            else datetime.now(timezone.utc).isoformat(),
        },
    }

    # Publish to Redis Pub/Sub channel 'events_telemetry'
    channel_name = settings.REDIS_CHANNEL_EVENTS_TELEMETRY or "events_telemetry"
    if redis_client is not None:
        try:
            await redis_client.publish(channel_name, json.dumps(telemetry_payload))
        except Exception as exc:
            logger.warning("Redis mock publish failed: %s", exc)
    else:
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            try:
                await r.publish(channel_name, json.dumps(telemetry_payload))
            finally:
                await r.aclose()
        except Exception as exc:
            logger.debug("Redis publish to channel '%s' skipped/failed: %s", channel_name, exc)

    return telemetry_payload


# ── Base Kafka Worker ────────────────────────────────────────────────

class BaseKafkaWorker:
    """Manages an aiokafka consumer/producer loop with resilient reconnects."""

    def __init__(
        self,
        name: str,
        in_topic: str,
        out_topic: Optional[str],
        group_id: str,
        bootstrap_servers: Optional[str] = None,
    ) -> None:
        self.name = name
        self.in_topic = in_topic
        self.out_topic = out_topic
        self.group_id = group_id
        self.bootstrap_servers = bootstrap_servers or settings.KAFKA_BOOTSTRAP_SERVERS
        self.running = False
        self._task: Optional[asyncio.Task[None]] = None
        self._consumer: Any = None
        self._producer: Any = None

    async def start(self) -> None:
        """Start the background worker loop task."""
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._run_loop(), name=f"worker-{self.name}")
        logger.info("Worker '%s' scheduled in background (listening on '%s')", self.name, self.in_topic)

    async def stop(self) -> None:
        """Stop the background worker loop gracefully."""
        self.running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await asyncio.wait_for(self._task, timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        
        if self._consumer:
            try:
                await self._consumer.stop()
            except Exception:
                pass
            self._consumer = None

        if self._producer:
            try:
                await self._producer.stop()
            except Exception:
                pass
            self._producer = None

        logger.info("Worker '%s' stopped", self.name)

    async def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Override in subclasses to implement processing logic."""
        raise NotImplementedError

    async def _run_loop(self) -> None:
        """Persistent loop consuming messages and publishing downstream."""
        while self.running:
            try:
                from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

                self._consumer = AIOKafkaConsumer(
                    self.in_topic,
                    bootstrap_servers=self.bootstrap_servers,
                    group_id=self.group_id,
                    auto_offset_reset="earliest",
                    enable_auto_commit=True,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                )
                await self._consumer.start()

                if self.out_topic:
                    self._producer = AIOKafkaProducer(
                        bootstrap_servers=self.bootstrap_servers,
                        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                    )
                    await self._producer.start()

                logger.info(
                    "Worker '%s' active: consumer connected to '%s' (group=%s)",
                    self.name,
                    self.in_topic,
                    self.group_id,
                )

                async for msg in self._consumer:
                    if not self.running:
                        break
                    try:
                        raw_payload = msg.value
                        if isinstance(raw_payload, (bytes, bytearray)):
                            payload = json.loads(raw_payload.decode("utf-8"))
                        elif isinstance(raw_payload, str):
                            payload = json.loads(raw_payload)
                        else:
                            payload = raw_payload

                        transformed = await self.process(payload)

                        if transformed and self.out_topic and self._producer:
                            key_bytes = (
                                msg.key
                                if msg.key
                                else (
                                    str(transformed.get("report_id") or "").encode("utf-8")
                                    if transformed.get("report_id")
                                    else None
                                )
                            )
                            await self._producer.send_and_wait(
                                self.out_topic, key=key_bytes, value=transformed
                            )
                            logger.debug(
                                "Worker '%s' published message to '%s'",
                                self.name,
                                self.out_topic,
                            )
                    except Exception as err:
                        logger.error("Worker '%s' failed to process message: %s", self.name, err)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(
                    "Worker '%s' connection error (%s). Reconnecting in 5 seconds...",
                    self.name,
                    exc,
                )
                if self._consumer:
                    try:
                        await self._consumer.stop()
                    except Exception:
                        pass
                    self._consumer = None
                if self._producer:
                    try:
                        await self._producer.stop()
                    except Exception:
                        pass
                    self._producer = None

                # Wait before reconnecting
                try:
                    await asyncio.sleep(5)
                except asyncio.CancelledError:
                    break


# ── Concrete Worker Implementations ──────────────────────────────────

class DedupWorker(BaseKafkaWorker):
    """
    Dedup Worker:
    Consumes 'normalized.reports' (group: skysignal-dedup-group).
    Assigns duplicate_cluster_id with 10% probability.
    Publishes to 'processed.dedup'.
    """

    def __init__(self, bootstrap_servers: Optional[str] = None) -> None:
        super().__init__(
            name="dedup",
            in_topic=settings.KAFKA_TOPIC_NORMALIZED_REPORTS,
            out_topic=settings.KAFKA_TOPIC_PROCESSED_DEDUP,
            group_id=settings.KAFKA_GROUP_DEDUP,
            bootstrap_servers=bootstrap_servers,
        )

    async def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        return process_dedup_payload(payload)


class ClassificationWorker(BaseKafkaWorker):
    """
    Classification Worker:
    Consumes 'processed.dedup' (group: skysignal-classification-group).
    Passes through category and assigns category_confidence (0.6 - 0.99).
    Publishes to 'processed.classified'.
    """

    def __init__(self, bootstrap_servers: Optional[str] = None) -> None:
        super().__init__(
            name="classification",
            in_topic=settings.KAFKA_TOPIC_PROCESSED_DEDUP,
            out_topic=settings.KAFKA_TOPIC_PROCESSED_CLASSIFIED,
            group_id=settings.KAFKA_GROUP_CLASSIFICATION,
            bootstrap_servers=bootstrap_servers,
        )

    async def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        return process_classification_payload(payload)


class TrustWorker(BaseKafkaWorker):
    """
    Trust Worker:
    Consumes 'processed.classified' (group: skysignal-trust-group).
    Assigns p_misleading (0.01 - 0.99), updates DB report record.
    Publishes to 'processed.trusted'.
    """

    def __init__(self, bootstrap_servers: Optional[str] = None) -> None:
        super().__init__(
            name="trust",
            in_topic=settings.KAFKA_TOPIC_PROCESSED_CLASSIFIED,
            out_topic=settings.KAFKA_TOPIC_PROCESSED_TRUSTED,
            group_id=settings.KAFKA_GROUP_TRUST,
            bootstrap_servers=bootstrap_servers,
        )

    async def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await process_trust_payload(payload)


class EventFusionWorker(BaseKafkaWorker):
    """
    Event Fusion Worker:
    Consumes 'processed.trusted' (group: skysignal-fusion-group).
    Executes PostGIS ST_DWithin 10km spatial search against active events in last 6 hours.
    Matches -> inserts EventReportMap & updates confidence.
    No Match -> creates detected/moderate Event & EventReportMap.
    Publishes to Redis Pub/Sub 'events_telemetry' & Kafka 'weather.events'.
    """

    def __init__(self, bootstrap_servers: Optional[str] = None) -> None:
        super().__init__(
            name="fusion",
            in_topic=settings.KAFKA_TOPIC_PROCESSED_TRUSTED,
            out_topic=settings.KAFKA_TOPIC_WEATHER_EVENTS,
            group_id=settings.KAFKA_GROUP_FUSION,
            bootstrap_servers=bootstrap_servers,
        )

    async def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await process_fusion_payload(payload)


# ── Kafka Worker Manager ─────────────────────────────────────────────

class KafkaWorkerManager:
    """Orchestrates all asynchronous Kafka workers lifecycle."""

    def __init__(self) -> None:
        self.dedup_worker = DedupWorker()
        self.classification_worker = ClassificationWorker()
        self.trust_worker = TrustWorker()
        self.fusion_worker = EventFusionWorker()
        self.workers: list[BaseKafkaWorker] = [
            self.dedup_worker,
            self.classification_worker,
            self.trust_worker,
            self.fusion_worker,
        ]

    async def start(self) -> None:
        """Start all workers in parallel background tasks."""
        logger.info("Starting %d Kafka pipeline workers...", len(self.workers))
        for worker in self.workers:
            await worker.start()

    async def stop(self) -> None:
        """Stop all workers gracefully."""
        logger.info("Stopping %d Kafka pipeline workers...", len(self.workers))
        await asyncio.gather(*(w.stop() for w in self.workers), return_exceptions=True)


kafka_worker_manager = KafkaWorkerManager()


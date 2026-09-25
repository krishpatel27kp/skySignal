"""
Standalone script to verify the Event Fusion pipeline end-to-end.

Usage:
    docker compose exec api python -m scripts.verify_fusion_pipeline
"""

import asyncio
import logging
from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.ingestion.pipeline import ingest_report
from app.models.event import Event, EventReportMap, SensorReading
from app.schemas.canonical import CanonicalReport

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_fusion")

# Ahmedabad coordinates (no seed data)
LAT = 23.03
LON = 72.59

async def verify_pipeline():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    run_id = uuid.uuid4().hex[:6]
    logger.info(f"Starting verification run {run_id}")

    async with session_factory() as db:
        # 1. Submit 3 reports to Surat within 10km radius
        reports_to_ingest = [
            CanonicalReport(
                source_platform="citizen_app",
                source_native_id=f"cit-{run_id}",
                raw_text="Streets are severely flooded in Ahmedabad.",
                reported_at=datetime.now(timezone.utc),
                lat=LAT,
                lon=LON,
                event_category="flooding",
                category_confidence=0.9,
                city="Ahmedabad",
                state="Gujarat",
                media_files=[{"filename": "test.jpg", "content_type": "image/jpeg", "file_bytes": b"fake_bytes"}],
                citizen_device_id=f"dev-{run_id}"
            ),
            CanonicalReport(
                source_platform="twitter",
                source_native_id=f"tw-{run_id}",
                raw_text="Streets are severely flooded in Ahmedabad.",
                reported_at=datetime.now(timezone.utc),
                lat=LAT + 0.01,
                lon=LON + 0.01,
                event_category="flooding",
                category_confidence=0.9,
                city="Ahmedabad",
                state="Gujarat",
            ),
            CanonicalReport(
                source_platform="news",
                source_native_id=f"news-{run_id}",
                raw_text="Massive urban flooding reported in Ahmedabad.",
                reported_at=datetime.now(timezone.utc),
                lat=LAT - 0.01,
                lon=LON - 0.01,
                event_category="flooding",
                category_confidence=0.95,
                city="Ahmedabad",
                state="Gujarat",
            )
        ]

        report_ids = []
        for i, canonical in enumerate(reports_to_ingest):
            report, res = await ingest_report(canonical, db)
            if report:
                report_ids.append(report.id)
            logger.info(f"Ingested report {i+1}: {res.status}")
        
        await db.commit()

        # 2. Ingest 1 sensor reading near Ahmedabad recording 45.0 mm rainfall.
        sensor = SensorReading(
            station_id=f"AWS-AHMEDABAD-{run_id}",
            location=f"SRID=4326;POINT({LON} {LAT})",
            rainfall_mm=45.0,
            recorded_at=datetime.now(timezone.utc)
        )
        db.add(sensor)
        await db.commit()

    logger.info("Waiting 10 seconds for Celery workers to process the pipeline...")
    await asyncio.sleep(10.0)

    # 3. Assert conditions
    async with session_factory() as db:
        # Lookup event ID via the first report
        stmt_map = select(EventReportMap.event_id).where(EventReportMap.report_id == report_ids[0])
        event_id = (await db.execute(stmt_map)).scalar_one_or_none()
        assert event_id is not None, "Report was not linked to an event!"

        stmt = select(Event).where(Event.id == event_id)
        event = (await db.execute(stmt)).scalar_one_or_none()

        assert event is not None, "Event was not created!"
        logger.info(f"Event Found: {event.id}")

        assert event.independent_source_count >= 2, f"Expected independent_source_count >= 2, got {event.independent_source_count}"
        logger.info(f"Independent Sources: {event.independent_source_count}")

        assert event.confidence >= 0.70, f"Expected confidence >= 0.70, got {event.confidence}"
        logger.info(f"Confidence: {event.confidence}")

        assert event.lifecycle_status in ("confirmed", "active"), f"Unexpected lifecycle_status: {event.lifecycle_status}"
        logger.info(f"Lifecycle Status: {event.lifecycle_status}")

        assert event.has_contradiction is False, "Expected has_contradiction to be False"
        logger.info("Contradiction check passed.")

    await engine.dispose()
    logger.info("✅ Pipeline verification passed!")


if __name__ == "__main__":
    asyncio.run(verify_pipeline())

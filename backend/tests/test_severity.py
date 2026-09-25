"""
Tests for the Severity Estimation Module.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.fusion.severity import calculate_baseline_severity
from app.utils.cv_severity import estimate_visual_severity, YOLOSeverityEstimator
from app.fusion import fuse_report
from app.fusion.clustering import cluster_report_spatiotemporally
from app.models.event import Event, EventLifecycleLog, EventReportMap, SensorReading
from app.models.report import Report, MediaItem
from app.models.source import Source


@pytest.fixture
async def citizen_source(db: AsyncSession) -> Source:
    source = Source(platform="citizen_app", handle="testuser")
    db.add(source)
    await db.flush()
    return source

@pytest.fixture
async def imd_source(db: AsyncSession) -> Source:
    source = Source(platform="imd_official", handle="imd")
    db.add(source)
    await db.flush()
    return source

async def create_dummy_report(
    db: AsyncSession,
    source_id: uuid.UUID,
    lat: float,
    lon: float,
    event_category: str = "flooding",
) -> Report:
    report = Report(
        source_id=source_id,
        raw_text="Test report",
        location=f"SRID=4326;POINT({lon} {lat})",
        reported_at=datetime.now(timezone.utc),
        event_category=event_category,
        category_confidence=0.9,
        status="verified",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report

@pytest.mark.asyncio
async def test_baseline_severity_low_on_single_report(db: AsyncSession, citizen_source: Source):
    r1 = await create_dummy_report(db, citizen_source.id, 19.0, 72.0)
    event, _ = await cluster_report_spatiotemporally(r1, db)
    event.independent_source_count = 1  # normally set by confidence
    severity = await calculate_baseline_severity(event, db)
    assert severity == "low"

@pytest.mark.asyncio
async def test_baseline_severity_moderate_on_small_cluster(db: AsyncSession, citizen_source: Source):
    r1 = await create_dummy_report(db, citizen_source.id, 19.0, 72.0)
    r2 = await create_dummy_report(db, citizen_source.id, 19.01, 72.01) # ~1.4 km
    event, _ = await cluster_report_spatiotemporally(r1, db)
    await cluster_report_spatiotemporally(r2, db)
    event.independent_source_count = 2
    severity = await calculate_baseline_severity(event, db)
    assert severity == "moderate"

@pytest.mark.asyncio
async def test_baseline_severity_high_on_spread(db: AsyncSession, citizen_source: Source):
    # Spread > 8km triggers high
    r1 = await create_dummy_report(db, citizen_source.id, 19.0, 72.0)
    r2 = await create_dummy_report(db, citizen_source.id, 19.1, 72.1) # ~15 km
    event, _ = await cluster_report_spatiotemporally(r1, db)
    await cluster_report_spatiotemporally(r2, db)
    event.independent_source_count = 2
    severity = await calculate_baseline_severity(event, db)
    assert severity == "high"

@pytest.mark.asyncio
async def test_baseline_severity_critical_on_large_flood(db: AsyncSession, citizen_source: Source):
    r1 = await create_dummy_report(db, citizen_source.id, 19.0, 72.0)
    r2 = await create_dummy_report(db, citizen_source.id, 19.15, 72.15) # ~23 km (within 25km radius)
    event, _ = await cluster_report_spatiotemporally(r1, db)
    await cluster_report_spatiotemporally(r2, db)
    event.independent_source_count = 6
    severity = await calculate_baseline_severity(event, db)
    assert severity == "critical"


@pytest.mark.asyncio
async def test_visual_severity_upgrade():
    # Mocking YOLO output
    class MockBox:
        def __init__(self, cls_id):
            self.cls = [cls_id]
            
    class MockResult:
        def __init__(self, box_ids, names):
            self.boxes = [MockBox(cid) for cid in box_ids]
            self.names = names

    class MockModel:
        def __call__(self, url, verbose=False):
            return [MockResult([0], {0: "bus"})]
            
    estimator = YOLOSeverityEstimator()
    estimator.model = MockModel()
    estimator._is_available = True
    estimator._initialized = True
    
    media = [MediaItem(media_type="image", storage_url="mock://test.jpg")]
    severity = await estimator.estimate(media)
    assert severity == "critical"

@pytest.mark.asyncio
async def test_visual_severity_cannot_downgrade(db: AsyncSession, citizen_source: Source):
    # End-to-end integration test proving the orchestrator upgrades but does not downgrade
    r1 = await create_dummy_report(db, citizen_source.id, 19.0, 72.0)
    r2 = await create_dummy_report(db, citizen_source.id, 19.15, 72.15) # High spread -> High
    
    db.add(MediaItem(report_id=r1.id, media_type="image", storage_url="mock://test.jpg"))
    await db.flush()

    # Even if visual is None, it should remain at least high
    await fuse_report(str(r1.id), db)
    event_id = await fuse_report(str(r2.id), db)
    
    from sqlalchemy import select
    event = (await db.scalars(select(Event).where(Event.id == uuid.UUID(event_id)))).first()
    
    assert event.severity == "high"

@pytest.mark.asyncio
async def test_visual_fallback_on_missing_model_or_corrupted_image():
    estimator = YOLOSeverityEstimator()
    estimator._is_available = False
    estimator._initialized = True
    
    media = [MediaItem(media_type="image", storage_url="mock://test.jpg")]
    severity = await estimator.estimate(media)
    assert severity is None

@pytest.mark.asyncio
async def test_fusion_persists_severity(db: AsyncSession, citizen_source: Source):
    r1 = await create_dummy_report(db, citizen_source.id, 19.0, 72.0)
    event_id = await fuse_report(str(r1.id), db)
    
    from sqlalchemy import select
    event = (await db.scalars(select(Event).where(Event.id == uuid.UUID(event_id)))).first()
    assert event.severity == "low"

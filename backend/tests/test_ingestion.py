"""
Unit and integration tests for the SkyGrid ingestion layer.

Covers:
1. Normalization utilities (UTC, text cleaning, location resolution)
2. Citizen payload mapping and CanonicalReport production
3. DLQ routing on malformed payloads
4. Idempotency on duplicate (source_id, source_native_id)
5. Fixture adapters produce valid CanonicalReports
6. Redis stream publishing on successful ingestion
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion import imd_data, news_rss, twitter, youtube
from app.ingestion.citizen_app import normalize_citizen_report
from app.ingestion.pipeline import REDIS_STREAM, ingest_report
from app.models.report import DeadLetterReport, Report
from app.schemas.canonical import CanonicalReport
from app.utils.normalize import clean_text, resolve_location, to_utc


# ── 1. Normalization Utilities ───────────────────────────────────


def test_to_utc_from_z_string() -> None:
    """ISO 8601 string with trailing Z converts to UTC-aware datetime."""
    result = to_utc("2026-09-16T05:30:00Z")
    assert result.tzinfo is not None
    assert result.year == 2026
    assert result.hour == 5


def test_to_utc_from_offset_string() -> None:
    """ISO 8601 string with offset normalizes to UTC."""
    result = to_utc("2026-09-16T11:00:00+05:30")
    assert result.hour == 5
    assert result.minute == 30


def test_to_utc_from_naive_datetime() -> None:
    """Naive datetime is treated as UTC."""
    naive = datetime(2026, 9, 16, 8, 0, 0)
    result = to_utc(naive)
    assert result.tzinfo is not None
    assert result.hour == 8


def test_to_utc_none_returns_utc_now() -> None:
    """None input returns a UTC-aware datetime close to now."""
    before = datetime.now(timezone.utc)
    result = to_utc(None)
    after = datetime.now(timezone.utc)
    assert before <= result <= after


def test_clean_text_strips_urls_and_whitespace() -> None:
    """URLs, hashtags, and extra whitespace are removed from raw text."""
    raw = "  Heavy   rain  https://example.com #Mumbai   flooding  "
    cleaned, lang = clean_text(raw)
    assert cleaned is not None
    assert "http" not in cleaned
    assert "  " not in cleaned
    assert lang  # some language code returned


def test_clean_text_empty_input_returns_none() -> None:
    """Empty or whitespace-only input returns (None, 'en')."""
    cleaned, lang = clean_text("   ")
    assert cleaned is None
    assert lang == "en"


def test_resolve_location_gps_mumbai() -> None:
    """GPS coordinates for Mumbai resolve to city='Mumbai', state='Maharashtra'."""
    result = resolve_location(19.08, 72.88, None)
    assert result["geocode_method"] == "gps"
    assert result["geocode_confidence"] == 1.0
    assert result["city"] == "Mumbai"
    assert result["state"] == "Maharashtra"
    assert result["region"] == "West"


def test_resolve_location_raw_text_surat() -> None:
    """Raw location text 'Surat, Gujarat' resolves to correct city and state."""
    result = resolve_location(None, None, "Surat, Gujarat")
    assert result["geocode_method"] == "ner_geocoded"
    assert result["city"] == "Surat"
    assert result["state"] == "Gujarat"
    assert result["region"] == "West"


def test_resolve_location_no_data_returns_none_fields() -> None:
    """When no GPS or text is provided, all location fields are None."""
    result = resolve_location(None, None, None)
    assert result["city"] is None
    assert result["state"] is None
    assert result["geocode_method"] is None


# ── 2. Citizen Payload Mapping ───────────────────────────────────


def test_citizen_payload_maps_to_canonical_report() -> None:
    """Valid citizen payload produces a correct CanonicalReport."""
    canonical = normalize_citizen_report(
        event_category="rainfall",
        description="Heavy rain near my house",
        lat=19.08,
        lon=72.88,
        location_method="gps",
        reported_at=datetime(2026, 9, 16, 10, 0, tzinfo=timezone.utc),
        media_files=[],
        device_id="test-device-abc123",
    )

    assert isinstance(canonical, CanonicalReport)
    assert canonical.source_platform == "citizen_app"
    assert canonical.event_category == "rainfall"
    assert canonical.lat == 19.08
    assert canonical.citizen_device_id == "test-device-abc123"
    assert canonical.raw_text == "Heavy rain near my house"


def test_citizen_payload_denied_location_clears_coords() -> None:
    """When location_method='denied', lat/lon are set to None."""
    canonical = normalize_citizen_report(
        event_category="flooding",
        description="Flooding seen outside",
        lat=19.08,
        lon=72.88,
        location_method="denied",
        reported_at=None,
        media_files=[],
        device_id="dev-xyz",
    )
    assert canonical.lat is None
    assert canonical.lon is None


# ── 3. DLQ Routing on Malformed Payloads ────────────────────────


@pytest.mark.anyio
async def test_dlq_routing_on_invalid_payload(db: AsyncSession) -> None:
    """
    A dict missing required fields routes to dead_letter_reports
    and returns IngestionResult(status='dead_letter').
    """
    bad_payload: dict[str, Any] = {
        "source_platform": "twitter",
        # missing required 'reported_at'
        "raw_text": "Some weather report",
    }

    _, result = await ingest_report(bad_payload, db)

    assert result.status == "dead_letter"
    assert result.dead_letter_id is not None

    # Verify the DLQ record persists in DB
    dlq_id = uuid.UUID(result.dead_letter_id)
    dlq = await db.get(DeadLetterReport, dlq_id)
    assert dlq is not None
    assert "twitter" == dlq.source_platform
    assert "reported_at" in dlq.error_detail  # Pydantic error mentions missing field


# ── 4. Idempotency on Duplicate native_id ───────────────────────


@pytest.mark.anyio
async def test_idempotency_duplicate_native_id(db: AsyncSession) -> None:
    """
    Submitting the same (source_platform, source_native_id) twice
    results in a single DB row and the second call returns 'duplicate_skipped'.
    """
    native_id = f"imd-idempotency-test-{uuid.uuid4()}"
    canonical = CanonicalReport(
        source_platform="imd_official",
        source_handle="@IMD_Weather",
        source_native_id=native_id,
        raw_text="IMD bulletin: heavy rainfall warning",
        reported_at=datetime.now(timezone.utc),
        lat=19.08,
        lon=72.88,
        event_category="rainfall",
        category_confidence=1.0,
    )

    # First insertion — should create
    _, result1 = await ingest_report(canonical, db)
    assert result1.status == "created"

    # Second insertion — should be deduplicated
    _, result2 = await ingest_report(canonical, db)
    assert result2.status == "duplicate_skipped"
    assert result1.report_id == result2.report_id

    # Confirm exactly 1 row in the database for this native_id
    count = (
        await db.execute(
            select(func.count(Report.id)).where(
                Report.source_native_id == native_id
            )
        )
    ).scalar()
    assert count == 1


# ── 5. Adapter Fixture Coverage ──────────────────────────────────


def test_twitter_fixtures_produce_canonical_reports() -> None:
    """Twitter fixture adapter produces valid CanonicalReports."""
    reports = twitter.ingest_all_fixtures()
    assert len(reports) == 3
    for r in reports:
        assert isinstance(r, CanonicalReport)
        assert r.source_platform == "twitter"
        assert r.source_native_id is not None
        assert r.raw_text


def test_news_rss_fixtures_produce_canonical_reports() -> None:
    """News RSS fixture adapter produces valid CanonicalReports with category."""
    reports = news_rss.ingest_all_fixtures()
    assert len(reports) == 3
    for r in reports:
        assert isinstance(r, CanonicalReport)
        assert r.source_platform == "news"
        assert r.event_category in (None, "rainfall", "flooding", "heatwave", "thunderstorm", "fog")


def test_imd_data_fixtures_produce_canonical_reports() -> None:
    """IMD fixture adapter produces authoritative CanonicalReports with confidence=1.0."""
    reports = imd_data.ingest_all_fixtures()
    assert len(reports) == 3
    for r in reports:
        assert isinstance(r, CanonicalReport)
        assert r.source_platform == "imd_official"
        assert r.category_confidence == 1.0


def test_youtube_fixtures_produce_canonical_reports() -> None:
    """YouTube fixture adapter produces CanonicalReports with precomputed keyframe data."""
    reports = youtube.ingest_all_fixtures()
    assert len(reports) == 2
    for r in reports:
        assert isinstance(r, CanonicalReport)
        assert r.source_platform == "youtube"


# ── 6. Redis Stream Publishing ───────────────────────────────────


@pytest.mark.anyio
async def test_redis_stream_published_on_success(db: AsyncSession) -> None:
    """
    A successfully ingested report publishes a message to stream:reports:ingested.
    Redis publishing is confirmed by checking the async call was made.
    """
    canonical = CanonicalReport(
        source_platform="news",
        source_handle="TOI",
        source_native_id=f"redis-test-{uuid.uuid4()}",
        raw_text="Heavy flooding in Surat",
        reported_at=datetime.now(timezone.utc),
        lat=21.17,
        lon=72.83,
        event_category="flooding",
    )

    # Patch the Redis stream publish
    published_messages: list[dict] = []

    async def mock_publish(report_id: str, platform: str) -> None:
        published_messages.append({"report_id": report_id, "platform": platform})

    with patch(
        "app.ingestion.pipeline._publish_to_stream",
        side_effect=mock_publish,
    ):
        _, result = await ingest_report(canonical, db)

    assert result.status == "created"
    assert len(published_messages) == 1
    assert published_messages[0]["platform"] == "news"
    assert published_messages[0]["report_id"] == result.report_id


# ── 7. POST /v1/reports API integration ─────────────────────────


@pytest.mark.anyio
async def test_post_report_endpoint_success(client: AsyncClient) -> None:
    """POST /v1/reports with valid form data returns 201 with pending status."""
    with patch("app.ingestion.pipeline._publish_to_stream", new_callable=AsyncMock):
        resp = await client.post(
            "/v1/reports",
            headers={"X-Device-Id": f"test-api-device-{uuid.uuid4()}"},
            data={
                "event_category": "rainfall",
                "location_method": "gps",
                "description": "Heavy rain in Mumbai since morning",
                "lat": "19.08",
                "lon": "72.88",
            },
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert "id" in body


@pytest.mark.anyio
async def test_post_report_endpoint_missing_device_id(client: AsyncClient) -> None:
    """POST /v1/reports without X-Device-Id returns 400 Bad Request."""
    resp = await client.post(
        "/v1/reports",
        data={
            "event_category": "rainfall",
            "location_method": "denied",
            "description": "Some rain",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "missing_device_id"

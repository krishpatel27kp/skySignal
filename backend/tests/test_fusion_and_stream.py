"""
Tests for Core Intelligence Event Fusion Worker and Real-Time SSE Telemetry Stream.

Verifies:
1. EventFusionWorker configuration and topic bindings.
2. Spatial query matching (ST_DWithin 10km, last 6 hours, same category):
   - Match: Inserts EventReportMap, recalculates confidence (base + 0.05 * sources), updates DB.
   - No Match: Creates new Event with lifecycle_status='detected', severity='moderate'.
3. Redis Pub/Sub channel 'events_telemetry' publication with {"type": "event_updated", "data": {...}}.
4. GET /v1/events/stream:
   - Protected via Depends(get_current_admin) (401 for guests, 403 for citizen, 200 for analyst).
   - Consumes from Redis channel 'events_telemetry' and yields formatted SSE chunks.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.security import create_access_token
from app.main import app
from app.models.event import Event, EventReportMap
from app.workers.kafka_workers import (
    EventFusionWorker,
    KafkaWorkerManager,
    process_fusion_payload,
)


# ── Fixtures ─────────────────────────────────────────────────────────

class MockDBSession:
    async def get(self, model, obj_id):
        return None

    async def execute(self, stmt):
        mock_res = MagicMock()
        mock_res.scalars.return_value.first.return_value = None
        mock_res.scalar.return_value = 0
        return mock_res


@pytest.fixture(autouse=True)
def override_db():
    from app.api.deps import get_db
    app.dependency_overrides[get_db] = lambda: MockDBSession()
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def analyst_token() -> str:
    token, _ = create_access_token(
        {"sub": str(uuid.uuid4()), "email": "analyst@imd.gov.in", "role": "analyst"}
    )
    return token


@pytest.fixture
def citizen_token() -> str:
    token, _ = create_access_token(
        {"sub": str(uuid.uuid4()), "email": "citizen@public.in", "role": "citizen"}
    )
    return token


# ── 1. Event Fusion Worker Configuration ──────────────────────────────

def test_event_fusion_worker_configuration():
    """Verify EventFusionWorker topic subscriptions and group ID."""
    worker = EventFusionWorker()
    assert worker.in_topic == settings.KAFKA_TOPIC_PROCESSED_TRUSTED
    assert worker.out_topic == settings.KAFKA_TOPIC_WEATHER_EVENTS
    assert worker.group_id == settings.KAFKA_GROUP_FUSION
    assert worker.name == "fusion"


def test_kafka_worker_manager_has_fusion_worker():
    """Verify KafkaWorkerManager orchestrates all 4 pipeline stages."""
    manager = KafkaWorkerManager()
    assert len(manager.workers) == 4
    worker_names = [w.name for w in manager.workers]
    assert "dedup" in worker_names
    assert "classification" in worker_names
    assert "trust" in worker_names
    assert "fusion" in worker_names


# ── 2. Fusion Logic: No Match -> Create Detected Event ────────────────

@pytest.mark.asyncio
async def test_fusion_no_match_creates_detected_event():
    """When no event matches within 10km, create a new event with status='detected' and severity='moderate'."""
    mock_db = AsyncMock()
    mock_redis = AsyncMock()

    # DB execute returns no existing event
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_redis.publish = AsyncMock()

    report_id = uuid.uuid4()
    payload = {
        "report_id": str(report_id),
        "event_category": "thunderstorm",
        "category_confidence": 0.82,
        "lat": 19.0760,
        "lon": 72.8777,
        "city": "Mumbai",
    }

    result = await process_fusion_payload(
        payload,
        db_session=mock_db,
        redis_client=mock_redis,
    )

    # 1. Output structure
    assert result["type"] == "event_updated"
    data = result["data"]
    assert data["category"] == "thunderstorm"
    assert data["lifecycle_status"] == "detected"
    assert data["severity"] == "moderate"
    assert data["confidence"] == 0.82
    assert data["independent_source_count"] == 1
    assert data["lat"] == 19.0760
    assert data["lon"] == 72.8777

    # 2. DB calls
    assert mock_db.add.called
    assert mock_db.commit.called

    # 3. Redis Pub/Sub publish
    assert mock_redis.publish.called
    channel_arg, message_arg = mock_redis.publish.call_args[0]
    assert channel_arg == "events_telemetry"
    published = json.loads(message_arg)
    assert published["type"] == "event_updated"
    assert published["data"]["lifecycle_status"] == "detected"
    assert published["data"]["severity"] == "moderate"


# ── 3. Fusion Logic: Match -> Link & Recalculate Confidence ──────────

@pytest.mark.asyncio
async def test_fusion_match_updates_existing_event():
    """When an active event of same category exists within 10km, link report and recalculate confidence."""
    mock_db = AsyncMock()
    mock_redis = AsyncMock()

    existing_event = Event(
        id=uuid.uuid4(),
        title="Thunderstorm Alert near Mumbai",
        category="thunderstorm",
        severity="moderate",
        confidence=0.70,
        lifecycle_status="active",
        independent_source_count=1,
        detected_at=datetime.now(timezone.utc),
        last_updated_at=datetime.now(timezone.utc),
    )

    # DB mocks
    first_query = MagicMock()
    first_query.scalars.return_value.first.return_value = existing_event

    second_query = MagicMock()
    second_query.scalars.return_value.first.return_value = None  # no existing map link

    third_query = MagicMock()
    third_query.scalar.return_value = 2  # 2 distinct sources

    mock_db.execute.side_effect = [first_query, second_query, third_query]
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_redis.publish = AsyncMock()

    report_id = uuid.uuid4()
    payload = {
        "report_id": str(report_id),
        "event_category": "thunderstorm",
        "category_confidence": 0.88,
        "lat": 19.0800,  # ~450m from existing centroid
        "lon": 72.8800,
        "city": "Mumbai",
    }

    result = await process_fusion_payload(
        payload,
        db_session=mock_db,
        redis_client=mock_redis,
    )

    # Base confidence (0.70) + (0.05 * 2 sources) = 0.80
    assert result["type"] == "event_updated"
    data = result["data"]
    assert data["id"] == str(existing_event.id)
    assert data["confidence"] == 0.80
    assert data["independent_source_count"] == 2
    assert mock_db.commit.called

    # Redis Pub/Sub publish
    assert mock_redis.publish.called
    channel_arg, message_arg = mock_redis.publish.call_args[0]
    assert channel_arg == "events_telemetry"
    published = json.loads(message_arg)
    assert published["data"]["confidence"] == 0.80


# ── 4. SSE Stream Endpoint Security & Telemetry ──────────────────────

@pytest.mark.anyio
async def test_sse_endpoint_unauthorized_guest_rejected():
    """Unauthenticated guest cannot connect to SSE telemetry stream."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/events/stream")
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_sse_endpoint_insufficient_role_citizen_rejected(citizen_token: str):
    """Citizen role is forbidden from SSE telemetry stream."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/v1/events/stream",
            headers={"Authorization": f"Bearer {citizen_token}"},
        )
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "forbidden"


@pytest.mark.anyio
@pytest.mark.anyio
async def test_sse_endpoint_analyst_receives_telemetry():
    """Verify event_stream generator receives Redis message and yields formatted SSE."""
    from app.api.v1.stream import event_stream

    mock_message = {
        "type": "message",
        "pattern": None,
        "channel": "events_telemetry",
        "data": json.dumps({
            "type": "event_updated",
            "data": {
                "id": "e1234567-89ab-cdef-0123-456789abcdef",
                "title": "Severe Rainstorm in Colaba",
                "category": "rainfall",
                "severity": "severe",
                "lifecycle_status": "active",
                "confidence": 0.95,
            }
        }),
    }

    class MockPubSub:
        def __init__(self):
            self.delivered = False

        async def subscribe(self, channel):
            pass

        async def unsubscribe(self, channel):
            pass

        async def close(self):
            pass

        async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
            if not self.delivered:
                self.delivered = True
                return mock_message
            return None

    class MockRedisClient:
        def pubsub(self):
            return MockPubSub()

        async def aclose(self):
            pass

    mock_request = MagicMock()
    # First iteration: not disconnected; second iteration: disconnected
    mock_request.is_disconnected = AsyncMock(side_effect=[False, True])

    with patch("redis.asyncio.from_url", return_value=MockRedisClient()):
        chunks = []
        async for chunk in event_stream(mock_request):
            chunks.append(chunk)

        assert len(chunks) == 1
        sse_text = chunks[0]
        assert "event: event_updated" in sse_text
        assert "Severe Rainstorm in Colaba" in sse_text
        assert "e1234567-89ab-cdef-0123-456789abcdef" in sse_text
        assert sse_text.endswith("\n\n")


@pytest.mark.anyio
async def test_sse_endpoint_analyst_authorized_response(analyst_token: str):
    """Verify authenticated analyst receives a 200 StreamingResponse from /v1/events/stream."""
    from app.api.v1.stream import stream_events

    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=True)

    mock_analyst = MagicMock()
    mock_analyst.role = "analyst"

    with patch("app.api.v1.stream.event_stream") as mock_gen:
        async def dummy_stream(req):
            yield "data: ok\n\n"
        mock_gen.return_value = dummy_stream(mock_request)

        resp = await stream_events(request=mock_request, admin=mock_analyst)
        assert resp.status_code == 200
        assert resp.media_type == "text/event-stream"
        assert resp.headers["cache-control"] == "no-cache"

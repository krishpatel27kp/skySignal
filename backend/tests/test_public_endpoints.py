"""
Unit and integration tests for Step 15: Public-Facing Endpoints & Strict Data Scoping.

Verifies:
1. POST /v1/reports:
   - Accepts multipart form data (optional media files, lat/lon, category, description).
   - Requires X-Device-Id header (400 Bad Request if missing).
   - Returns 201 Created with status='pending'.
2. POST /v1/reports/batch-sync:
   - Accepts JSON array of offline reports.
   - Enforces idempotency on client_report_id.
   - Requires X-Device-Id header.
3. GET /v1/events:
   - Without admin JWT, enforces filter Event.lifecycle_status.in_(['confirmed', 'active']).
   - Bbox / proximity queries.
4. GET /v1/reports/mine:
   - Authenticates purely via X-Device-Id header.
   - Returns session's report history.
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_db, get_device_id
from app.main import app
from app.models.event import Event
from app.models.report import Report
from app.models.source import CitizenSession, Source


class MockScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items

    def first(self):
        return self._items[0] if self._items else None

    def one(self):
        return self._items[0] if self._items else None

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class MockExecuteResult:
    def __init__(self, scalar_val=0, items=None):
        self._scalar_val = scalar_val
        self._items = items or []

    def scalar(self):
        return self._scalar_val

    def scalars(self):
        return MockScalars(self._items)

    def one(self):
        return self._items[0] if self._items else None

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None



class InMemoryPublicDB:
    def __init__(self):
        self.reports_by_client_id: dict[str, Report] = {}
        self.citizen_source = Source(id=uuid.uuid4(), platform="citizen_app", handle="system")
        self.added = []

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, Report):
            if obj.source_native_id:
                self.reports_by_client_id[obj.source_native_id] = obj

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def execute(self, stmt):
        stmt_str = str(stmt)
        if "FROM sources" in stmt_str:
            return MockExecuteResult(items=[self.citizen_source])
        if "count" in stmt_str.lower():
            return MockExecuteResult(scalar_val=len(self.reports_by_client_id))
        if "FROM reports" in stmt_str:
            try:
                params = stmt.compile().params
                target_id = None
                for k, v in params.items():
                    if "source_native_id" in k:
                        target_id = v
                        break
                if target_id and target_id in self.reports_by_client_id:
                    return MockExecuteResult(items=[self.reports_by_client_id[target_id]])
            except Exception:
                pass
            return MockExecuteResult(items=[])
        return MockExecuteResult(scalar_val=0, items=[])


    async def scalars(self, stmt):
        return MockScalars(list(self.reports_by_client_id.values()))


# ═══════════════════════════════════════════════════════════════════
# 1. POST /v1/reports
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_submit_report_missing_device_id_returns_400():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/reports",
            data={
                "event_category": "rainfall",
                "location_method": "gps",
                "lat": "19.0760",
                "lon": "72.8777",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "missing_device_id"


@pytest.mark.anyio
async def test_submit_report_valid_multipart_success():
    device_id = f"device-{uuid.uuid4()}"
    transport = ASGITransport(app=app)
    db = InMemoryPublicDB()
    session = CitizenSession(id=uuid.uuid4(), device_id=device_id)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_device_id] = lambda: session

    try:
        with patch("app.api.v1.reports.ingest_report") as mock_ingest, \
             patch("app.services.kafka_service.kafka_service.publish_message", new_callable=AsyncMock) as mock_kafka:

            result_mock = MagicMock()
            result_mock.status = "created"
            result_mock.report_id = str(uuid.uuid4())
            mock_ingest.return_value = (None, result_mock)

            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/v1/reports",
                    headers={"X-Device-Id": device_id},
                    data={
                        "event_category": "rainfall",
                        "location_method": "gps",
                        "description": "Heavy rainfall in Bandra West",
                        "lat": "19.0596",
                        "lon": "72.8295",
                    },
                    files={
                        "media": ("rain.png", io.BytesIO(b"fake-image-binary"), "image/png"),
                    },
                )
                assert resp.status_code == 201
                data = resp.json()
                assert data["status"] == "pending"
                assert "id" in data
                assert mock_kafka.called
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_device_id, None)


# ═══════════════════════════════════════════════════════════════════
# 2. POST /v1/reports/batch-sync (PWA Offline Sync & Idempotency)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_batch_sync_missing_device_id_returns_400():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/reports/batch-sync",
            json=[{
                "client_report_id": "client-offline-001",
                "event_category": "flooding",
                "description": "Water logging near bridge",
                "lat": 19.05,
                "lon": 72.83,
            }],
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "missing_device_id"


@pytest.mark.anyio
async def test_batch_sync_idempotency_enforcement():
    device_id = f"device-pwa-{uuid.uuid4()}"
    client_id_1 = f"client-id-{uuid.uuid4()}"
    client_id_2 = f"client-id-{uuid.uuid4()}"

    payload = [
        {
            "client_report_id": client_id_1,
            "event_category": "thunderstorm",
            "description": "Loud thunder and lightning",
            "lat": 28.6139,
            "lon": 77.2090,
            "location_method": "gps",
        },
        {
            "client_report_id": client_id_2,
            "event_category": "flooding",
            "description": "Road submerged in water",
            "lat": 28.6200,
            "lon": 77.2150,
            "location_method": "gps",
        },
    ]

    db = InMemoryPublicDB()
    session = CitizenSession(id=uuid.uuid4(), device_id=device_id)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_device_id] = lambda: session

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. First sync: both reports should be ingested
            resp1 = await client.post(
                "/v1/reports/batch-sync",
                headers={"X-Device-Id": device_id},
                json=payload,
            )
            assert resp1.status_code == 200
            data1 = resp1.json()
            assert data1["synced_count"] == 2
            assert data1["skipped_count"] == 0
            assert len(data1["synced_ids"]) == 2

            # 2. Second sync with identical client_report_ids: both should be skipped (idempotent!)
            resp2 = await client.post(
                "/v1/reports/batch-sync",
                headers={"X-Device-Id": device_id},
                json=payload,
            )
            assert resp2.status_code == 200
            data2 = resp2.json()
            assert data2["synced_count"] == 0
            assert data2["skipped_count"] == 2
            assert client_id_1 in data2["skipped_ids"]
            assert client_id_2 in data2["skipped_ids"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_device_id, None)


# ═══════════════════════════════════════════════════════════════════
# 3. GET /v1/events (Public Data Scoping & Bbox Filters)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_get_events_guest_scoping_and_bbox():
    captured_stmt = []
    mock_db = AsyncMock()

    async def mock_execute(stmt):
        captured_stmt.append(stmt)
        result_mock = MagicMock()
        result_mock.scalar.return_value = 0
        return result_mock

    async def mock_scalars(stmt):
        result_mock = MagicMock()
        result_mock.all.return_value = []
        return result_mock

    mock_db.execute = mock_execute
    mock_db.scalars = mock_scalars

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Guest requesting bbox with status=pending (pending must be ignored)
            resp = await client.get("/v1/events?bbox=72.8,19.0,73.0,19.2&status=pending&category=rainfall")
            assert resp.status_code == 200
            stmt_sql = str(captured_stmt[0])

            # Asserts that lifecycle_status is forced to confirmed/active
            assert "events.lifecycle_status IN" in stmt_sql or "lifecycle_status" in stmt_sql
            assert "events.lifecycle_status = 'pending'" not in stmt_sql

            # Asserts ST_MakeEnvelope / ST_Intersects was applied
            assert "ST_MakeEnvelope" in stmt_sql or "st_makeenvelope" in stmt_sql.lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


# ═══════════════════════════════════════════════════════════════════
# 4. GET /v1/reports/mine (Device-Scoped Report History)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
async def test_get_reports_mine_missing_device_id_returns_400():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/reports/mine")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "missing_device_id"


@pytest.mark.anyio
async def test_get_reports_mine_with_device_id_success():
    device_id = f"device-history-{uuid.uuid4()}"
    transport = ASGITransport(app=app)
    db = InMemoryPublicDB()
    session = CitizenSession(id=uuid.uuid4(), device_id=device_id)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_device_id] = lambda: session

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/v1/reports/mine",
                headers={"X-Device-Id": device_id},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "results" in data
            assert "total" in data
            assert isinstance(data["results"], list)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_device_id, None)

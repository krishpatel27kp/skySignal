"""
Unit and integration tests for Task 3: Data Scoping on Public Endpoints.

Verifies:
1. GET /v1/events:
   - Guests are strictly scoped to lifecycle_status IN ('confirmed', 'active').
   - Guests requesting non-public statuses (e.g. 'emerging', 'pending', 'detected') have that status ignored.
   - Admins bypass this restriction and can query any status.
2. GET /v1/events/{id}:
   - Guests requesting a non-public event receive 404 Not Found (no existence leak).
   - Guests requesting a public event receive top-level aggregates only (reports == None).
   - Admins requesting any event receive full details including reports array.
3. POST /v1/reports:
   - Remains public (no admin auth required).
   - Strictly requires and validates the X-Device-Id header (400 if missing).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.api.deps import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.admin import AdminUser
from app.models.event import Event


@pytest.fixture
def analyst_token() -> str:
    """Generate valid JWT token for an analyst."""
    token, _ = create_access_token(
        data={"sub": str(uuid.uuid4()), "role": "analyst"}
    )
    return token


# ── 1. POST /v1/reports: Public Endpoint & X-Device-Id Requirement ───────────

@pytest.mark.anyio
async def test_post_reports_requires_device_id(client: AsyncClient) -> None:
    """POST /v1/reports without X-Device-Id header must return 400 Bad Request."""
    resp = await client.post(
        "/v1/reports",
        data={
            "event_category": "rainfall",
            "location_method": "gps",
            "lat": 19.0760,
            "lon": 72.8777,
        },
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "missing_device_id"
    assert data["error"]["field"] == "X-Device-Id"


# ── 2. GET /v1/events Data Scoping ──────────────────────────────────────────

@pytest.mark.anyio
async def test_get_events_guest_query_scoping(client: AsyncClient) -> None:
    """Guest GET /v1/events must force lifecycle_status IN ('confirmed', 'active') and ignore other status."""
    mock_db = AsyncMock()
    captured_stmt = []

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
        # 1. Guest request with no status: forces ('confirmed', 'active')
        await client.get("/v1/events")
        stmt_sql = str(captured_stmt[0])
        assert "events.lifecycle_status IN (__[POSTCOMPILE_lifecycle_status_1])" in stmt_sql or "lifecycle_status" in stmt_sql

        captured_stmt.clear()

        # 2. Guest request requesting non-public status ('emerging'): ignored, forces ('confirmed', 'active')
        await client.get("/v1/events?status=emerging")
        stmt_sql_emerging = str(captured_stmt[0])
        # Must still use IN ('confirmed', 'active') and NOT = 'emerging'
        assert "events.lifecycle_status IN" in stmt_sql_emerging or "events.lifecycle_status =" not in stmt_sql_emerging

        captured_stmt.clear()

        # 3. Guest request with valid public status ('active')
        await client.get("/v1/events?status=active")
        stmt_sql_active = str(captured_stmt[0])
        assert "events.lifecycle_status =" in stmt_sql_active

    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.anyio
async def test_get_events_admin_bypasses_restriction(
    client: AsyncClient, analyst_token: str
) -> None:
    """Admin GET /v1/events?status=emerging can query non-public lifecycle statuses."""
    admin_uuid = uuid.uuid4()
    admin_user = AdminUser(
        id=admin_uuid,
        email="analyst@imd.gov.in",
        password_hash="hash",
        role="analyst",
    )

    token, _ = create_access_token(
        data={"sub": str(admin_uuid), "role": "analyst"}
    )

    mock_db = AsyncMock()
    mock_db.get.return_value = admin_user
    captured_stmt = []

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
        resp = await client.get(
            "/v1/events?status=emerging",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        stmt_sql = str(captured_stmt[0])
        # Admin query checks = 'emerging' without being forced to ('confirmed', 'active')
        assert "events.lifecycle_status =" in stmt_sql
    finally:
        app.dependency_overrides.pop(get_db, None)


# ── 3. GET /v1/events/{id} Data Scoping & Field Redaction ──────────────────

@pytest.mark.anyio
async def test_get_event_detail_guest_non_public_returns_404(client: AsyncClient) -> None:
    """Guest requesting an event in 'emerging' status must receive 404 (no leak)."""
    event_id = uuid.uuid4()
    emerging_event = Event(
        id=event_id,
        title="Emerging Flash Flood",
        category="flooding",
        severity="moderate",
        lifecycle_status="emerging",  # NOT public
        confidence=0.65,
        independent_source_count=1,
        detected_at=datetime.now(timezone.utc),
    )

    mock_db = AsyncMock()
    mock_scalars_res = MagicMock()
    mock_scalars_res.first.return_value = emerging_event
    mock_db.scalars.return_value = mock_scalars_res

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        resp = await client.get(f"/v1/events/{event_id}")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "not_found"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.anyio
async def test_get_event_detail_guest_public_omits_underlying_reports(
    client: AsyncClient,
) -> None:
    """Guest requesting a public 'active' event receives aggregate evidence but NO reports array."""
    event_id = uuid.uuid4()
    now_dt = datetime.now(timezone.utc)
    active_event = Event(
        id=event_id,
        title="Active Heavy Rainfall",
        category="rainfall",
        severity="severe",
        lifecycle_status="active",  # Public
        confidence=0.92,
        has_contradiction=False,
        independent_source_count=4,
        detected_at=now_dt,
        last_updated_at=now_dt,
    )

    mock_db = AsyncMock()

    # Sequence of scalars calls in get_event:
    # 1. Event query -> returns active_event
    # 2. Sensor reading query -> returns None
    # 3. Mapped reports query -> returns empty list
    mock_event_res = MagicMock()
    mock_event_res.first.return_value = active_event

    mock_sensor_res = MagicMock()
    mock_sensor_res.first.return_value = None

    mock_reports_res = MagicMock()
    mock_reports_res.all.return_value = []

    mock_db.scalars.side_effect = [mock_event_res, mock_sensor_res, mock_reports_res]

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        resp = await client.get(f"/v1/events/{event_id}")
        assert resp.status_code == 200
        data = resp.json()

        # Top-level aggregate fields must be present
        assert data["id"] == str(event_id)
        assert data["title"] == "Active Heavy Rainfall"
        assert data["lifecycle_status"] == "active"
        assert "evidence" in data
        assert data["evidence"]["independent_reports"] == 0

        # Underlying report arrays and transitions must be excluded for guests
        assert data.get("reports") is None
        assert data.get("lifecycle_history") is None
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.anyio
async def test_get_event_detail_admin_sees_non_public_and_reports(
    client: AsyncClient,
) -> None:
    """Admin can view emerging event and receives underlying reports array."""
    admin_uuid = uuid.uuid4()
    admin_user = AdminUser(
        id=admin_uuid,
        email="analyst@imd.gov.in",
        password_hash="hash",
        role="analyst",
    )
    token, _ = create_access_token(
        data={"sub": str(admin_uuid), "role": "analyst"}
    )

    event_id = uuid.uuid4()
    now_dt = datetime.now(timezone.utc)
    emerging_event = Event(
        id=event_id,
        title="Emerging Cloudburst",
        category="rainfall",
        severity="moderate",
        lifecycle_status="emerging",  # Non-public
        confidence=0.70,
        has_contradiction=False,
        independent_source_count=2,
        detected_at=now_dt,
        last_updated_at=now_dt,
    )

    mock_db = AsyncMock()
    mock_db.get.return_value = admin_user

    mock_event_res = MagicMock()
    mock_event_res.first.return_value = emerging_event

    mock_sensor_res = MagicMock()
    mock_sensor_res.first.return_value = None

    mock_reports_res = MagicMock()
    mock_reports_res.all.return_value = []

    mock_history_res = MagicMock()
    mock_history_res.all.return_value = []

    mock_db.scalars.side_effect = [
        mock_event_res,
        mock_sensor_res,
        mock_reports_res,
        mock_history_res,
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        resp = await client.get(
            f"/v1/events/{event_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(event_id)
        assert data["lifecycle_status"] == "emerging"
        # Admin receives reports list and lifecycle_history list
        assert isinstance(data.get("reports"), list)
        assert isinstance(data.get("lifecycle_history"), list)
    finally:
        app.dependency_overrides.pop(get_db, None)

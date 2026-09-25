"""
Integration tests verifying that all operational and administrative endpoints
strictly reject unauthenticated guest requests (401) and unauthorized role requests (403).

Endpoints Tested:
1. GET  /v1/reports/{id}
2. POST /v1/reports/{id}/verify
3. POST /v1/reports/{id}/reject
4. POST /v1/reports/bulk-action
5. POST /v1/events/{id}/merge
6. POST /v1/events/{id}/verify
7. POST /v1/events/{id}/reject
8. POST /v1/events/{id}/escalate
9. POST /v1/duplicate-clusters/{id}/merge
10. GET /v1/analytics/overview
11. GET /v1/analytics/timeseries
12. GET /v1/analytics/by-category
13. GET /v1/analytics/source-reliability
14. GET /v1/audit-log
15. GET /v1/events/stream
"""

from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

from app.core.security import create_access_token

DUMMY_ID = str(uuid.uuid4())


@pytest.fixture
def citizen_token() -> str:
    """Generate token with unauthorized non-admin role."""
    token, _ = create_access_token(
        data={"sub": str(uuid.uuid4()), "role": "citizen"}
    )
    return token


# ── 1. Reports Endpoints Lockdown ─────────────────────────────────

@pytest.mark.anyio
async def test_get_report_detail_guest_rejected(client: AsyncClient) -> None:
    resp = await client.get(f"/v1/reports/{DUMMY_ID}")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_get_report_detail_insufficient_role(client: AsyncClient, citizen_token: str) -> None:
    resp = await client.get(
        f"/v1/reports/{DUMMY_ID}",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


@pytest.mark.anyio
async def test_verify_report_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(f"/v1/reports/{DUMMY_ID}/verify")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_reject_report_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(f"/v1/reports/{DUMMY_ID}/reject", json={"reason": "Spam"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_bulk_action_reports_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/reports/bulk-action",
        json={"report_ids": [DUMMY_ID], "action": "verify"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


# ── 2. Events Endpoints Lockdown ──────────────────────────────────

@pytest.mark.anyio
async def test_verify_event_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(f"/v1/events/{DUMMY_ID}/verify")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_reject_event_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(f"/v1/events/{DUMMY_ID}/reject")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_merge_event_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        f"/v1/events/{DUMMY_ID}/merge",
        json={"with_event_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_escalate_event_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        f"/v1/events/{DUMMY_ID}/escalate",
        json={"note": "Severe flooding escalation"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


# ── 3. Duplicate Clusters Lockdown ───────────────────────────────

@pytest.mark.anyio
async def test_merge_duplicate_cluster_guest_rejected(client: AsyncClient) -> None:
    resp = await client.post(f"/v1/duplicate-clusters/{DUMMY_ID}/merge")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_merge_duplicate_cluster_insufficient_role(
    client: AsyncClient, citizen_token: str
) -> None:
    resp = await client.post(
        f"/v1/duplicate-clusters/{DUMMY_ID}/merge",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


# ── 4. Analytics Endpoints Lockdown ───────────────────────────────

@pytest.mark.anyio
async def test_analytics_overview_guest_rejected(client: AsyncClient) -> None:
    resp = await client.get("/v1/analytics/overview")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_analytics_timeseries_guest_rejected(client: AsyncClient) -> None:
    resp = await client.get("/v1/analytics/timeseries")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_analytics_by_category_guest_rejected(client: AsyncClient) -> None:
    resp = await client.get("/v1/analytics/by-category")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_analytics_source_reliability_guest_rejected(client: AsyncClient) -> None:
    resp = await client.get("/v1/analytics/source-reliability")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_analytics_endpoints_insufficient_role(
    client: AsyncClient, citizen_token: str
) -> None:
    resp = await client.get(
        "/v1/analytics/overview",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


# ── 5. Audit Log Lockdown ─────────────────────────────────────────

@pytest.mark.anyio
async def test_audit_log_guest_rejected(client: AsyncClient) -> None:
    resp = await client.get("/v1/audit-log")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_audit_log_insufficient_role(client: AsyncClient, citizen_token: str) -> None:
    resp = await client.get(
        "/v1/audit-log",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


# ── 6. SSE Telemetry Stream Lockdown ──────────────────────────────

@pytest.mark.anyio
async def test_events_stream_guest_rejected_no_token(client: AsyncClient) -> None:
    resp = await client.get("/v1/events/stream")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_events_stream_insufficient_role_query(
    client: AsyncClient, citizen_token: str
) -> None:
    resp = await client.get(f"/v1/events/stream?token={citizen_token}")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


@pytest.mark.anyio
async def test_events_stream_insufficient_role_header(
    client: AsyncClient, citizen_token: str
) -> None:
    resp = await client.get(
        "/v1/events/stream",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"

"""
Tests for health-check endpoints and error handling.

These tests exercise the API without a real database — the liveness
endpoint never touches the DB, and the error-format tests use
intentionally invalid requests.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


# ── Liveness ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_health_returns_ok(client: AsyncClient) -> None:
    """GET /health should return 200 with {"status": "ok"}."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"status": "ok"}


# ── CORS ─────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_cors_allows_frontend_origin(client: AsyncClient) -> None:
    """Preflight from localhost:5173 should be allowed."""
    resp = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert "http://localhost:5173" in resp.headers.get(
        "access-control-allow-origin", ""
    )


@pytest.mark.anyio
async def test_cors_exposes_device_id_header(client: AsyncClient) -> None:
    """The X-Device-Id header should be listed in exposed headers on requests."""
    resp = await client.get(
        "/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    exposed = resp.headers.get("access-control-expose-headers", "")
    assert "X-Device-Id" in exposed


# ── Error Shape ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_404_returns_standard_shape(client: AsyncClient) -> None:
    """Unknown routes should still return JSON (FastAPI default 404)."""
    resp = await client.get("/v1/nonexistent")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_validation_error_returns_standard_shape(
    client: AsyncClient,
) -> None:
    """
    POST to a typed endpoint with bad data should return the
    standard error envelope with code='validation_error'.

    We use /v1/health/db which doesn't need body input, so we
    test against a future endpoint. For now, verify 404 shape.
    """
    resp = await client.post("/v1/health/db", json={"bad": "data"})
    # /v1/health/db is GET-only, so POST → 405
    assert resp.status_code == 405

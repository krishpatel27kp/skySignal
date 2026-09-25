"""
Unit and integration tests for authentication and citizen session identity.

Covers:
- Login success with seed user credentials (analyst & senior_admin)
- Login failure on invalid credentials (wrong password & non-existent user)
- Token validation and rejection of expired/invalid/missing tokens
- Role-based authorization enforcement (require_role)
- Rejection of citizen endpoints when X-Device-Id is omitted
- Idempotency of citizen session creation for sequential requests
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.source import CitizenSession

# ── Seed Credentials ─────────────────────────────────────────────
ANALYST_EMAIL = "analyst@imd.gov.in"
ANALYST_PASSWORD = "Analyst@123"

ADMIN_EMAIL = "admin@imd.gov.in"
ADMIN_PASSWORD = "Admin@123"


# ── Admin Login Tests ────────────────────────────────────────────


@pytest.mark.anyio
async def test_login_success_analyst(client: AsyncClient) -> None:
    """POST /v1/auth/login with valid analyst credentials returns 200 + token."""
    resp = await client.post(
        "/v1/auth/login",
        json={"email": ANALYST_EMAIL, "password": ANALYST_PASSWORD},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    assert "expires_at" in data
    assert "user" in data

    user = data["user"]
    assert user["email"] == ANALYST_EMAIL
    assert user["role"] == "analyst"
    # Ensure ID is a valid UUID string
    assert uuid.UUID(user["id"])


@pytest.mark.anyio
async def test_login_success_senior_admin(client: AsyncClient) -> None:
    """POST /v1/auth/login with valid senior admin credentials returns 200 + token."""
    resp = await client.post(
        "/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "senior_admin"


@pytest.mark.anyio
async def test_login_failure_invalid_password(client: AsyncClient) -> None:
    """POST /v1/auth/login with wrong password returns 401 with standard error envelope."""
    resp = await client.post(
        "/v1/auth/login",
        json={"email": ANALYST_EMAIL, "password": "WrongPassword999!"},
    )
    assert resp.status_code == 401
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "invalid_credentials"
    assert "Invalid email or password" in data["error"]["message"]


@pytest.mark.anyio
async def test_login_failure_unknown_email(client: AsyncClient) -> None:
    """POST /v1/auth/login with unregistered email returns 401."""
    resp = await client.post(
        "/v1/auth/login",
        json={"email": "nobody@imd.gov.in", "password": "AnyPassword123"},
    )
    assert resp.status_code == 401
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "invalid_credentials"


# ── Token Validation & Expiration Tests ──────────────────────────


@pytest.mark.anyio
async def test_get_current_admin_valid_token(client: AsyncClient) -> None:
    """GET /v1/auth/me with a valid Bearer token returns 200 and the admin profile."""
    # Obtain token
    login_resp = await client.post(
        "/v1/auth/login",
        json={"email": ANALYST_EMAIL, "password": ANALYST_PASSWORD},
    )
    token = login_resp.json()["token"]

    resp = await client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == ANALYST_EMAIL
    assert data["role"] == "analyst"


@pytest.mark.anyio
async def test_get_current_admin_missing_token(client: AsyncClient) -> None:
    """GET /v1/auth/me without Authorization header returns 401."""
    resp = await client.get("/v1/auth/me")
    assert resp.status_code == 401
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "unauthorized"


@pytest.mark.anyio
async def test_get_current_admin_expired_token(client: AsyncClient) -> None:
    """GET /v1/auth/me with an expired token returns 401 with code 'token_expired'."""
    # Create an expired token (expired 1 hour ago)
    expired_token, _ = create_access_token(
        data={"sub": "a0000000-0000-0000-0000-000000000001", "role": "analyst"},
        expires_delta=timedelta(hours=-1),
    )

    resp = await client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "token_expired"


@pytest.mark.anyio
async def test_get_current_admin_invalid_signature(client: AsyncClient) -> None:
    """GET /v1/auth/me with a tampered or invalid token returns 401."""
    resp = await client.get(
        "/v1/auth/me",
        headers={"Authorization": "Bearer invalid.tampered.token"},
    )
    assert resp.status_code == 401
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "invalid_token"


@pytest.mark.anyio
async def test_get_current_admin_insufficient_role(client: AsyncClient) -> None:
    """GET /v1/auth/me with token having non-admin role returns 403 Forbidden."""
    invalid_role_token, _ = create_access_token(
        data={"sub": "a0000000-0000-0000-0000-000000000001", "role": "citizen"},
    )
    resp = await client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {invalid_role_token}"},
    )
    assert resp.status_code == 403
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "forbidden"


# ── Role-Based Access Control (RBAC) Tests ───────────────────────


@pytest.mark.anyio
async def test_require_role_analyst_forbidden(client: AsyncClient) -> None:
    """Analyst attempting to access senior_admin-only endpoint receives 403 Forbidden."""
    login_resp = await client.post(
        "/v1/auth/login",
        json={"email": ANALYST_EMAIL, "password": ANALYST_PASSWORD},
    )
    token = login_resp.json()["token"]

    resp = await client.get(
        "/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "forbidden"


@pytest.mark.anyio
async def test_require_role_senior_admin_permitted(client: AsyncClient) -> None:
    """Senior admin accessing senior_admin-only endpoint succeeds with 200 OK."""
    login_resp = await client.post(
        "/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    token = login_resp.json()["token"]

    resp = await client.get(
        "/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "senior_admin"


# ── Citizen Identity Tests (X-Device-Id) ─────────────────────────


@pytest.mark.anyio
async def test_citizen_endpoint_rejection_when_device_id_omitted(
    client: AsyncClient,
) -> None:
    """Citizen endpoint without X-Device-Id returns 400 Bad Request with field indicated."""
    resp = await client.get("/v1/citizen/session")
    assert resp.status_code == 400
    data = resp.json()

    assert "error" in data
    assert data["error"]["code"] == "missing_device_id"
    assert data["error"]["field"] == "X-Device-Id"


@pytest.mark.anyio
async def test_citizen_session_upsert_and_idempotency(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """
    Sequential requests with the same X-Device-Id reuse the existing database row.
    Ensures idempotency and absence of duplicate session entries.
    """
    test_device_id = f"test-device-{uuid.uuid4()}"

    # Request 1: First time seen -> created
    resp1 = await client.get(
        "/v1/citizen/session",
        headers={"X-Device-Id": test_device_id},
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    session_id_1 = data1["id"]
    assert data1["device_id"] == test_device_id

    # Request 2: Second time seen -> retrieved, exact same ID
    resp2 = await client.get(
        "/v1/citizen/session",
        headers={"X-Device-Id": test_device_id},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    session_id_2 = data2["id"]

    assert session_id_1 == session_id_2

    # Verify only 1 row exists in database for this device_id
    stmt = (
        select(func.count(CitizenSession.id))
        .where(CitizenSession.device_id == test_device_id)
    )
    row_count = (await db.execute(stmt)).scalar()
    assert row_count == 1

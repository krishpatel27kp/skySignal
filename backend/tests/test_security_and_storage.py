"""
Tests for Step 14: Security Boundaries, JWT Dependencies, and MinIO Object Storage.
"""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient

from app.core.security import (
    ALLOWED_ADMIN_ROLES,
    DEMO_ANALYST_EMAIL,
    DEMO_ANALYST_PASSWORD,
    create_access_token,
    decode_access_token,
    get_current_admin,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.main import app
from app.models.admin import AdminUser
from app.services.storage import ensure_bucket_exists, get_minio_client, upload_file


class MockResult:
    def __init__(self, item=None):
        self.item = item

    def scalar_one_or_none(self):
        return self.item


class MockAsyncSession:
    """Mock session for security dependency testing."""

    def __init__(self, user_map=None):
        self.user_map = user_map or {}

    async def get(self, model, user_id):
        return self.user_map.get(user_id)

    async def execute(self, stmt):
        return MockResult(None)



# ═══════════════════════════════════════════════════════════════════
# 1. SECURITY & JWT TESTS
# ═══════════════════════════════════════════════════════════════════


def test_password_hashing_and_verification():
    raw = "Analyst@123"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_encode_decode_cycle():
    payload = {"sub": str(uuid.uuid4()), "role": "analyst", "email": "test@imd.gov.in"}
    token, expires_at = create_access_token(payload, expires_delta=timedelta(minutes=30))
    decoded = decode_access_token(token)
    assert decoded["sub"] == payload["sub"]
    assert decoded["role"] == "analyst"
    assert decoded["email"] == "test@imd.gov.in"
    assert decoded["exp"] > datetime.now(timezone.utc).timestamp()


@pytest.mark.asyncio
async def test_get_current_admin_valid_analyst():
    user_id = uuid.uuid4()
    admin = AdminUser(id=user_id, email="analyst@imd.gov.in", role="analyst")
    db = MockAsyncSession({user_id: admin})

    token, _ = create_access_token({"sub": str(user_id), "role": "analyst"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    result = await get_current_admin(credentials=creds, db=db)
    assert result.id == user_id
    assert result.role == "analyst"


@pytest.mark.asyncio
async def test_get_current_admin_valid_senior_admin():
    user_id = uuid.uuid4()
    admin = AdminUser(id=user_id, email="senior@imd.gov.in", role="senior_admin")
    db = MockAsyncSession({user_id: admin})

    token, _ = create_access_token({"sub": str(user_id), "role": "senior_admin"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    result = await get_current_admin(credentials=creds, db=db)
    assert result.id == user_id
    assert result.role == "senior_admin"


@pytest.mark.asyncio
async def test_get_current_admin_expired_token_raises_401():
    token, _ = create_access_token({"sub": str(uuid.uuid4()), "role": "analyst"}, expires_delta=timedelta(seconds=-10))
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=MockAsyncSession())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_admin_invalid_token_raises_401():
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.payload")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=MockAsyncSession())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_admin_insufficient_role_raises_403():
    user_id = uuid.uuid4()
    token, _ = create_access_token({"sub": str(user_id), "role": "citizen"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=MockAsyncSession())
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_get_current_admin_missing_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=None, db=MockAsyncSession())
    assert exc_info.value.status_code == 401


# ═══════════════════════════════════════════════════════════════════
# 2. LOGIN ENDPOINT (POST /v1/auth/login)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_login_demo_credentials():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/login",
            json={
                "email": DEMO_ANALYST_EMAIL,
                "password": DEMO_ANALYST_PASSWORD,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["token"] is not None
        assert data["user"]["email"] == DEMO_ANALYST_EMAIL
        assert data["user"]["role"] == "analyst"

        # Verify issued token can be parsed and authenticated
        decoded = decode_access_token(data["token"])
        assert decoded["email"] == DEMO_ANALYST_EMAIL
        assert decoded["role"] == "analyst"


@pytest.mark.asyncio
async def test_login_invalid_credentials():
    async def override_get_db():
        yield MockAsyncSession()

    app.dependency_overrides[get_db] = override_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/auth/login",
                json={
                    "email": "unknown@imd.gov.in",
                    "password": "WrongPassword123",
                },
            )
            assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


# ═══════════════════════════════════════════════════════════════════
# 3. OBJECT STORAGE (MINIO / S3) TESTS
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_upload_file_generates_uuid_url():
    dummy_bytes = b"fake image byte data representing rain radar"
    upload = UploadFile(
        file=io.BytesIO(dummy_bytes),
        filename="cloud_burst.png",
        headers={"content-type": "image/png"},
    )

    mock_minio = MagicMock()
    mock_minio.bucket_exists.return_value = True

    with patch("app.services.storage.get_minio_client", return_value=mock_minio):
        url = await upload_file(upload, bucket="media")
        assert url is not None
        assert "media" in url
        assert url.endswith(".png")
        assert mock_minio.put_object.called

        # Validate arguments to put_object
        call_kwargs = mock_minio.put_object.call_args.kwargs
        assert call_kwargs["bucket_name"] == "media"
        assert call_kwargs["object_name"].endswith(".png")
        assert call_kwargs["length"] == len(dummy_bytes)
        assert call_kwargs["content_type"] == "image/png"


@pytest.mark.asyncio
async def test_ensure_bucket_creates_missing_bucket():
    mock_minio = MagicMock()
    mock_minio.bucket_exists.return_value = False

    result = ensure_bucket_exists(mock_minio, "media")
    assert result is True
    mock_minio.make_bucket.assert_called_once_with("media")

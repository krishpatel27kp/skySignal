"""
Unit tests for get_current_admin FastAPI dependency and RBAC boundaries.
Mocks database calls to run completely in isolation without requiring PostgreSQL.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import ALLOWED_ADMIN_ROLES, get_current_admin, require_role
from app.core.errors import AppError
from app.core.security import create_access_token
from app.models.admin import AdminUser


@pytest.fixture
def mock_db() -> AsyncMock:
    """Fixture providing a mock AsyncSession."""
    return AsyncMock()


@pytest.mark.anyio
async def test_get_current_admin_missing_credentials(mock_db: AsyncMock) -> None:
    """Missing or None credentials must raise HTTPException 401."""
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=None, db=mock_db)

    assert exc_info.value.status_code == 401
    assert isinstance(exc_info.value, AppError)
    assert exc_info.value.code == "unauthorized"


@pytest.mark.anyio
async def test_get_current_admin_non_bearer_scheme(mock_db: AsyncMock) -> None:
    """Non-Bearer scheme credentials must raise HTTPException 401."""
    creds = HTTPAuthorizationCredentials(scheme="Basic", credentials="some_token")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "unauthorized"


@pytest.mark.anyio
async def test_get_current_admin_expired_token(mock_db: AsyncMock) -> None:
    """Expired JWT must raise HTTPException 401 with code 'token_expired'."""
    user_id = str(uuid.uuid4())
    expired_token, _ = create_access_token(
        data={"sub": user_id, "role": "analyst"},
        expires_delta=timedelta(hours=-1),
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "token_expired"


@pytest.mark.anyio
async def test_get_current_admin_invalid_token(mock_db: AsyncMock) -> None:
    """Malformed or invalid signature must raise HTTPException 401 with code 'invalid_token'."""
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.here")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "invalid_token"


@pytest.mark.anyio
async def test_get_current_admin_missing_sub(mock_db: AsyncMock) -> None:
    """JWT missing 'sub' claim must raise HTTPException 401 with code 'invalid_token'."""
    token, _ = create_access_token(data={"role": "analyst"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "invalid_token"


@pytest.mark.anyio
async def test_get_current_admin_invalid_uuid_sub(mock_db: AsyncMock) -> None:
    """JWT with invalid UUID 'sub' claim must raise HTTPException 401 with code 'invalid_token'."""
    token, _ = create_access_token(data={"sub": "not-a-valid-uuid", "role": "analyst"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "invalid_token"


@pytest.mark.anyio
async def test_get_current_admin_insufficient_role_in_token(mock_db: AsyncMock) -> None:
    """JWT with role other than 'analyst' or 'senior_admin' must raise HTTPException 403 Forbidden."""
    user_id = str(uuid.uuid4())
    token, _ = create_access_token(data={"sub": user_id, "role": "citizen"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "forbidden"
    assert "insufficient" in exc_info.value.detail


@pytest.mark.anyio
async def test_get_current_admin_user_not_found_in_db(mock_db: AsyncMock) -> None:
    """Valid JWT but user nonexistent in DB must raise HTTPException 401."""
    user_id = str(uuid.uuid4())
    token, _ = create_access_token(data={"sub": user_id, "role": "analyst"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    # Mock DB get returns None
    mock_db.get.return_value = None

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "user_not_found"


@pytest.mark.anyio
async def test_get_current_admin_insufficient_role_in_db(mock_db: AsyncMock) -> None:
    """User exists in DB but role is unauthorized (not analyst or senior_admin) -> 403 Forbidden."""
    user_uuid = uuid.uuid4()
    token, _ = create_access_token(data={"sub": str(user_uuid), "role": "analyst"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    fake_user = AdminUser(
        id=user_uuid,
        email="guest@imd.gov.in",
        password_hash="fakehash",
        role="guest_observer",  # Not in ALLOWED_ADMIN_ROLES
    )
    mock_db.get.return_value = fake_user

    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(credentials=creds, db=mock_db)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "forbidden"


@pytest.mark.anyio
async def test_get_current_admin_valid_analyst(mock_db: AsyncMock) -> None:
    """Valid token with 'analyst' role succeeds and returns AdminUser."""
    user_uuid = uuid.uuid4()
    token, _ = create_access_token(data={"sub": str(user_uuid), "role": "analyst"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    fake_user = AdminUser(
        id=user_uuid,
        email="analyst@imd.gov.in",
        password_hash="fakehash",
        role="analyst",
    )
    mock_db.get.return_value = fake_user

    admin = await get_current_admin(credentials=creds, db=mock_db)
    assert admin == fake_user
    assert admin.role == "analyst"


@pytest.mark.anyio
async def test_get_current_admin_valid_senior_admin(mock_db: AsyncMock) -> None:
    """Valid token with 'senior_admin' role succeeds and returns AdminUser."""
    user_uuid = uuid.uuid4()
    token, _ = create_access_token(data={"sub": str(user_uuid), "role": "senior_admin"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    fake_user = AdminUser(
        id=user_uuid,
        email="admin@imd.gov.in",
        password_hash="fakehash",
        role="senior_admin",
    )
    mock_db.get.return_value = fake_user

    admin = await get_current_admin(credentials=creds, db=mock_db)
    assert admin == fake_user
    assert admin.role == "senior_admin"


@pytest.mark.anyio
async def test_require_role_factory(mock_db: AsyncMock) -> None:
    """require_role dependency factory correctly gates endpoints."""
    senior_only_dep = require_role("senior_admin")

    analyst_user = AdminUser(
        id=uuid.uuid4(),
        email="analyst@imd.gov.in",
        password_hash="fakehash",
        role="analyst",
    )
    senior_user = AdminUser(
        id=uuid.uuid4(),
        email="senior@imd.gov.in",
        password_hash="fakehash",
        role="senior_admin",
    )

    # Analyst blocked
    with pytest.raises(HTTPException) as exc_info:
        await senior_only_dep(current_admin=analyst_user)
    assert exc_info.value.status_code == 403

    # Senior Admin allowed
    result = await senior_only_dep(current_admin=senior_user)
    assert result == senior_user

"""
Authentication and session endpoints:
- ``POST /v1/auth/login``: Admin JWT authentication
- ``GET /v1/auth/me``: Active admin user profile
- ``GET /v1/citizen/session``: Anonymous citizen session sync
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db, get_device_id, require_role
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.admin import AdminUser
from app.models.source import CitizenSession
from app.schemas.auth import (
    AdminUserOut,
    CitizenSessionOut,
    LoginRequest,
    LoginResponse,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
citizen_router = APIRouter(prefix="/citizen", tags=["Citizen"])


# ── Admin Authentication ─────────────────────────────────────────


@auth_router.post(
    "/login",
    response_model=LoginResponse,
    summary="Admin user login",
    description="Authenticates IMD analyst or senior admin with email and password, issuing an 8-hour JWT.",
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Validate credentials and issue JWT bearer token."""
    # 1. Check hardcoded demo credentials for analyst@imd.gov.in
    if payload.email.lower() == "analyst@imd.gov.in" and payload.password == "Analyst@123":
        demo_user_id = uuid.UUID("00000000-0000-4000-8000-000000000001")
        demo_user = AdminUser(
            id=demo_user_id,
            email="analyst@imd.gov.in",
            role="analyst",
            password_hash=hash_password("Analyst@123"),
        )
        token, expires_at = create_access_token(
            data={
                "sub": str(demo_user_id),
                "email": demo_user.email,
                "role": demo_user.role,
            }
        )
        return LoginResponse(
            token=token,
            expires_at=expires_at,
            user=AdminUserOut(
                id=demo_user_id,
                email="analyst@imd.gov.in",
                role="analyst",
                created_at=datetime.now(timezone.utc),
            ),
        )

    # 2. Database user credential lookup
    stmt = select(AdminUser).where(AdminUser.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            message="Invalid email or password",
        )

    token, expires_at = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        }
    )

    return LoginResponse(
        token=token,
        expires_at=expires_at,
        user=AdminUserOut.model_validate(user),
    )


@auth_router.get(
    "/me",
    response_model=AdminUserOut,
    summary="Get current admin user profile",
    description="Returns the profile of the currently authenticated admin user.",
)
async def get_me(
    current_admin: AdminUser = Depends(get_current_admin),
) -> AdminUserOut:
    """Retrieve profile of the token holder."""
    return AdminUserOut.model_validate(current_admin)


@auth_router.get(
    "/admin-only",
    response_model=AdminUserOut,
    summary="Senior admin restricted endpoint",
    description="Requires senior_admin role; raises 403 for analyst.",
)
async def admin_only_endpoint(
    current_admin: AdminUser = Depends(require_role("senior_admin")),
) -> AdminUserOut:
    """Restricted endpoint for senior admins."""
    return AdminUserOut.model_validate(current_admin)


# ── Citizen Identity ─────────────────────────────────────────────


@citizen_router.get(
    "/session",
    response_model=CitizenSessionOut,
    summary="Resolve or initialize citizen session",
    description=(
        "Retrieves or creates an anonymous session from the X-Device-Id header. "
        "Device IDs are client-generated anonymous tokens used strictly for "
        "grouping weather reports and offline sync without tracking PII."
    ),
)
async def get_session(
    session: CitizenSession = Depends(get_device_id),
) -> CitizenSessionOut:
    """Return the citizen session ORM instance."""
    return CitizenSessionOut.model_validate(session)

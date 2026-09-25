"""
Security helpers: password hashing with bcrypt and JWT token handling with PyJWT.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError, PyJWTError
from passlib.context import CryptContext

from app.core.config import settings

# ── Password Hashing ─────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Check *plain* against *hashed*."""
    return pwd_context.verify(plain, hashed)


# ── JWT Tokens ───────────────────────────────────────────────────


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> tuple[str, datetime]:
    """
    Create a signed JWT containing *data* as claims.

    If *expires_delta* is ``None`` the token expires after
    ``settings.JWT_EXPIRY_HOURS`` hours (default 8).

    Returns
    -------
    tuple[str, datetime]
        A tuple of (encoded_jwt_string, expires_at_datetime_utc).
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(hours=settings.JWT_EXPIRY_HOURS)
    )
    to_encode.update({
        "iat": now,
        "exp": expire,
    })
    token = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expire


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT using PyJWT.

    Raises
    ------
    ExpiredSignatureError
        If the token has expired past its ``exp`` claim.
    InvalidTokenError
        If the signature is invalid, claims are malformed, or decoding fails.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


import uuid
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_db
from app.models.admin import AdminUser

# Allowed administrative roles for RBAC enforcement
ALLOWED_ADMIN_ROLES: set[str] = {"analyst", "senior_admin"}

# Demo analyst credentials for development and demonstration
DEMO_ANALYST_EMAIL: str = "analyst@imd.gov.in"
DEMO_ANALYST_PASSWORD: str = "Analyst@123"
DEMO_ANALYST_ID: uuid.UUID = uuid.UUID("00000000-0000-4000-8000-000000000001")

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    """
    FastAPI dependency to authenticate an admin user via Bearer JWT token.

    Validates:
    1. Authorization Bearer token presence and format
    2. Signature, integrity, and non-expiration via JWT_SECRET_KEY
    3. User role is strictly 'analyst' or 'senior_admin'
    4. Active existence in DB (or demo analyst fallback)

    Raises
    ------
    HTTPException (401 Unauthorized)
        On missing, expired, or invalid tokens.
    HTTPException (403 Forbidden)
        If role is neither 'analyst' nor 'senior_admin'.
    """
    if not credentials or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Authorization bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except ExpiredSignatureError:
        raise AppError(
            status_code=401,
            code="token_expired",
            message="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (InvalidTokenError, PyJWTError):
        raise AppError(
            status_code=401,
            code="invalid_token",
            message="Invalid or malformed authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise AppError(
            status_code=401,
            code="invalid_token",
            message="Token payload missing subject identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(str(user_id_raw))
    except (ValueError, TypeError):
        raise AppError(
            status_code=401,
            code="invalid_token",
            message="Invalid user identifier in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check role from token claims if present before DB lookup
    token_role = payload.get("role")
    if token_role and token_role not in ALLOWED_ADMIN_ROLES:
        raise AppError(
            status_code=403,
            code="forbidden",
            message=f"Access forbidden: role '{token_role}' is insufficient. Required: analyst or senior_admin",
        )

    admin = await db.get(AdminUser, user_id)
    if not admin:
        if payload.get("email") == DEMO_ANALYST_EMAIL or user_id == DEMO_ANALYST_ID:
            admin = AdminUser(
                id=user_id,
                email=DEMO_ANALYST_EMAIL,
                role="analyst",
                password_hash=hash_password(DEMO_ANALYST_PASSWORD),
            )
        else:
            raise AppError(
                status_code=401,
                code="user_not_found",
                message="Admin user not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Strict RBAC enforcement: verify user's role in database is authorized
    if admin.role not in ALLOWED_ADMIN_ROLES:
        raise AppError(
            status_code=403,
            code="forbidden",
            message=f"Access forbidden: role '{admin.role}' is insufficient. Required: analyst or senior_admin",
        )

    return admin


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "get_current_admin",
    "ALLOWED_ADMIN_ROLES",
    "DEMO_ANALYST_EMAIL",
    "DEMO_ANALYST_PASSWORD",
    "DEMO_ANALYST_ID",
    "bearer_scheme",
    "ExpiredSignatureError",
    "InvalidTokenError",
    "PyJWTError",
]



"""
Health-check endpoints.

- ``GET /health``         — shallow liveness probe (no DB).
- ``GET /v1/health/db``   — deep readiness probe (executes ``SELECT 1``).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def liveness() -> dict:
    """Shallow liveness check — returns immediately without DB access."""
    return {"status": "ok"}


# This router is mounted under /v1, so the path is /v1/health/db.
v1_router = APIRouter(prefix="/health", tags=["health"])


@v1_router.get("/db")
async def readiness(db: AsyncSession = Depends(get_db)) -> dict:
    """
    Deep readiness check — verifies the database connection is alive.

    Executes ``SELECT 1`` via the async session; returns 503 if the
    database is unreachable.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise AppError(
            status_code=503,
            code="database_unavailable",
            message=f"Database health check failed: {exc}",
        ) from exc

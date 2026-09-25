"""
V1 API router — aggregates all sub-routers under the ``/v1`` prefix.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import auth_router, citizen_router
from app.api.v1.health import v1_router as health_router
from app.api.v1.reports import reports_router
from app.api.v1.analytics import analytics_router
from app.api.v1.audit import audit_router
from app.api.v1.stream import stream_router

v1_router = APIRouter(prefix="/v1")

# ── Health ───────────────────────────────────────────────────────
v1_router.include_router(health_router)

# ── Auth & Identity ──────────────────────────────────────────────
v1_router.include_router(auth_router)
v1_router.include_router(citizen_router)

# ── Reports (citizen submission) ─────────────────────────────────
v1_router.include_router(reports_router)

from app.api.v1.events import events_router
from app.api.v1.sources import sources_router
from app.api.v1.clusters import clusters_router

# Operational & Analyst Routers:
v1_router.include_router(analytics_router)
v1_router.include_router(audit_router)
v1_router.include_router(stream_router)
v1_router.include_router(events_router)
v1_router.include_router(sources_router)
v1_router.include_router(clusters_router)

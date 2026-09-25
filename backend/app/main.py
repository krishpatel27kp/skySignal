"""
SkyGrid FastAPI application factory.

Creates the app with:
- CORS middleware (frontend at localhost:5173)
- Lifespan handler for startup/shutdown
- Unified exception handlers
- All v1 routers mounted
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as root_health_router
from app.api.v1.router import v1_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.db.session import engine

logger = logging.getLogger("skygrid")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """
    Startup / shutdown lifecycle.

    - **Startup**: log readiness (DB engine is lazily connected on first query).
    - **Shutdown**: dispose the async engine connection pool.
    """
    logger.info(
        "SkyGrid API starting — env=%s, debug=%s",
        settings.APP_ENV,
        settings.DEBUG,
    )
    
    # Initialize MinIO bucket
    try:
        from app.services.storage_service import storage_service
        storage_service.ensure_bucket()
        logger.info("MinIO bucket '%s' verified/created.", settings.MINIO_BUCKET)
    except Exception as e:
        logger.warning("MinIO bucket initialization failed: %s", e)

    # Initialize Asynchronous Kafka Pipeline Workers
    if settings.ENABLE_KAFKA_WORKERS and settings.APP_ENV != "testing":
        try:
            from app.workers.kafka_workers import kafka_worker_manager
            await kafka_worker_manager.start()
            logger.info("Kafka pipeline workers started.")
        except Exception as e:
            logger.warning("Kafka pipeline workers startup encountered error: %s", e)

    yield

    # Shutdown Kafka Pipeline Workers
    if settings.ENABLE_KAFKA_WORKERS and settings.APP_ENV != "testing":
        try:
            from app.workers.kafka_workers import kafka_worker_manager
            await kafka_worker_manager.stop()
            logger.info("Kafka pipeline workers stopped.")
        except Exception as e:
            logger.warning("Kafka pipeline workers shutdown error: %s", e)

    await engine.dispose()
    logger.info("SkyGrid API shut down — connection pool disposed.")


def create_app() -> FastAPI:
    """Build and return the FastAPI application instance."""

    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "National Weather Event Intelligence Platform — "
            "SIH26069 for MoES/IMD"
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Device-Id"],
    )

    # ── Exception handlers ───────────────────────────────────────
    register_exception_handlers(app)

    # ── Routers ──────────────────────────────────────────────────
    # Root-level health (no prefix)
    app.include_router(root_health_router)
    # All v1 endpoints
    app.include_router(v1_router)

    return app


# Uvicorn entrypoint: ``uvicorn app.main:app --reload``
app = create_app()

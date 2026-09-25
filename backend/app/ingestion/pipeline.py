"""
Ingestion pipeline: validation gate, idempotency, DB persistence, Redis stream publishing.

This is the single choke-point that every per-source adapter feeds into.
All adapters produce a CanonicalReport; this module:
  1. Validates the canonical payload (guards the DB from garbage).
  2. Resolves or provisions the Source ORM record.
  3. Enforces idempotency on (source_id, source_native_id).
  4. Processes and uploads media files via MinIO.
  5. Resolves location, cleans text, and persists the Report + MediaItems.
  6. Publishes an event to the Redis stream 'stream:reports:ingested'.
  7. Routes validation failures to dead_letter_reports.
"""

from __future__ import annotations

import json
import logging
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.report import DeadLetterReport, MediaItem, Report
from app.models.source import CitizenSession, Source
from app.schemas.canonical import CanonicalReport, IngestionResult
from app.utils.normalize import clean_text, process_media, resolve_location, to_utc
from app.workers.tasks import process_report

logger = logging.getLogger("skygrid.pipeline")

REDIS_STREAM = "stream:reports:ingested"


# ── Source Resolution ────────────────────────────────────────────

async def _get_or_create_source(
    db: AsyncSession,
    platform: str,
    handle: str | None,
) -> Source:
    """
    Return the existing Source for (platform, handle) or create a new one.
    Uses an atomic upsert to avoid race conditions under concurrent ingestion.
    """
    stmt = (
        pg_insert(Source)
        .values(platform=platform, handle=handle)
        .on_conflict_do_update(
            constraint="uq_sources_platform_handle",
            set_={"platform": platform},  # no-op update to trigger RETURNING
        )
        .returning(Source)
    )
    result = await db.scalars(stmt)
    return result.one()


# ── Citizen Session Resolution ───────────────────────────────────

async def _get_or_create_citizen_session(
    db: AsyncSession,
    device_id: str,
) -> CitizenSession:
    """Upsert a CitizenSession by device_id."""
    stmt = (
        pg_insert(CitizenSession)
        .values(device_id=device_id)
        .on_conflict_do_update(
            index_elements=["device_id"],
            set_={"device_id": device_id},
        )
        .returning(CitizenSession)
    )
    result = await db.scalars(stmt)
    return result.one()


# ── Idempotency Check ────────────────────────────────────────────

async def _check_duplicate(
    db: AsyncSession,
    source_id: uuid.UUID,
    source_native_id: str | None,
) -> Report | None:
    """Return existing Report if (source_id, source_native_id) already present."""
    if not source_native_id:
        return None
    stmt = select(Report).where(
        Report.source_id == source_id,
        Report.source_native_id == source_native_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


# ── Dead Letter Routing ──────────────────────────────────────────

async def _route_to_dead_letter(
    db: AsyncSession,
    raw_payload: dict[str, Any],
    error_detail: str,
    source_platform: str | None = None,
) -> DeadLetterReport:
    """Persist a failed ingestion attempt to dead_letter_reports."""
    dlq = DeadLetterReport(
        source_platform=source_platform,
        raw_payload=raw_payload,
        error_detail=error_detail,
    )
    db.add(dlq)
    await db.flush()
    return dlq


# ── Redis Stream Publishing ──────────────────────────────────────

async def _publish_to_stream(report_id: str, platform: str) -> None:
    """
    Publish a lightweight report event to the Redis stream.

    Uses an async connection pool. Failure is logged but never
    propagates — the report is already persisted to the DB.
    """
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.xadd(
            REDIS_STREAM,
            {
                "report_id": report_id,
                "source_platform": platform,
                "published_at": datetime.now(timezone.utc).isoformat(),
            },
            maxlen=10_000,  # cap stream length
        )
        await r.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis stream publish failed for report %s: %s", report_id, exc)


# ── Main Entry Point ─────────────────────────────────────────────

async def ingest_report(
    canonical: CanonicalReport | dict[str, Any],
    db: AsyncSession,
    s3_override: Any = None,
) -> tuple[Report | None, IngestionResult]:
    """
    Validate, persist, and publish a single canonical weather report.

    Parameters
    ----------
    canonical : CanonicalReport | dict
        Pre-built CanonicalReport or a raw dict that will be validated.
    db : AsyncSession
        Active async database session (caller must commit).
    s3_override : optional
        Inject a mock S3 client for unit tests.

    Returns
    -------
    tuple[Report | None, IngestionResult]
        The persisted Report (or None on failure) and an IngestionResult
        describing the outcome: 'created', 'duplicate_skipped', or 'dead_letter'.
    """

    # ── 1. Validate ──────────────────────────────────────────────
    if isinstance(canonical, dict):
        raw_dict = canonical
        try:
            canonical = CanonicalReport.model_validate(canonical)
        except ValidationError as exc:
            logger.warning("Validation failure: %s", exc)
            dlq = await _route_to_dead_letter(
                db,
                raw_payload=raw_dict,
                error_detail=str(exc),
                source_platform=raw_dict.get("source_platform"),
            )
            return None, IngestionResult(
                status="dead_letter",
                dead_letter_id=str(dlq.id),
                reason="Pydantic validation failed",
            )
    else:
        # Exclude media_files to avoid UnicodeDecodeError on raw bytes
        raw_dict = canonical.model_dump(exclude={"media_files"}, mode="json")

    # Wrap the entire rest of the pipeline in a guard; any unexpected error
    # routes to the DLQ rather than crashing the caller.
    try:
        # ── 2. Resolve / provision Source ────────────────────────
        source = await _get_or_create_source(
            db, canonical.source_platform, canonical.source_handle
        )

        # ── 3. Idempotency check ─────────────────────────────────
        existing = await _check_duplicate(db, source.id, canonical.source_native_id)
        if existing:
            logger.debug(
                "Duplicate skipped: source=%s native_id=%s",
                canonical.source_platform,
                canonical.source_native_id,
            )
            return existing, IngestionResult(
                status="duplicate_skipped",
                report_id=str(existing.id),
                reason=f"(source_id, source_native_id) already exists: {canonical.source_native_id}",
            )

        # ── 4. Resolve citizen session (citizen_app only) ────────
        citizen_session_id: uuid.UUID | None = None
        if canonical.citizen_device_id:
            cs = await _get_or_create_citizen_session(db, canonical.citizen_device_id)
            citizen_session_id = cs.id

        # ── 5. Normalize text + location ─────────────────────────
        clean, lang = clean_text(canonical.raw_text)

        loc = resolve_location(canonical.lat, canonical.lon, canonical.raw_location_text)
        # Prefer adapter-provided city/state over resolved ones if already set
        city = canonical.city or loc["city"]
        state = canonical.state or loc["state"]
        region = canonical.region or loc["region"]
        geocode_method = loc["geocode_method"]
        geocode_confidence = loc["geocode_confidence"]

        # Build PostGIS WKT POINT
        location_wkt: str | None = None
        if loc["lat"] is not None and loc["lon"] is not None:
            location_wkt = f"SRID=4326;POINT({loc['lon']} {loc['lat']})"
        elif canonical.lon is not None and canonical.lat is not None:
            location_wkt = f"SRID=4326;POINT({canonical.lon} {canonical.lat})"

        # ── 6. Process media files ───────────────────────────────
        # Filter out stubs with empty bytes (e.g., YouTube fixture)
        real_media_files = [
            f for f in canonical.media_files
            if f.get("file_bytes")
        ]
        processed_media = process_media(real_media_files, s3_override=s3_override)

        # Merge precomputed keyframe hashes from fixtures (YouTube adapter)
        fixture_media: list[dict[str, Any]] = []
        for f in canonical.media_files:
            if not f.get("file_bytes") and f.get("_precomputed_keyframe_hashes"):
                fixture_media.append(
                    {
                        "media_type": "video",
                        "storage_url": f"fixture://{f.get('filename', 'video')}",
                        "perceptual_hash": None,
                        "keyframe_hashes": f["_precomputed_keyframe_hashes"],
                    }
                )
        all_media = processed_media + fixture_media

        # ── 7. Persist Report ────────────────────────────────────
        report = Report(
            source_id=source.id,
            citizen_session_id=citizen_session_id,
            source_native_id=canonical.source_native_id,
            raw_text=canonical.raw_text,
            clean_text=clean,
            language=lang,
            location=location_wkt,
            raw_location_text=canonical.raw_location_text,
            city=city,
            state=state,
            region=region,
            geocode_confidence=geocode_confidence,
            geocode_method=geocode_method,
            reported_at=to_utc(canonical.reported_at),
            event_category=canonical.event_category,
            category_confidence=canonical.category_confidence,
            status="pending",
        )
        db.add(report)
        await db.flush()  # get report.id before inserting media items

        # ── 8. Persist MediaItems ────────────────────────────────
        for m in all_media:
            db.add(
                MediaItem(
                    report_id=report.id,
                    media_type=m["media_type"],
                    storage_url=m["storage_url"],
                    perceptual_hash=m.get("perceptual_hash"),
                    keyframe_hashes=m.get("keyframe_hashes"),
                )
            )

        # ── 9. Publish to Redis stream ───────────────────────────
        await _publish_to_stream(str(report.id), canonical.source_platform)

        # ── 10. Trigger Celery Pipeline ──────────────────────────
        from app.workers.tasks import process_report  # noqa: PLC0415
        process_report(str(report.id))

        logger.info(
            "Ingested report %s from %s",
            report.id,
            canonical.source_platform,
        )

        return report, IngestionResult(status="created", report_id=str(report.id))

    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        logger.error("Unhandled pipeline error: %s\n%s", exc, tb)
        dlq = await _route_to_dead_letter(
            db,
            raw_payload=raw_dict,
            error_detail=tb,
            source_platform=canonical.source_platform
            if isinstance(canonical, CanonicalReport)
            else None,
        )
        return None, IngestionResult(
            status="dead_letter",
            dead_letter_id=str(dlq.id),
            reason=str(exc),
        )

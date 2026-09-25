"""
Canonical report schema and ingestion result types.

CanonicalReport is the single normalized intermediate format that every
per-source adapter must produce. The validation gate reads this schema
before persisting a record to the database.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CanonicalReport(BaseModel):
    """
    Normalized representation of a weather report from any source.

    Every per-source ingestion adapter must map its raw payload to this
    format. The pipeline.ingest_report() function then validates this model,
    performs idempotency checks, persists to the DB, and publishes to the
    Redis stream.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    source_platform: Literal[
        "twitter", "citizen_app", "news", "youtube", "imd_official"
    ]
    source_handle: str | None = None
    source_native_id: str | None = None

    raw_text: str | None = None

    reported_at: datetime

    lat: float | None = None
    lon: float | None = None
    raw_location_text: str | None = None
    city: str | None = None
    state: str | None = None
    region: str | None = None

    # media_files: raw file payloads from the adapter, processed before DB insert
    media_files: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "List of {'file_bytes': bytes, 'filename': str, 'content_type': str}. "
            "Processed by process_media() before persistence."
        ),
    )

    citizen_device_id: str | None = None

    event_category: str | None = None
    category_confidence: float | None = None


class MediaAttachment(BaseModel):
    """Processed media attachment ready for insertion into media_items."""

    media_type: Literal["image", "video"]
    storage_url: str
    perceptual_hash: str | None = None
    keyframe_hashes: list[dict[str, Any]] | None = None


class IngestionResult(BaseModel):
    """Result of a single report ingestion attempt."""

    status: Literal["created", "duplicate_skipped", "dead_letter"]
    report_id: str | None = None       # Set when status == "created"
    dead_letter_id: str | None = None  # Set when status == "dead_letter"
    reason: str | None = None          # Explanation for non-created statuses

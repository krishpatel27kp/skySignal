"""
Citizen app ingestion adapter.

Receives a validated multipart/form-data submission from the citizen
`POST /v1/reports` endpoint and produces a CanonicalReport.

This is a synchronous (pure-function) adapter — there is no network call.
All I/O happens before or after this function runs.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.constants import EVENT_CATEGORIES
from app.core.errors import AppError
from app.schemas.canonical import CanonicalReport


def normalize_citizen_report(
    *,
    event_category: str,
    description: str | None,
    lat: float | None,
    lon: float | None,
    location_method: str,
    reported_at: datetime | None,
    media_files: list[dict] | None,
    device_id: str,
) -> CanonicalReport:
    """
    Map a citizen multipart submission to a CanonicalReport.

    Parameters
    ----------
    event_category : str
        One of the 7 fixed categories from constants.EVENT_CATEGORIES.
    description : str | None
        Free-text description submitted by the citizen.
    lat, lon : float | None
        GPS coordinates; required when location_method in {'gps','manual'}.
    location_method : str
        One of 'gps', 'manual', 'denied'.
    reported_at : datetime | None
        Client-provided timestamp; defaults to UTC now.
    media_files : list[dict] | None
        List of {'file_bytes': bytes, 'filename': str, 'content_type': str}.
    device_id : str
        Anonymous X-Device-Id from the citizen session.

    Returns
    -------
    CanonicalReport

    Raises
    ------
    AppError (400)
        If neither description nor media_files are provided, the event_category
        is invalid, or lat/lon is required but missing.
    """
    # Validate event_category
    if event_category not in EVENT_CATEGORIES:
        raise AppError(
            status_code=400,
            code="invalid_event_category",
            message=f"event_category must be one of: {EVENT_CATEGORIES}",
            field="event_category",
        )

    # Validate content: require at least description or media
    if not description and not media_files:
        raise AppError(
            status_code=400,
            code="missing_content",
            message="Provide a description and/or at least one media file",
            field="description",
        )

    # Validate location fields
    if location_method in ("gps", "manual"):
        if lat is None or lon is None:
            raise AppError(
                status_code=400,
                code="missing_coordinates",
                message=f"lat and lon are required when location_method is '{location_method}'",
                field="lat",
            )

    ts = reported_at or datetime.now(timezone.utc)

    return CanonicalReport(
        source_platform="citizen_app",
        source_handle=None,
        source_native_id=None,   # no native ID for citizen submissions
        raw_text=description,
        reported_at=ts,
        lat=lat if location_method != "denied" else None,
        lon=lon if location_method != "denied" else None,
        raw_location_text=None,
        media_files=media_files or [],
        citizen_device_id=device_id,
        event_category=event_category,
    )

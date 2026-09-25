"""
IMD official data ingestion adapter.

Polls IMD open-data bulletins and automatic weather station (AWS) readings.
For the prototype, fetch_raw() returns deterministic JSON fixtures so the
pipeline runs without live IMD API credentials.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical import CanonicalReport

# ── Fixture data ─────────────────────────────────────────────────
_FIXTURE_BULLETINS: list[dict[str, Any]] = [
    {
        "bulletin_id": "imd-bulletin-2026-09-16-001",
        "type": "rainfall_warning",
        "headline": "Red Alert: Very Heavy Rainfall Warning for Mumbai and Thane districts",
        "body": (
            "A deep depression over the Arabian Sea is likely to cause extremely "
            "heavy rainfall (> 204.4 mm in 24 hrs) over Mumbai, Thane, and Raigad "
            "districts of Maharashtra during the next 24 hours."
        ),
        "issued_at": "2026-09-16T03:00:00Z",
        "valid_until": "2026-09-17T03:00:00Z",
        "station": {"name": "Mumbai Santacruz", "lat": 19.08, "lon": 72.86},
        "category": "rainfall",
        "severity": "high",
    },
    {
        "bulletin_id": "imd-bulletin-2026-09-16-002",
        "type": "heatwave_warning",
        "headline": "Orange Alert: Heatwave conditions over Vidarbha",
        "body": (
            "Heatwave to severe heatwave conditions are very likely over Vidarbha "
            "(Nagpur, Amravati, Wardha districts) during 16-18 September 2026. "
            "Maximum temperatures likely to remain 4-6°C above normal."
        ),
        "issued_at": "2026-09-16T06:00:00Z",
        "valid_until": "2026-09-18T18:00:00Z",
        "station": {"name": "Nagpur", "lat": 21.15, "lon": 79.09},
        "category": "heatwave",
        "severity": "moderate",
    },
    {
        "bulletin_id": "imd-aws-2026-09-16-003",
        "type": "aws_reading",
        "headline": "AWS Reading: Delhi Palam, Dense Fog",
        "body": (
            "Automatic Weather Station at Delhi Palam reports visibility 25m, "
            "temperature 14°C, relative humidity 98%. Dense fog advisory in effect."
        ),
        "issued_at": "2026-09-16T22:30:00Z",
        "valid_until": "2026-09-17T08:00:00Z",
        "station": {"name": "Delhi Palam", "lat": 28.57, "lon": 77.12},
        "category": "fog",
        "severity": "moderate",
    },
]


def fetch_raw(use_fixtures: bool = True) -> list[dict[str, Any]]:
    """
    Fetch IMD bulletin payloads.

    Parameters
    ----------
    use_fixtures : bool
        If True (default), returns offline fixture data.
        If False, calls the live IMD open-data endpoint.
    """
    if use_fixtures:
        return _FIXTURE_BULLETINS

    # Live path — IMD open-data API stub (endpoint may change with production access)
    import os  # noqa: PLC0415

    import httpx  # noqa: PLC0415

    base = os.environ.get("IMD_API_URL", "https://mausam.imd.gov.in/api")
    try:
        resp = httpx.get(
            f"{base}/bulletins",
            params={"format": "json", "limit": 50},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("bulletins", [])
    except Exception:  # noqa: BLE001
        return []


def normalize_bulletin(bulletin: dict[str, Any]) -> CanonicalReport:
    """Map a single IMD bulletin/AWS reading to a CanonicalReport."""
    station = bulletin.get("station") or {}
    ts = _parse_ts(bulletin.get("issued_at", ""))
    full_text = f"{bulletin.get('headline', '')} {bulletin.get('body', '')}".strip()

    return CanonicalReport(
        source_platform="imd_official",
        source_handle="@IMD_Weather",
        source_native_id=bulletin.get("bulletin_id"),
        raw_text=full_text,
        reported_at=ts,
        lat=station.get("lat"),
        lon=station.get("lon"),
        raw_location_text=station.get("name"),
        event_category=bulletin.get("category"),
        category_confidence=1.0,  # IMD bulletins are authoritative
    )


def ingest_all_fixtures() -> list[CanonicalReport]:
    """Convenience: fetch fixtures and normalize them all."""
    return [normalize_bulletin(b) for b in fetch_raw(use_fixtures=True)]


def _parse_ts(ts: str) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(ts).astimezone(timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)

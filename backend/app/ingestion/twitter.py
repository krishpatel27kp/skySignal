"""
Twitter / X ingestion adapter.

In production this polls the Twitter v2 API for weather hashtags.
For the prototype, fetch_raw() returns deterministic fixture tweets so
the full pipeline runs offline without API credentials.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical import CanonicalReport

# ── Fixture data ─────────────────────────────────────────────────
# Deterministic mock tweets that exercise the full pipeline without
# requiring Twitter API keys.  Add or extend for richer test coverage.
_FIXTURE_TWEETS: list[dict[str, Any]] = [
    {
        "id": "tw-fixture-001",
        "text": (
            "Extremely heavy rainfall lashing Mumbai since morning. "
            "Water logging on Western Express Highway. #MumbaiRain #Flooding"
        ),
        "author_id": "imd_radar",
        "created_at": "2026-09-16T05:30:00Z",
        "geo": {"coordinates": {"type": "Point", "coordinates": [72.88, 19.08]}},
    },
    {
        "id": "tw-fixture-002",
        "text": (
            "Dense fog brings Delhi airport to a standstill. "
            "Visibility under 50 metres. Flights delayed. #DelhiFog"
        ),
        "author_id": "weather_india",
        "created_at": "2026-09-15T22:10:00Z",
        "geo": None,
        "place": {"name": "New Delhi, India"},
    },
    {
        "id": "tw-fixture-003",
        "text": (
            "Cyclonic storm approaching Visakhapatnam coast. "
            "Fishermen advised not to venture into sea. #CycloneAlert #Andhra"
        ),
        "author_id": "imd_official",
        "created_at": "2026-09-17T01:00:00Z",
        "geo": {"coordinates": {"type": "Point", "coordinates": [83.30, 17.69]}},
    },
]


def fetch_raw(use_fixtures: bool = True) -> list[dict[str, Any]]:
    """
    Fetch raw tweet payloads.

    Parameters
    ----------
    use_fixtures : bool
        If True (default) returns offline fixture data.
        If False, attempts a live Twitter v2 API call (requires env vars).

    Returns
    -------
    list[dict]
        Raw tweet dicts from the API or fixtures.
    """
    if use_fixtures:
        return _FIXTURE_TWEETS

    # Live path — intentionally left as a stub; requires TWITTER_BEARER_TOKEN env var.
    import os  # noqa: PLC0415

    bearer = os.environ.get("TWITTER_BEARER_TOKEN")
    if not bearer:
        raise RuntimeError("TWITTER_BEARER_TOKEN not set; cannot fetch live tweets")

    import httpx  # noqa: PLC0415

    resp = httpx.get(
        "https://api.twitter.com/2/tweets/search/recent",
        headers={"Authorization": f"Bearer {bearer}"},
        params={
            "query": "#rainfall OR #flooding OR #heatwave OR #fog OR #thunderstorm lang:en place_country:IN",
            "max_results": 100,
            "tweet.fields": "created_at,geo,author_id",
            "expansions": "geo.place_id",
        },
        timeout=15.0,
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def normalize_tweet(tweet: dict[str, Any]) -> CanonicalReport:
    """Map a single raw tweet dict to a CanonicalReport."""
    geo = tweet.get("geo") or {}
    coords = geo.get("coordinates", {}).get("coordinates")
    lat = coords[1] if coords else None
    lon = coords[0] if coords else None

    # Extract text location hint from place if no GPS
    place = tweet.get("place") or {}
    raw_location = place.get("name") if not lat else None

    ts_str = tweet.get("created_at", "")
    ts = _parse_ts(ts_str)

    return CanonicalReport(
        source_platform="twitter",
        source_handle=f"@{tweet.get('author_id', '')}",
        source_native_id=str(tweet.get("id", "")),
        raw_text=tweet.get("text"),
        reported_at=ts,
        lat=lat,
        lon=lon,
        raw_location_text=raw_location,
    )


def ingest_all_fixtures() -> list[CanonicalReport]:
    """Convenience: fetch fixtures and normalize them all."""
    return [normalize_tweet(t) for t in fetch_raw(use_fixtures=True)]


def _parse_ts(ts: str) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts).astimezone(timezone.utc)

"""
YouTube video ingestion adapter.

Polls YouTube for weather-related videos and extracts metadata.
For the prototype, fetch_raw() returns deterministic fixture entries so
the pipeline runs offline without a YouTube Data API key.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical import CanonicalReport

# ── Fixture data ─────────────────────────────────────────────────
_FIXTURE_VIDEOS: list[dict[str, Any]] = [
    {
        "video_id": "yt-fixture-001",
        "title": "Heavy flooding in Surat streets — live footage Sept 2026",
        "description": (
            "Live footage showing vehicles submerged in flood water near Ring Road, "
            "Surat. Water level has risen by over 2 feet since morning. #SuratFloods"
        ),
        "channel": "IndiaFloodsTV",
        "published_at": "2026-09-16T10:30:00Z",
        "location": {"lat": 21.17, "lon": 72.83},
        "thumbnail_url": "https://i.ytimg.com/vi/yt-fixture-001/hqdefault.jpg",
        # Simulated keyframe hashes for a 10s video at 1fps
        "keyframe_hashes": [
            {"timestamp_sec": 0.0, "hash": "aabbccddeeff0011"},
            {"timestamp_sec": 1.0, "hash": "aabbccddeeff0022"},
        ],
    },
    {
        "video_id": "yt-fixture-002",
        "title": "Mumbai cyclone preparedness — official IMD advisory broadcast",
        "description": (
            "IMD official press conference on cyclone preparedness measures for "
            "Mumbai and coastal Maharashtra. Storm surge warning issued for "
            "12 coastal districts."
        ),
        "channel": "IMDOfficial",
        "published_at": "2026-09-17T04:00:00Z",
        "location": None,
        "raw_location": "Mumbai, Maharashtra",
        "thumbnail_url": "https://i.ytimg.com/vi/yt-fixture-002/hqdefault.jpg",
        "keyframe_hashes": [
            {"timestamp_sec": 0.0, "hash": "00112233445566aa"},
        ],
    },
]

# ── Category keywords ────────────────────────────────────────────
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "flooding": ["flood", "flooding", "submerged", "waterlogged"],
    "rainfall": ["rain", "rainfall", "downpour"],
    "thunderstorm": ["thunder", "storm", "lightning"],
    "heatwave": ["heatwave", "hot", "celsius"],
    "fog": ["fog", "smog", "visibility"],
    "strong_wind": ["wind", "cyclone", "gale"],
}


def fetch_raw(use_fixtures: bool = True) -> list[dict[str, Any]]:
    """
    Fetch YouTube video metadata.

    Parameters
    ----------
    use_fixtures : bool
        If True (default), returns offline fixture data.
        If False, calls the YouTube Data API v3 (requires YOUTUBE_API_KEY env var).
    """
    if use_fixtures:
        return _FIXTURE_VIDEOS

    import os  # noqa: PLC0415

    import httpx  # noqa: PLC0415

    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY not set; cannot fetch live YouTube data")

    try:
        resp = httpx.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": "India rain flood heatwave fog weather 2026",
                "type": "video",
                "maxResults": 50,
                "order": "date",
                "publishedAfter": "2026-01-01T00:00:00Z",
                "key": api_key,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return [
            {
                "video_id": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "description": item["snippet"]["description"],
                "channel": item["snippet"]["channelTitle"],
                "published_at": item["snippet"]["publishedAt"],
                "location": None,
                "thumbnail_url": item["snippet"]["thumbnails"]["high"]["url"],
                "keyframe_hashes": [],  # extracted later by media processor
            }
            for item in resp.json().get("items", [])
        ]
    except Exception:  # noqa: BLE001
        return []


def _infer_category(text: str) -> str | None:
    ltext = text.lower()
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in ltext for kw in keywords):
            return cat
    return None


def normalize_video(video: dict[str, Any]) -> CanonicalReport:
    """Map a single YouTube video metadata dict to a CanonicalReport."""
    loc = video.get("location") or {}
    lat = loc.get("lat") if isinstance(loc, dict) else None
    lon = loc.get("lon") if isinstance(loc, dict) else None
    raw_loc = video.get("raw_location")
    full_text = f"{video.get('title', '')} {video.get('description', '')}".strip()
    ts = _parse_ts(video.get("published_at", ""))

    # Keyframe hashes from fixture are passed as pre-computed media_files
    keyframe_hashes = video.get("keyframe_hashes", [])
    media_files = []
    if keyframe_hashes:
        # Mark as a processed video reference — no real bytes in fixture path
        media_files = [
            {
                "file_bytes": b"",  # stub; real bytes come from download in production
                "filename": f"{video.get('video_id', 'video')}.mp4",
                "content_type": "video/mp4",
                "_precomputed_keyframe_hashes": keyframe_hashes,
            }
        ]

    return CanonicalReport(
        source_platform="youtube",
        source_handle=video.get("channel"),
        source_native_id=video.get("video_id"),
        raw_text=full_text,
        reported_at=ts,
        lat=lat,
        lon=lon,
        raw_location_text=raw_loc,
        media_files=media_files,
        event_category=_infer_category(full_text),
    )


def ingest_all_fixtures() -> list[CanonicalReport]:
    """Convenience: fetch fixtures and normalize them all."""
    return [normalize_video(v) for v in fetch_raw(use_fixtures=True)]


def _parse_ts(ts: str) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(ts).astimezone(timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)

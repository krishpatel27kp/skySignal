"""
News RSS ingestion adapter.

Polls RSS/Atom feeds from Indian news sources (TOI, The Hindu, NDTV).
For the prototype, fetch_raw() returns deterministic XML fixture entries
so the pipeline runs offline without live network access.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from app.schemas.canonical import CanonicalReport

# ── Fixture data ─────────────────────────────────────────────────
_FIXTURE_RSS_ENTRIES: list[dict[str, Any]] = [
    {
        "guid": "toi-weather-2026-09-16-001",
        "title": "Heavy rainfall triggers flash floods in Surat; NDRF deployed",
        "description": (
            "Incessant heavy rainfall over the past 24 hours has caused severe "
            "urban flooding across low-lying areas of Surat, Gujarat. The National "
            "Disaster Response Force has deployed three teams."
        ),
        "pubDate": "2026-09-16T08:00:00Z",
        "source": "Times of India",
        "link": "https://timesofindia.indiatimes.com/fixture-001",
        "location_hint": "Surat, Gujarat",
    },
    {
        "guid": "hindu-weather-2026-09-16-002",
        "title": "IMD issues red alert for Chennai as cyclone approaches Bay of Bengal",
        "description": (
            "The India Meteorological Department has issued a red alert for Chennai "
            "and surrounding districts warning of extremely heavy rainfall and "
            "strong coastal winds over the next 48 hours."
        ),
        "pubDate": "2026-09-16T12:30:00Z",
        "source": "The Hindu",
        "link": "https://thehindu.com/fixture-002",
        "location_hint": "Chennai, Tamil Nadu",
    },
    {
        "guid": "ndtv-weather-2026-09-17-003",
        "title": "Heatwave conditions persist across Vidarbha; Nagpur records 46°C",
        "description": (
            "Vidarbha region of Maharashtra continues to reel under severe heatwave "
            "conditions. Nagpur recorded a maximum temperature of 46 degrees Celsius "
            "on Wednesday, the highest in the country."
        ),
        "pubDate": "2026-09-17T06:00:00Z",
        "source": "NDTV",
        "link": "https://ndtv.com/fixture-003",
        "location_hint": "Nagpur, Maharashtra",
    },
]

# ── Category keyword mapping ─────────────────────────────────────
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "rainfall": ["rain", "rainfall", "downpour", "precipitation", "monsoon", "drizzle"],
    "flooding": ["flood", "flooding", "inundation", "waterlogged", "submerged"],
    "heatwave": ["heatwave", "heat wave", "temperature", "celsius", "hot"],
    "thunderstorm": ["thunderstorm", "thunder", "lightning", "storm"],
    "fog": ["fog", "foggy", "visibility", "smog"],
    "dust_storm": ["dust storm", "dust", "sandstorm"],
    "strong_wind": ["wind", "gale", "cyclone", "squall", "gust"],
}


def fetch_raw(use_fixtures: bool = True) -> list[dict[str, Any]]:
    """
    Fetch RSS entries.

    Parameters
    ----------
    use_fixtures : bool
        If True, returns offline fixture entries (default).
        If False, fetches live RSS feeds (requires network).
    """
    if use_fixtures:
        return _FIXTURE_RSS_ENTRIES

    # Live path — fetch a curated list of Indian weather RSS feeds
    import httpx  # noqa: PLC0415

    feeds = [
        "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",  # India news
        "https://www.thehindu.com/sci-tech/science/feeder/default.rss",
    ]
    entries: list[dict[str, Any]] = []
    for url in feeds:
        try:
            resp = httpx.get(url, timeout=10.0)
            resp.raise_for_status()
            entries.extend(_parse_rss_xml(resp.text))
        except Exception:  # noqa: BLE001
            pass
    return entries


def _parse_rss_xml(xml: str) -> list[dict[str, Any]]:
    """Minimal RSS XML parser — extracts guid, title, description, pubDate."""
    entries = []
    items = re.findall(r"<item>(.*?)</item>", xml, re.DOTALL)
    for item in items:
        def _tag(tag: str) -> str:
            m = re.search(rf"<{tag}[^>]*>\s*(.*?)\s*</{tag}>", item, re.DOTALL)
            return m.group(1).strip() if m else ""

        entries.append(
            {
                "guid": _tag("guid") or _tag("link"),
                "title": _tag("title"),
                "description": re.sub(r"<[^>]+>", "", _tag("description")),
                "pubDate": _tag("pubDate"),
                "source": "rss",
                "link": _tag("link"),
                "location_hint": None,
            }
        )
    return entries


def _infer_category(text: str) -> str | None:
    """Infer event_category from keyword matching."""
    ltext = text.lower()
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in ltext for kw in keywords):
            return cat
    return None


def normalize_entry(entry: dict[str, Any]) -> CanonicalReport:
    """Map a single RSS entry dict to a CanonicalReport."""
    full_text = f"{entry.get('title', '')} {entry.get('description', '')}".strip()
    location_hint = entry.get("location_hint")
    ts = _parse_ts(entry.get("pubDate", ""))

    return CanonicalReport(
        source_platform="news",
        source_handle=entry.get("source"),
        source_native_id=entry.get("guid"),
        raw_text=full_text,
        reported_at=ts,
        raw_location_text=location_hint,
        event_category=_infer_category(full_text),
    )


def ingest_all_fixtures() -> list[CanonicalReport]:
    """Convenience: fetch fixtures and normalize them all."""
    return [normalize_entry(e) for e in fetch_raw(use_fixtures=True)]


def _parse_ts(ts: str) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(ts).astimezone(timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)

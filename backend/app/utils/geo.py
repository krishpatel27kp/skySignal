"""
Nominatim geocoding and reverse geocoding client.

Uses a built-in offline lookup table for major Indian cities/states
so the pipeline runs deterministically without requiring a live
Nominatim/OpenStreetMap API connection.

The HTTP fallback (httpx-based) is called only when a lookup misses
the local table AND the environment variable NOMINATIM_URL is set.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("skygrid.geo")

# ── Indian city / state offline lookup table ────────────────────
# Format: (lat, lon) → {"city": ..., "state": ...}
# Keyed by a rounded (2-decimal) lat/lon tuple for fast reverse lookup.
_MAJOR_INDIAN_CITIES: dict[str, dict[str, str]] = {
    # Maharashtra
    "Mumbai": {"city": "Mumbai", "state": "Maharashtra"},
    "Pune": {"city": "Pune", "state": "Maharashtra"},
    "Nagpur": {"city": "Nagpur", "state": "Maharashtra"},
    "Nashik": {"city": "Nashik", "state": "Maharashtra"},
    # Gujarat
    "Surat": {"city": "Surat", "state": "Gujarat"},
    "Ahmedabad": {"city": "Ahmedabad", "state": "Gujarat"},
    "Vadodara": {"city": "Vadodara", "state": "Gujarat"},
    # Delhi
    "Delhi": {"city": "Delhi", "state": "Delhi"},
    "New Delhi": {"city": "New Delhi", "state": "Delhi"},
    # Rajasthan
    "Jaipur": {"city": "Jaipur", "state": "Rajasthan"},
    "Jodhpur": {"city": "Jodhpur", "state": "Rajasthan"},
    # West Bengal
    "Kolkata": {"city": "Kolkata", "state": "West Bengal"},
    # Tamil Nadu
    "Chennai": {"city": "Chennai", "state": "Tamil Nadu"},
    "Coimbatore": {"city": "Coimbatore", "state": "Tamil Nadu"},
    # Karnataka
    "Bengaluru": {"city": "Bengaluru", "state": "Karnataka"},
    "Bangalore": {"city": "Bengaluru", "state": "Karnataka"},
    "Mysuru": {"city": "Mysuru", "state": "Karnataka"},
    # Kerala
    "Kochi": {"city": "Kochi", "state": "Kerala"},
    "Thiruvananthapuram": {"city": "Thiruvananthapuram", "state": "Kerala"},
    # Andhra Pradesh
    "Visakhapatnam": {"city": "Visakhapatnam", "state": "Andhra Pradesh"},
    "Vijayawada": {"city": "Vijayawada", "state": "Andhra Pradesh"},
    # Telangana
    "Hyderabad": {"city": "Hyderabad", "state": "Telangana"},
    # Madhya Pradesh
    "Bhopal": {"city": "Bhopal", "state": "Madhya Pradesh"},
    "Indore": {"city": "Indore", "state": "Madhya Pradesh"},
    # Uttar Pradesh
    "Lucknow": {"city": "Lucknow", "state": "Uttar Pradesh"},
    "Agra": {"city": "Agra", "state": "Uttar Pradesh"},
    "Varanasi": {"city": "Varanasi", "state": "Uttar Pradesh"},
    "Kanpur": {"city": "Kanpur", "state": "Uttar Pradesh"},
    # Bihar
    "Patna": {"city": "Patna", "state": "Bihar"},
    # Assam
    "Guwahati": {"city": "Guwahati", "state": "Assam"},
    # Odisha
    "Bhubaneswar": {"city": "Bhubaneswar", "state": "Odisha"},
    # Jharkhand
    "Ranchi": {"city": "Ranchi", "state": "Jharkhand"},
    # Punjab
    "Chandigarh": {"city": "Chandigarh", "state": "Chandigarh"},
    "Amritsar": {"city": "Amritsar", "state": "Punjab"},
    # Chhattisgarh
    "Raipur": {"city": "Raipur", "state": "Chhattisgarh"},
    # Goa
    "Panaji": {"city": "Panaji", "state": "Goa"},
}

# Coordinate-keyed reverse lookup: (lat_2dp, lon_2dp) → city name
_COORD_REVERSE: dict[tuple[float, float], str] = {
    (19.08, 72.88): "Mumbai",
    (18.52, 73.86): "Pune",
    (21.15, 79.09): "Nagpur",
    (21.17, 72.83): "Surat",
    (23.03, 72.59): "Ahmedabad",
    (28.61, 77.21): "Delhi",
    (22.57, 88.36): "Kolkata",
    (13.08, 80.27): "Chennai",
    (12.97, 77.59): "Bengaluru",
    (17.38, 78.49): "Hyderabad",
    (26.91, 75.79): "Jaipur",
}


@dataclass
class GeoResult:
    city: str | None
    state: str | None


class NominatimClient:
    """
    Abstracted geocoding client for Indian locations.

    Priority order for all lookups:
    1. Offline coordinate/city lookup table (no network call, deterministic).
    2. HTTP call to configured NOMINATIM_URL (optional, set via env).
    3. Return None values gracefully.
    """

    def __init__(self, nominatim_url: str | None = None) -> None:
        self._url = nominatim_url

    def reverse_geocode(self, lat: float, lon: float) -> GeoResult:
        """
        Map (lat, lon) to city and state.

        Uses the built-in coordinate lookup table rounded to 2 decimal places.
        Falls back to HTTP Nominatim if the coordinate is not in the table.
        """
        key = (round(lat, 2), round(lon, 2))
        city_name = _COORD_REVERSE.get(key)
        if city_name:
            info = _MAJOR_INDIAN_CITIES.get(city_name, {})
            return GeoResult(
                city=info.get("city"),
                state=info.get("state"),
            )

        # Attempt HTTP fallback (if configured)
        return self._http_reverse(lat, lon)

    def forward_geocode(self, query: str) -> GeoResult | None:
        """
        Map a free-text location query to city and state.

        Checks the offline city name table first (case-insensitive substring match),
        then falls back to HTTP Nominatim.
        """
        q = query.strip().lower()
        for city_name, info in _MAJOR_INDIAN_CITIES.items():
            if city_name.lower() in q or q in city_name.lower():
                return GeoResult(city=info["city"], state=info["state"])

        return self._http_forward(query)

    # ── Private HTTP helpers ─────────────────────────────────────

    def _http_reverse(self, lat: float, lon: float) -> GeoResult:
        """HTTP reverse geocode; returns empty GeoResult on failure/no URL."""
        if not self._url:
            return GeoResult(city=None, state=None)
        try:
            import httpx  # noqa: PLC0415

            resp = httpx.get(
                f"{self._url}/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                timeout=5.0,
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            addr = data.get("address", {})
            return GeoResult(
                city=addr.get("city") or addr.get("town") or addr.get("village"),
                state=addr.get("state"),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Nominatim reverse geocode failed: %s", exc)
            return GeoResult(city=None, state=None)

    def _http_forward(self, query: str) -> GeoResult | None:
        """HTTP forward geocode; returns None on failure/no URL."""
        if not self._url:
            return None
        try:
            import httpx  # noqa: PLC0415

            resp = httpx.get(
                f"{self._url}/search",
                params={"q": f"{query}, India", "format": "json", "limit": 1},
                timeout=5.0,
            )
            resp.raise_for_status()
            results = resp.json()
            if not results:
                return None
            first = results[0]
            addr = first.get("address", {})
            return GeoResult(
                city=addr.get("city") or addr.get("town"),
                state=addr.get("state"),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Nominatim forward geocode failed: %s", exc)
            return None


# Module-level singleton (mockable in tests via dependency injection)
_client: NominatimClient | None = None


def get_nominatim_client() -> NominatimClient:
    """Return the module-level NominatimClient singleton."""
    global _client  # noqa: PLW0603
    if _client is None:
        import os

        _client = NominatimClient(nominatim_url=os.environ.get("NOMINATIM_URL"))
    return _client


def set_nominatim_client(client: NominatimClient) -> None:
    """Override the singleton — used in tests to inject a mock."""
    global _client  # noqa: PLW0603
    _client = client

"""
Domain constants for the SkyGrid platform.

These are the single source of truth for enum values used across
models, schemas, API validation, and pipeline workers.
"""

from __future__ import annotations

# ── Event Categories ─────────────────────────────────────────────
# 7 fixed categories — stored as lowercase snake_case in the DB.
# Ingestion accepts case-insensitive input and normalises here.
EVENT_CATEGORIES: list[str] = [
    "rainfall",
    "thunderstorm",
    "flooding",
    "heatwave",
    "fog",
    "dust_storm",
    "strong_wind",
]

# ── Severity Bands (aligned with frontend color badges) ──────────
# Low=#3caa92  Moderate=#2d8dab  High=#e8871e  Critical=#d65555
SEVERITY_BANDS: list[str] = ["low", "moderate", "high", "critical"]

# ── Event Lifecycle States ───────────────────────────────────────
LIFECYCLE_STATES: list[str] = [
    "detected",
    "emerging",
    "confirmed",
    "active",
    "declining",
    "resolved",
]

# ── Report Statuses ──────────────────────────────────────────────
REPORT_STATUSES: list[str] = [
    "pending",
    "verified",
    "rejected",
    "under_review",
]

# ── Source Platforms ──────────────────────────────────────────────
SOURCE_PLATFORMS: list[str] = [
    "twitter",
    "citizen_app",
    "news",
    "youtube",
    "imd_official",
]

# ── Admin Roles ──────────────────────────────────────────────────
ADMIN_ROLES: list[str] = ["analyst", "senior_admin"]

# ── Audit Actions ────────────────────────────────────────────────
AUDIT_ACTIONS: list[str] = [
    "verify_report",
    "reject_report",
    "verify_event",
    "reject_event",
    "merge_event",
    "escalate_event",
]

# ── Geocode Methods ──────────────────────────────────────────────
GEOCODE_METHODS: list[str] = ["gps", "ner_geocoded", "manual"]

# ── Media Types ──────────────────────────────────────────────────
MEDIA_TYPES: list[str] = ["image", "video"]

# ── Indian State → Region Mapping ────────────────────────────────
# Matches the frontend's regional analytics and the seed data.
# Regions: North, South, East, West, Central, North-East
STATE_TO_REGION: dict[str, str] = {
    # West
    "Maharashtra": "West",
    "Gujarat": "West",
    "Goa": "West",
    "Rajasthan": "West",
    "Dadra and Nagar Haveli and Daman and Diu": "West",
    "Daman and Diu": "West",
    "Dadra and Nagar Haveli": "West",
    # North
    "Delhi": "North",
    "Punjab": "North",
    "Haryana": "North",
    "Himachal Pradesh": "North",
    "Jammu and Kashmir": "North",
    "Jammu & Kashmir": "North",
    "Ladakh": "North",
    "Uttarakhand": "North",
    "Uttar Pradesh": "North",
    "Chandigarh": "North",
    # South
    "Tamil Nadu": "South",
    "Kerala": "South",
    "Karnataka": "South",
    "Andhra Pradesh": "South",
    "Telangana": "South",
    "Puducherry": "South",
    "Lakshadweep": "South",
    # East
    "West Bengal": "East",
    "Bihar": "East",
    "Odisha": "East",
    "Jharkhand": "East",
    "Andaman and Nicobar Islands": "East",
    "Andaman & Nicobar Islands": "East",
    # Central
    "Madhya Pradesh": "Central",
    "Chhattisgarh": "Central",
    # North-East
    "Assam": "North-East",
    "Meghalaya": "North-East",
    "Arunachal Pradesh": "North-East",
    "Manipur": "North-East",
    "Mizoram": "North-East",
    "Nagaland": "North-East",
    "Tripura": "North-East",
    "Sikkim": "North-East",
}


def get_region(state: str | None) -> str | None:
    """
    Resolve an Indian state name to its geographic region.

    Performs a case-insensitive lookup with basic whitespace normalisation.
    Returns ``None`` if the state is unknown.
    """
    if not state:
        return None
    normalised = " ".join(state.strip().split())
    return STATE_TO_REGION.get(normalised) or STATE_TO_REGION.get(
        normalised.title()
    )


# Alias for the seed script / model helpers
get_indian_region = get_region


def normalise_category(raw: str) -> str | None:
    """
    Normalise a user-supplied event category to lowercase snake_case.

    Accepts case-insensitive input (e.g. "Dust Storm", "FLOODING").
    Returns ``None`` if the category is not recognised.
    """
    candidate = raw.strip().lower().replace(" ", "_")
    return candidate if candidate in EVENT_CATEGORIES else None

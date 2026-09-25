"""
SkyGrid — Development Seed Data

Populates the database with frontend-aligned demo data:
  • 2 admin accounts
  • 5 ingestion sources
  • 5 weather events (matching frontend dashboard cards)
  • 15 reports (3 per event, from different sources)
  • 5 sensor readings (one per event)
  • 5 media items
  • Lifecycle history for each event

Usage:
    # From the backend/ directory (with DB running):
    python -m scripts.seed_dev_data

    # Or from Docker:
    docker compose exec api python -m scripts.seed_dev_data
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.constants import get_indian_region
from app.core.security import hash_password
from app.db.base import Base

# Import all models
from app.models import (  # noqa: F401
    AdminUser,
    AuditLog,
    CitizenSession,
    DeadLetterReport,
    DuplicateCluster,
    Event,
    EventLifecycleLog,
    EventReportMap,
    MediaItem,
    Report,
    SensorReading,
    Source,
)

NOW = datetime.now(timezone.utc)


def _wkt(lon: float, lat: float) -> str:
    """Create a WKT POINT string for PostGIS geography columns."""
    return f"SRID=4326;POINT({lon} {lat})"


# ═══════════════════════════════════════════════════════════════════
# SEED DATA DEFINITIONS
# ═══════════════════════════════════════════════════════════════════

# ── Admin Users ──────────────────────────────────────────────────
ADMIN_USERS = [
    {
        "id": uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        "email": "analyst@imd.gov.in",
        "password": "Analyst@123",
        "role": "analyst",
    },
    {
        "id": uuid.UUID("a0000000-0000-0000-0000-000000000002"),
        "email": "admin@imd.gov.in",
        "password": "Admin@123",
        "role": "senior_admin",
    },
    {
        "id": uuid.UUID("a0000000-0000-0000-0000-000000000003"),
        "email": "admin@skysignal.gov.in",
        "password": "securepassword123",
        "role": "senior_admin",
    },
    {
        "id": uuid.UUID("a0000000-0000-0000-0000-000000000004"),
        "email": "admin@varshanet.gov.in",
        "password": "securepassword123",
        "role": "senior_admin",
    },
]

# ── Sources ──────────────────────────────────────────────────────
SOURCES = [
    {
        "id": uuid.UUID("b0000000-0000-0000-0000-000000000001"),
        "platform": "citizen_app",
        "handle": None,
        "trust_score": 0.75,
    },
    {
        "id": uuid.UUID("b0000000-0000-0000-0000-000000000002"),
        "platform": "twitter",
        "handle": "@imd_radar",
        "trust_score": 0.92,
    },
    {
        "id": uuid.UUID("b0000000-0000-0000-0000-000000000003"),
        "platform": "twitter",
        "handle": "@mumbairain",
        "trust_score": 0.88,
    },
    {
        "id": uuid.UUID("b0000000-0000-0000-0000-000000000004"),
        "platform": "news",
        "handle": "TOI Weather",
        "trust_score": 0.90,
    },
    {
        "id": uuid.UUID("b0000000-0000-0000-0000-000000000005"),
        "platform": "imd_official",
        "handle": "IMD AWS Network",
        "trust_score": 0.98,
    },
]

# ── Citizen Session (for citizen-submitted reports) ──────────────
CITIZEN_SESSION = {
    "id": uuid.UUID("c0000000-0000-0000-0000-000000000001"),
    "device_id": "demo-device-001",
    "preferred_language": "en",
}

# ── Events (aligned with frontend dashboard cards) ───────────────
EVENTS = [
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000001"),
        "title": "Heavy rainfall in Mumbai",
        "category": "rainfall",
        "lon": 72.8777,
        "lat": 19.0760,
        "city": "Mumbai",
        "state": "Maharashtra",
        "severity": "critical",
        "confidence": 0.94,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "independent_source_count": 12,
        "detected_at": NOW - timedelta(hours=6),
        "lifecycle_history": [
            ("detected", NOW - timedelta(hours=6), "Citizen reports threshold reached"),
            ("emerging", NOW - timedelta(hours=5), "Cross-source corroboration detected"),
            ("confirmed", NOW - timedelta(hours=4), "IMD sensor data corroborates"),
            ("active", NOW - timedelta(hours=3), "Report volume increasing"),
        ],
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000002"),
        "title": "Urban Flooding — Surat",
        "category": "flooding",
        "lon": 72.8311,
        "lat": 21.1702,
        "city": "Surat",
        "state": "Gujarat",
        "severity": "high",
        "confidence": 0.88,
        "lifecycle_status": "active",
        "has_contradiction": True,
        "independent_source_count": 8,
        "detected_at": NOW - timedelta(hours=4),
        "lifecycle_history": [
            ("detected", NOW - timedelta(hours=4), "Multiple citizen flood reports"),
            ("emerging", NOW - timedelta(hours=3), "News coverage confirmed"),
            ("active", NOW - timedelta(hours=2), "Street-level impact verified"),
        ],
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000003"),
        "title": "Severe Fog Advisory — Delhi NCR",
        "category": "fog",
        "lon": 77.2090,
        "lat": 28.6139,
        "city": "New Delhi",
        "state": "Delhi",
        "severity": "moderate",
        "confidence": 0.82,
        "lifecycle_status": "confirmed",
        "has_contradiction": False,
        "independent_source_count": 6,
        "detected_at": NOW - timedelta(hours=10),
        "lifecycle_history": [
            ("detected", NOW - timedelta(hours=10), "Airport visibility reports"),
            ("emerging", NOW - timedelta(hours=8), "Road traffic impact reports"),
            ("confirmed", NOW - timedelta(hours=6), "IMD fog advisory issued"),
        ],
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000004"),
        "title": "Heatwave Alert — Nagpur",
        "category": "heatwave",
        "lon": 79.0882,
        "lat": 21.1458,
        "city": "Nagpur",
        "state": "Maharashtra",
        "severity": "high",
        "confidence": 0.89,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "independent_source_count": 9,
        "detected_at": NOW - timedelta(hours=18),
        "lifecycle_history": [
            ("detected", NOW - timedelta(hours=18), "Temperature anomaly detected"),
            ("emerging", NOW - timedelta(hours=14), "Citizen heat-stress reports"),
            ("confirmed", NOW - timedelta(hours=10), "IMD heatwave warning issued"),
            ("active", NOW - timedelta(hours=6), "Temperatures still rising"),
        ],
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000005"),
        "title": "Thunderstorm Warning — Kolkata",
        "category": "thunderstorm",
        "lon": 88.3639,
        "lat": 22.5726,
        "city": "Kolkata",
        "state": "West Bengal",
        "severity": "moderate",
        "confidence": 0.76,
        "lifecycle_status": "emerging",
        "has_contradiction": False,
        "independent_source_count": 4,
        "detected_at": NOW - timedelta(hours=2),
        "lifecycle_history": [
            ("detected", NOW - timedelta(hours=2), "Lightning detection network alert"),
            ("emerging", NOW - timedelta(hours=1), "Social media reports increasing"),
        ],
    },
]

# ── Reports (3 per event, from different sources) ────────────────
_REPORT_TEXTS = {
    "rainfall": [
        "Very heavy rain since morning. Roads completely waterlogged near station.",
        "Massive downpour affecting daily commute. Multiple areas flooded.",
        "Continuous heavy rainfall reported. Low-lying areas submerged.",
    ],
    "flooding": [
        "Water level rising rapidly on main road. Vehicles stuck in flood water.",
        "Severe urban flooding near commercial district. Shops shutting down.",
        "Streets submerged knee-deep. Emergency services being deployed.",
    ],
    "fog": [
        "Dense fog reducing visibility to under 50 meters on highway.",
        "Airport operations disrupted due to near-zero visibility.",
        "Traffic moving at crawl speed. Multiple chain collisions reported.",
    ],
    "heatwave": [
        "Temperature crossed 45°C. Outdoor work suspended in many areas.",
        "Extreme heat conditions. Multiple cases of heat exhaustion reported.",
        "Dangerously high temperatures. Authorities issuing stay-indoors advisory.",
    ],
    "thunderstorm": [
        "Dark clouds and gusty winds. Lightning spotted across the horizon.",
        "Sudden thunderstorm with strong winds uprooting trees in some areas.",
        "Heavy thunder and lightning since evening. Power outages reported.",
    ],
}


def _build_reports() -> list[dict]:
    """Generate 3 reports per event from different source types."""
    reports = []
    source_rotation = [
        # (source_id, source_native_id_prefix, citizen_session_id)
        (SOURCES[0]["id"], "citizen", CITIZEN_SESSION["id"]),  # citizen_app
        (SOURCES[2]["id"], "tw", None),                        # twitter @mumbairain
        (SOURCES[3]["id"], "news", None),                      # news TOI
    ]

    for event in EVENTS:
        texts = _REPORT_TEXTS.get(event["category"], _REPORT_TEXTS["rainfall"])
        region = get_indian_region(event["state"])

        for i, (src_id, prefix, citizen_id) in enumerate(source_rotation):
            # Use string(event_id) instead of event_id.hex
            report_id = uuid.uuid5(uuid.NAMESPACE_URL, f"skygrid-report-{str(event['id'])}-{i}")    
            reports.append({
                "id": report_id,    
                "source_id": src_id,
                "citizen_session_id": citizen_id,
                "source_native_id": f"{prefix}-{event['id']}-{i}",
                "raw_text": texts[i],
                "clean_text": texts[i].lower(),
                "language": "en",
                "location_wkt": _wkt(event["lon"], event["lat"]),
                "city": event["city"],
                "state": event["state"],
                "region": region,
                "geocode_confidence": 0.95 if i == 0 else 0.80,
                "geocode_method": "gps" if i == 0 else "ner_geocoded",
                "reported_at": event["detected_at"] + timedelta(minutes=5 * i),
                "event_category": event["category"],
                "category_confidence": 0.90 + (i * 0.02),
                "p_misleading": 0.05 + (i * 0.03),
                "status": "verified",
                "event_id": event["id"],  # for linking
            })

    return reports


# ═══════════════════════════════════════════════════════════════════
# SEED EXECUTION
# ═══════════════════════════════════════════════════════════════════


async def seed(session: AsyncSession) -> None:
    """Insert all seed data inside a single transaction."""

    # ── Check if already seeded ──────────────────────────────────
    result = await session.execute(
        text("SELECT COUNT(*) FROM admin_users")
    )
    if result.scalar_one() > 0:
        print("⚠  Database already contains data — skipping seed.")
        return

    print("🌱 Seeding SkyGrid development data...")

    # ── 1. Admin Users ───────────────────────────────────────────
    for u in ADMIN_USERS:
        session.add(AdminUser(
            id=u["id"],
            email=u["email"],
            password_hash=hash_password(u["password"]),
            role=u["role"],
        ))
    print(f"   ✓ {len(ADMIN_USERS)} admin users")

    # ── 2. Sources ───────────────────────────────────────────────
    for s in SOURCES:
        session.add(Source(
            id=s["id"],
            platform=s["platform"],
            handle=s["handle"],
            trust_score=s["trust_score"],
        ))
    print(f"   ✓ {len(SOURCES)} ingestion sources")

    # ── 3. Citizen Session ───────────────────────────────────────
    session.add(CitizenSession(
        id=CITIZEN_SESSION["id"],
        device_id=CITIZEN_SESSION["device_id"],
        preferred_language=CITIZEN_SESSION["preferred_language"],
    ))
    print("   ✓ 1 citizen session")

    # ── 4. Events ────────────────────────────────────────────────
    for ev in EVENTS:
        region = get_indian_region(ev["state"])
        session.add(Event(
            id=ev["id"],
            title=ev["title"],
            category=ev["category"],
            centroid=_wkt(ev["lon"], ev["lat"]),
            city=ev["city"],
            state=ev["state"],
            region=region,
            severity=ev["severity"],
            confidence=ev["confidence"],
            lifecycle_status=ev["lifecycle_status"],
            has_contradiction=ev.get("has_contradiction", False),
            independent_source_count=ev["independent_source_count"],
            detected_at=ev["detected_at"],
            last_updated_at=NOW,
        ))
    print(f"   ✓ {len(EVENTS)} weather events")

    # Flush to satisfy FK constraints before inserting child rows
    await session.flush()

    # ── 5. Lifecycle Logs ────────────────────────────────────────
    log_count = 0
    for ev in EVENTS:
        prev_status = None
        for to_status, ts, reason in ev["lifecycle_history"]:
            session.add(EventLifecycleLog(
                event_id=ev["id"],
                from_status=prev_status,
                to_status=to_status,
                transitioned_at=ts,
                trigger_reason=reason,
            ))
            prev_status = to_status
            log_count += 1
    print(f"   ✓ {log_count} lifecycle log entries")

    # ── 6. Reports + EventReportMap ──────────────────────────────
    reports = _build_reports()
    for r in reports:
        event_id = r.pop("event_id")
        location_wkt = r.pop("location_wkt")

        session.add(Report(
            id=r["id"],
            source_id=r["source_id"],
            citizen_session_id=r["citizen_session_id"],
            source_native_id=r["source_native_id"],
            raw_text=r["raw_text"],
            clean_text=r["clean_text"],
            language=r["language"],
            location=location_wkt,
            city=r["city"],
            state=r["state"],
            region=r["region"],
            geocode_confidence=r["geocode_confidence"],
            geocode_method=r["geocode_method"],
            reported_at=r["reported_at"],
            event_category=r["event_category"],
            category_confidence=r["category_confidence"],
            p_misleading=r["p_misleading"],
            status=r["status"],
        ))

        # Link report to event
        session.add(EventReportMap(
            event_id=event_id,
            report_id=r["id"],
        ))

    print(f"   ✓ {len(reports)} reports (linked to events)")

    # Flush reports before media items
    await session.flush()

    # ── 7. Media Items (one per citizen report) ──────────────────
    media_count = 0
    for r in reports:
        if r["citizen_session_id"] is not None:
            session.add(MediaItem(
                report_id=r["id"],
                media_type="image",
                storage_url=f"skygrid-media/reports/{r['id']}/photo.jpg",
                perceptual_hash=f"phash_{r['id'].hex[:16]}",
            ))
            media_count += 1
    print(f"   ✓ {media_count} media items")

    # ── 8. Sensor Readings (one per event) ───────────────────────
    for ev in EVENTS:
        rainfall = {
            "rainfall": 85.0,
            "flooding": 120.0,
            "fog": None,
            "heatwave": None,
            "thunderstorm": 35.0,
        }.get(ev["category"])

        session.add(SensorReading(
            station_id=f"AWS-{ev['state'][:2].upper()}-{ev['id'].hex[:4]}",
            location=_wkt(ev["lon"] + 0.01, ev["lat"] + 0.01),
            rainfall_mm=rainfall,
            recorded_at=ev["detected_at"] + timedelta(minutes=30),
            corroborates_event_id=ev["id"],
        ))
    print(f"   ✓ {len(EVENTS)} sensor readings")

    await session.commit()
    print("✅ Seed complete!")


async def main() -> None:
    """Entry point — creates engine, runs seed, disposes."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        await seed(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

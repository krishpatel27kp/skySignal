"""
SkySignal 2.0 — High-Fidelity Weather Traffic Simulator & Data Seeder
=====================================================================
Generates realistic multi-source weather telemetry, citizen reports, social
signals, IMD AWS radar observations, and duplicate clusters across Indian cities.

Modes:
  1. Bulk Seeding (--seed):
     Populates the database with 14 canonical weather events, 100+ reports,
     duplicate NLP clusters, official IMD sensor readings, media items,
     and administrative audit logs.

  2. Live Stream Simulation (--stream / --live):
     Continuously or in batches, sends live simulated citizen observations
     and social media reports through the FastAPI ingestion gateway
     (/v1/reports) and Kafka streaming topics. Real-time Celery workers
     and PostGIS Event Fusion will trigger, streaming live SSE telemetry
     to the React Dashboard.

Usage:
  # From host:
  python backend/scripts/simulate_traffic.py --seed
  python backend/scripts/simulate_traffic.py --stream --count 20 --interval 1.5
  python backend/scripts/simulate_traffic.py --seed --stream

  # Inside Docker:
  docker exec skysignal-api python -m scripts.simulate_traffic --seed
  docker exec skysignal-api python -m scripts.simulate_traffic --stream --count 30
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import logging
import os
import random
import socket
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Setup Python Path & Environment
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

# Auto-detect Docker-mapped PostgreSQL port 5433 on host
def _check_port(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except Exception:
        return False

db_url = os.environ.get("DATABASE_URL", "")
if _check_port(5433) and ("localhost:5432" in db_url or "127.0.0.1:5432" in db_url):
    try:
        import asyncpg
        async def _test():
            conn = await asyncpg.connect("postgresql://skygrid:skygrid_secret@127.0.0.1:5432/skygrid", timeout=0.8)
            await conn.close()
        asyncio.run(_test())
    except Exception:
        os.environ["DATABASE_URL"] = db_url.replace("localhost:5432", "localhost:5433").replace("127.0.0.1:5432", "127.0.0.1:5433")
        os.environ["POSTGRES_PORT"] = "5433"

import httpx
from PIL import Image
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.constants import get_indian_region
from app.core.security import hash_password
from app.models.admin import AdminUser, AuditLog
from app.models.event import Event, EventLifecycleLog, EventReportMap, SensorReading
from app.models.report import DeadLetterReport, DuplicateCluster, MediaItem, Report
from app.models.source import CitizenSession, Source

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("traffic_sim")

NOW = datetime.now(timezone.utc)

def _wkt(lon: float, lat: float) -> str:
    return f"SRID=4326;POINT({lon:.6f} {lat:.6f})"

# ═══════════════════════════════════════════════════════════════════
# PRE-CONFIGURED DATA DEFINITIONS
# ═══════════════════════════════════════════════════════════════════

ADMINS_SEED = [
    {
        "id": uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        "email": "analyst@imd.gov.in",
        "password": "Analyst@123",
        "role": "senior_admin",
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
        "email": "analyst_trainee@imd.gov.in",
        "password": "Trainee@123",
        "role": "analyst",
    },
]

SOURCES_SEED = [
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000001"), "platform": "citizen_app", "handle": None, "trust_score": 0.78},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000002"), "platform": "twitter", "handle": "@imd_radar", "trust_score": 0.96},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000003"), "platform": "twitter", "handle": "@mumbairain", "trust_score": 0.89},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000004"), "platform": "twitter", "handle": "@delhiweather", "trust_score": 0.85},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000005"), "platform": "twitter", "handle": "@blrcityrains", "trust_score": 0.87},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000006"), "platform": "news", "handle": "TOI National", "trust_score": 0.92},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000007"), "platform": "news", "handle": "NDTV Weather Desk", "trust_score": 0.91},
    {"id": uuid.UUID("b0000000-0000-0000-0000-000000000008"), "platform": "imd_official", "handle": "IMD Mesonet AWS", "trust_score": 0.99},
]

INDIAN_HOTSPOTS = [
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000001"),
        "title": "Severe Monsoon Inundation & Coastal Surge",
        "category": "flooding",
        "city": "Mumbai",
        "state": "Maharashtra",
        "region": "west",
        "lon": 72.8777,
        "lat": 19.0760,
        "severity": "critical",
        "confidence": 0.96,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "sensor_mm": 138.4,
        "snippets": [
            "Hindmata cinema and Dadar TT circle completely inundated under 3 feet water.",
            "King's Circle railway bridge flooded. Local trains halted on harbor line.",
            "Western Express Highway moving at snail pace due to waterlogging near Bandra.",
            "Water entered residential ground floors near Kurla station. NDRF on standby.",
            "High tide alarm combined with continuous downpour. Pumping stations active.",
            "Vehicles stalled near Milan Subway. Water level crossing 2.5 feet.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000002"),
        "title": "Flash Flood & Stormwater Drain Inundation",
        "category": "rainfall",
        "city": "Bengaluru",
        "state": "Karnataka",
        "region": "south",
        "lon": 77.5946,
        "lat": 12.9716,
        "severity": "high",
        "confidence": 0.91,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "sensor_mm": 94.2,
        "snippets": [
            "Silk Board junction completely waterlogged. Traffic jam extending 4km towards HSR.",
            "Outer Ring Road tech parks flooded. Several vehicles abandoned near Bellandur eco-space.",
            "Heavy cloudburst reported in Koramangala. Tree fall blocking 80 feet road.",
            "Stormwater drain overflow in Rainbow Drive layout. Tractors deployed for evacuation.",
            "Severe localized rainfall of 85mm within 90 minutes recorded across South Bengaluru.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000003"),
        "title": "Dense Fog Advisory & Flight Operations Disruption",
        "category": "fog",
        "city": "New Delhi",
        "state": "Delhi",
        "region": "north",
        "lon": 77.2090,
        "lat": 28.6139,
        "severity": "moderate",
        "confidence": 0.88,
        "lifecycle_status": "confirmed",
        "has_contradiction": False,
        "sensor_mm": 0.0,
        "snippets": [
            "Dense fog blanket reducing runway visibility to under 40 meters at IGI Airport.",
            "Over 25 morning departures delayed. CAT III instrument landing active.",
            "Yamuna Expressway multiple pileups reported near Greater Noida due to zero visibility.",
            "Extreme winter chill combined with dense smog across Connaught Place and Ring Road.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000004"),
        "title": "Severe Nor'wester Squall & Intense Lightning",
        "category": "thunderstorm",
        "city": "Kolkata",
        "state": "West Bengal",
        "region": "east",
        "lon": 88.3639,
        "lat": 22.5726,
        "severity": "high",
        "confidence": 0.89,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "sensor_mm": 52.8,
        "snippets": [
            "Kalbaishakhi squall struck city with wind gusts clocking 78 km/h.",
            "Lightning strikes reported near Salt Lake and New Town. Power outages across Sector V.",
            "Uprooted banyan tree blocking Central Avenue traffic heading towards Esplanade.",
            "Ferry services across Hooghly river suspended temporarily due to heavy turbulence.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000005"),
        "title": "Extreme Heatwave & Sunstroke Emergency",
        "category": "heatwave",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "region": "west",
        "lon": 72.5714,
        "lat": 23.0225,
        "severity": "critical",
        "confidence": 0.94,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "sensor_mm": 0.0,
        "snippets": [
            "Mercury hits 46.4°C in Ahmedabad. Red alert issued by AMC health department.",
            "Tar melting on SG Highway near Prahladnagar. Citizens advised to remain indoors.",
            "Civil hospital reports influx of 40+ severe dehydration and heat exhaustion cases.",
            "Construction and outdoor work banned between 12 PM and 4 PM across the district.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000006"),
        "title": "Coastal Squall & Strong Gale Inundation",
        "category": "strong_wind",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "region": "south",
        "lon": 80.2707,
        "lat": 13.0827,
        "severity": "high",
        "confidence": 0.87,
        "lifecycle_status": "confirmed",
        "has_contradiction": False,
        "sensor_mm": 68.0,
        "snippets": [
            "Gale winds touching 65 km/h along Marina and Besant Nagar beaches.",
            "Waterlogging reported in T Nagar and Velachery low-lying neighborhoods.",
            "Subway underpasses closed as precautionary measure. Coastal fishermen advised not to venture.",
            "Several metal signboards blown off on Mount Road near Thousand Lights.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000007"),
        "title": "Severe Hailstorm & Localized Cloudburst",
        "category": "thunderstorm",
        "city": "Hyderabad",
        "state": "Telangana",
        "region": "south",
        "lon": 78.4867,
        "lat": 17.3850,
        "severity": "moderate",
        "confidence": 0.82,
        "lifecycle_status": "emerging",
        "has_contradiction": True,
        "sensor_mm": 38.5,
        "snippets": [
            "Sudden hailstorm pelting Gachibowli and HITEC City with golf ball sized hail stones.",
            "Car windshields damaged in financial district parking lots.",
            "Heavy downpour caused flash water accumulation near Begumpet flyover.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000008"),
        "title": "Thar Desert Severe Dust Storm (Andhi)",
        "category": "dust_storm",
        "city": "Jaisalmer",
        "state": "Rajasthan",
        "region": "west",
        "lon": 70.9125,
        "lat": 26.9125,
        "severity": "moderate",
        "confidence": 0.79,
        "lifecycle_status": "detected",
        "has_contradiction": False,
        "sensor_mm": 0.0,
        "snippets": [
            "Massive wall of dust swept across western Rajasthan borders reducing visibility to 20m.",
            "Desert highway traffic brought to complete standstill between Jaisalmer and Barmer.",
            "Strong convective gusts tore down tin roofs in Pokhran rural belt.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000009"),
        "title": "Western Disturbance Dense Fog & Hail",
        "category": "fog",
        "city": "Shimla",
        "state": "Himachal Pradesh",
        "region": "north",
        "lon": 77.1734,
        "lat": 31.1048,
        "severity": "low",
        "confidence": 0.84,
        "lifecycle_status": "confirmed",
        "has_contradiction": False,
        "sensor_mm": 12.0,
        "snippets": [
            "Thick cloud and mountain fog enveloping the Ridge and Mall Road.",
            "Temperature plunges 7 degrees below normal. Slippery roads reported on Kalka-Shimla NH.",
            "Light hail reported in upper Kufri and Mashobra apple orchard belts.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000010"),
        "title": "Brahmaputra Basin Flash Flood Alert",
        "category": "flooding",
        "city": "Guwahati",
        "state": "Assam",
        "region": "northeast",
        "lon": 91.7362,
        "lat": 26.1445,
        "severity": "high",
        "confidence": 0.90,
        "lifecycle_status": "emerging",
        "has_contradiction": False,
        "sensor_mm": 115.0,
        "snippets": [
            "Brahmaputra river flowing 0.8m above danger mark near Bharalumukh.",
            "Heavy hill runoff causing severe artificial flooding in Anil Nagar and Chandmari.",
            "SDRF rescue boats stationed along low-lying riverbanks.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000011"),
        "title": "Vidarbha Extreme Heat Anomaly (47.1°C)",
        "category": "heatwave",
        "city": "Nagpur",
        "state": "Maharashtra",
        "region": "west",
        "lon": 79.0882,
        "lat": 21.1458,
        "severity": "high",
        "confidence": 0.88,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "sensor_mm": 0.0,
        "snippets": [
            "Nagpur records hottest day of the season at 47.1°C.",
            "Zero pedestrian traffic on Sitabuldi market streets during peak afternoon hours.",
            "District hospital opens dedicated cooling wards for heat-stroke patients.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000012"),
        "title": "Western Ghats Torrential Downpour & Ghat Inundation",
        "category": "rainfall",
        "city": "Pune",
        "state": "Maharashtra",
        "region": "west",
        "lon": 73.8567,
        "lat": 18.5204,
        "severity": "moderate",
        "confidence": 0.85,
        "lifecycle_status": "active",
        "has_contradiction": False,
        "sensor_mm": 76.5,
        "snippets": [
            "Heavy lashing rain in Pune city and Katraj ghats causing localized landslides.",
            "Mutha river water levels rising sharply near Deccan Gymkhana.",
            "Potholes and water accumulation slowing vehicles on Mumbai-Pune expressway bypass.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000013"),
        "title": "Bay of Bengal Depressive Thunder Squall",
        "category": "thunderstorm",
        "city": "Bhubaneswar",
        "state": "Odisha",
        "region": "east",
        "lon": 85.8245,
        "lat": 20.2961,
        "severity": "moderate",
        "confidence": 0.80,
        "lifecycle_status": "detected",
        "has_contradiction": False,
        "sensor_mm": 44.0,
        "snippets": [
            "Sudden squall accompanied by intense cloud-to-ground lightning across Khordha district.",
            "Power supply tripped in several residential blocks across Bhubaneswar.",
            "IMD radar tracking Doppler echo reflectivity exceeding 50 dBZ over coastal belt.",
        ]
    },
    {
        "id": uuid.UUID("e0000000-0000-0000-0000-000000000014"),
        "title": "Southwest Monsoon Surge & Sea Inundation",
        "category": "flooding",
        "city": "Kochi",
        "state": "Kerala",
        "region": "south",
        "lon": 76.2673,
        "lat": 9.9312,
        "severity": "moderate",
        "confidence": 0.86,
        "lifecycle_status": "confirmed",
        "has_contradiction": False,
        "sensor_mm": 88.0,
        "snippets": [
            "Rough sea conditions with seawater entering coastal settlements near Chellanam.",
            "Water stagnation on MG Road and Ernakulam South railway overbridge.",
            "District disaster management team activates round-the-clock emergency control room.",
        ]
    }
]

# ═══════════════════════════════════════════════════════════════════
# SEEDING LOGIC
# ═══════════════════════════════════════════════════════════════════

async def bulk_seed_traffic(db: AsyncSession, reset: bool = True) -> Dict[str, int]:
    """Populate full-spectrum database with realistic multi-source weather traffic."""
    logger.info("🚀 Commencing Bulk Seeding of Traffic Data...")

    if reset:
        logger.info("🧹 Purging existing event, report, and sensor data...")
        await db.execute(text(
            "TRUNCATE TABLE audit_log, event_lifecycle_log, sensor_readings, "
            "event_report_map, media_items, reports, duplicate_clusters, events, "
            "citizen_sessions, sources, admin_users RESTART IDENTITY CASCADE;"
        ))
        await db.commit()

    stats = {
        "admins": 0,
        "sources": 0,
        "events": 0,
        "reports": 0,
        "clusters": 0,
        "sensors": 0,
        "media": 0,
        "logs": 0,
    }

    # 1. Admin Users
    for u in ADMINS_SEED:
        db.add(AdminUser(
            id=u["id"],
            email=u["email"],
            password_hash=hash_password(u["password"]),
            role=u["role"],
        ))
        stats["admins"] += 1

    # 2. Ingestion Sources
    sources_by_id = {}
    for s in SOURCES_SEED:
        src = Source(
            id=s["id"],
            platform=s["platform"],
            handle=s["handle"],
            trust_score=s["trust_score"],
        )
        db.add(src)
        sources_by_id[s["platform"]] = src
        stats["sources"] += 1

    # 3. Citizen Sessions
    citizen_session = CitizenSession(
        id=uuid.UUID("c0000000-0000-0000-0000-000000000001"),
        device_id="device-sim-001",
        preferred_language="en",
    )
    db.add(citizen_session)

    await db.flush()

    # 4. Canonical Weather Events
    events_objs = []
    for hot in INDIAN_HOTSPOTS:
        ev = Event(
            id=hot["id"],
            title=hot["title"],
            category=hot["category"],
            centroid=_wkt(hot["lon"], hot["lat"]),
            city=hot["city"],
            state=hot["state"],
            region=hot["region"],
            severity=hot["severity"],
            confidence=hot["confidence"],
            lifecycle_status=hot["lifecycle_status"],
            has_contradiction=hot["has_contradiction"],
            independent_source_count=len(hot["snippets"]),
            detected_at=NOW - timedelta(hours=random.randint(4, 18)),
            last_updated_at=NOW - timedelta(minutes=random.randint(5, 60)),
        )
        db.add(ev)
        events_objs.append(ev)
        stats["events"] += 1

        # Event Lifecycle Progression History
        progression = ["detected", "emerging"]
        if hot["lifecycle_status"] in ["confirmed", "active"]:
            progression.append("confirmed")
        if hot["lifecycle_status"] == "active":
            progression.append("active")

        prev = None
        for step_idx, st in enumerate(progression):
            db.add(EventLifecycleLog(
                event_id=ev.id,
                from_status=prev,
                to_status=st,
                transitioned_at=ev.detected_at + timedelta(minutes=30 * (step_idx + 1)),
                trigger_reason=f"Multi-source threshold corroborated by IMD telemetry (step {step_idx+1})",
            ))
            prev = st
            stats["logs"] += 1

        # Sensor Reading (if rainfall > 0 or specific event)
        if hot["sensor_mm"] is not None:
            db.add(SensorReading(
                station_id=f"AWS-{hot['state'][:3].upper()}-{ev.id.hex[:4]}",
                location=_wkt(hot["lon"] + random.uniform(-0.02, 0.02), hot["lat"] + random.uniform(-0.02, 0.02)),
                rainfall_mm=hot["sensor_mm"],
                recorded_at=ev.detected_at + timedelta(minutes=45),
                corroborates_event_id=ev.id,
            ))
            stats["sensors"] += 1

    await db.flush()

    # 5. Duplicate Clusters Setup
    dup_clusters = []
    for c_idx in range(3):
        dc = DuplicateCluster(
            id=uuid.uuid4(),
            member_count=3,
        )
        db.add(dc)
        dup_clusters.append(dc)
        stats["clusters"] += 1

    await db.flush()

    # 6. Reports Generation (100+ reports)
    all_reports = []
    source_list = SOURCES_SEED

    report_idx = 0
    variations = [
        "",
        "Update from ground: ",
        "Citizen alert: ",
    ]

    for hot in INDIAN_HOTSPOTS:
        # Generate primary and secondary reports for realistic crowd density
        for i, snippet in enumerate(hot["snippets"]):
            # Create 2 reports per snippet with realistic temporal and wording variations
            reps_to_make = 2
            for var_idx in range(reps_to_make):
                report_idx += 1
                src_def = random.choice(source_list)
                is_citizen = (src_def["platform"] == "citizen_app")

                # Text variation
                prefix = variations[var_idx % len(variations)]
                rep_text = f"{prefix}{snippet}" if prefix else snippet

                # Offset location slightly within 5km radius
                lon_jitter = hot["lon"] + random.uniform(-0.035, 0.035)
                lat_jitter = hot["lat"] + random.uniform(-0.035, 0.035)

                # Assign status: ~60% verified, ~30% pending (for triage queue!), ~10% under_review/rejected
                status_dice = random.random()
                if status_dice < 0.60:
                    status = "verified"
                    p_misleading = random.uniform(0.01, 0.15)
                elif status_dice < 0.88:
                    status = "pending"
                    p_misleading = random.uniform(0.10, 0.40)
                elif status_dice < 0.94:
                    status = "under_review"
                    p_misleading = random.uniform(0.40, 0.70)
                else:
                    status = "rejected"
                    p_misleading = random.uniform(0.85, 0.98)

                rep_id = uuid.uuid4()
                report_time = hot.get("detected_at", NOW - timedelta(hours=6)) + timedelta(minutes=random.randint(5, 180))

                # Duplicate cluster linkage for first 3 clusters
                cluster_id = None
                if report_idx <= 9:
                    cluster_id = dup_clusters[(report_idx - 1) // 3].id

                rep = Report(
                    id=rep_id,
                    source_id=src_def["id"],
                    citizen_session_id=citizen_session.id if is_citizen else None,
                    source_native_id=f"{src_def['platform'][:3]}-{uuid.uuid4().hex[:8]}",
                    duplicate_cluster_id=cluster_id,
                    raw_text=rep_text,
                    clean_text=rep_text.lower(),
                    language="en",
                    location=_wkt(lon_jitter, lat_jitter),
                    city=hot["city"],
                    state=hot["state"],
                    region=hot["region"],
                    geocode_confidence=round(random.uniform(0.82, 0.98), 2),
                    geocode_method="gps" if is_citizen else "ner_geocoded",
                    reported_at=report_time,
                    event_category=hot["category"],
                    category_confidence=round(random.uniform(0.85, 0.99), 2),
                    p_misleading=round(p_misleading, 3),
                    status=status,
                )
                db.add(rep)
                all_reports.append(rep)
                stats["reports"] += 1

                # Link report to event
                db.add(EventReportMap(
                    event_id=hot["id"],
                    report_id=rep_id,
                    linked_at=report_time,
                ))

                # Add MediaItem for citizen photos
                if is_citizen and (report_idx % 3 == 0):
                    db.add(MediaItem(
                        report_id=rep_id,
                        media_type="image",
                        storage_url=f"skygrid-media/reports/{rep_id}/photo.jpg",
                        perceptual_hash=f"phash_{rep_id.hex[:16]}",
                    ))
                    stats["media"] += 1

    # Add 12 standalone recent citizen reports in verification queue (unfused / pending triage)
    QUEUE_SNIPPETS = [
        ("Lucknow", "Uttar Pradesh", "north", 80.9462, 26.8467, "rainfall", "Sudden heavy shower in Hazratganj. Water pooling under bridge."),
        ("Jaipur", "Rajasthan", "west", 75.7873, 26.9124, "dust_storm", "Gusty winds carrying dust over MI Road near Ajmeri Gate."),
        ("Bhopal", "Madhya Pradesh", "west", 77.4126, 23.2599, "thunderstorm", "Loud lightning and thunder heard near Upper Lake area."),
        ("Chandigarh", "Punjab", "north", 76.7794, 30.7333, "fog", "Morning fog limiting visibility in Sector 17 commercial zone."),
        ("Patna", "Bihar", "east", 85.1376, 25.5941, "rainfall", "Water stagnation on Bailey Road following 40-minute downpour."),
        ("Indore", "Madhya Pradesh", "west", 75.8577, 22.7196, "rainfall", "Continuous drizzle since afternoon. Wet roads on AB Road."),
        ("Coimbatore", "Tamil Nadu", "south", 76.9558, 11.0168, "strong_wind", "High velocity wind gusts observed near Western Ghats foothills."),
        ("Visakhapatnam", "Andhra Pradesh", "south", 83.2185, 17.6868, "strong_wind", "Choppy seas and squally winds at RK Beach promenade."),
        ("Varanasi", "Uttar Pradesh", "north", 82.9739, 25.3176, "heatwave", "Afternoon temperature peaking near 44°C. Hot loo winds on ghats."),
        ("Dehradun", "Uttarakhand", "north", 78.0322, 30.3165, "rainfall", "Sudden cloudburst alert over Sahastradhara stream basin."),
        ("Surat", "Gujarat", "west", 72.8311, 21.1702, "flooding", "Tapi river embankment water seepage reported in Rander area."),
        ("Agra", "Uttar Pradesh", "north", 78.0081, 27.1767, "fog", "Taj Mahal barely visible from distance due to heavy morning haze/fog."),
    ]

    for city, st, reg, lon, lat, cat, txt in QUEUE_SNIPPETS:
        rep_id = uuid.uuid4()
        rep = Report(
            id=rep_id,
            source_id=SOURCES_SEED[0]["id"],  # citizen_app
            citizen_session_id=citizen_session.id,
            source_native_id=f"cit-{uuid.uuid4().hex[:8]}",
            raw_text=txt,
            clean_text=txt.lower(),
            language="en",
            location=_wkt(lon + random.uniform(-0.01, 0.01), lat + random.uniform(-0.01, 0.01)),
            city=city,
            state=st,
            region=reg,
            geocode_confidence=0.92,
            geocode_method="gps",
            reported_at=NOW - timedelta(minutes=random.randint(10, 90)),
            event_category=cat,
            category_confidence=0.88,
            p_misleading=round(random.uniform(0.04, 0.35), 3),
            status="pending",
        )
        db.add(rep)
        all_reports.append(rep)
        stats["reports"] += 1

    # Flush reports into database before referencing them in duplicate clusters
    await db.flush()

    # Link representative report to each cluster
    for dc in dup_clusters:
        rep_member = next((r for r in all_reports if r.duplicate_cluster_id == dc.id), None)
        if rep_member:
            dc.representative_report_id = rep_member.id

    # 7. Audit Log entries for analyst actions
    admin_id = ADMINS_SEED[0]["id"]
    db.add(AuditLog(
        admin_user_id=admin_id,
        action="verify_report",
        target_type="report",
        target_id=all_reports[0].id,
        details={"reason": "Corroborated by IMD radar and AWS sensor feed", "confidence": 0.97},
    ))
    db.add(AuditLog(
        admin_user_id=admin_id,
        action="merge_event",
        target_type="event",
        target_id=INDIAN_HOTSPOTS[0]["id"],
        details={"cluster_id": str(dup_clusters[0].id), "member_count": 3},
    ))
    db.add(AuditLog(
        admin_user_id=admin_id,
        action="verify_event",
        target_type="event",
        target_id=INDIAN_HOTSPOTS[1]["id"],
        details={"reason": "Corroborated by Bangalore AWS Station and 12 citizen reports"},
    ))
    stats["logs"] += 3

    await db.commit()
    logger.info("✅ Bulk Seeding Completed Successfully!")
    for k, v in stats.items():
        logger.info(f"   • {k.capitalize()}: {v}")

    return stats


# ═══════════════════════════════════════════════════════════════════
# LIVE TRAFFIC STREAM SIMULATION LOGIC
# ═══════════════════════════════════════════════════════════════════

SIM_SCENARIOS = [
    {
        "city": "Mumbai",
        "state": "Maharashtra",
        "lat": 19.0760,
        "lon": 72.8777,
        "category": "flooding",
        "texts": [
            "Water levels rising rapidly on Western Express Highway near Bandra subway.",
            "Dadar TT circle completely submerged. Traffic moving at crawl pace.",
            "High tide coinciding with heavy downpour in Colaba. Sea wall warning.",
            "Waterlogging outside Kurla station platform 1. Heavy crowd congestion.",
        ]
    },
    {
        "city": "Bengaluru",
        "state": "Karnataka",
        "lat": 12.9716,
        "lon": 77.5946,
        "category": "rainfall",
        "texts": [
            "Severe waterlogging at Silk Board junction. Vehicles stranded under flyover.",
            "Torrential downpour in Koramangala 4th block. Drains overflowing onto roads.",
            "Heavy rain and lightning reported across Outer Ring Road tech corridor.",
            "Tree uprooted blocking main road in Indiranagar 100ft road.",
        ]
    },
    {
        "city": "New Delhi",
        "state": "Delhi",
        "lat": 28.6139,
        "lon": 77.2090,
        "category": "fog",
        "texts": [
            "Zero visibility on DND flyway due to dense smog and winter fog.",
            "Multiple flights on hold at IGI Airport terminal 3 due to runway fog.",
            "Severe fog advisory issued along Yamuna Expressway. Heavy traffic delays.",
        ]
    },
    {
        "city": "Kolkata",
        "state": "West Bengal",
        "lat": 22.5726,
        "lon": 88.3639,
        "category": "thunderstorm",
        "texts": [
            "Sudden Kalbaishakhi squall hitting Salt Lake Sector V. Winds over 60 km/h.",
            "Heavy thunderclaps and localized power disruption near Howrah station.",
            "Gusty winds causing tin shed collapses near EM Bypass.",
        ]
    },
    {
        "city": "Ahmedabad",
        "state": "Gujarat",
        "lat": 23.0225,
        "lon": 72.5714,
        "category": "heatwave",
        "texts": [
            "Temperature reading 46.2°C at Ashram Road. Heat wave alert active.",
            "Extreme heat conditions across SG Highway. Heat exhaustion reported.",
            "Blistering winds and dry heat warning issued by civic authorities.",
        ]
    },
    {
        "city": "Chennai",
        "state": "Tamil Nadu",
        "lat": 13.0827,
        "lon": 80.2707,
        "category": "strong_wind",
        "texts": [
            "Squall wind gusts hitting Marina beach front. High sea waves observed.",
            "Waterlogging outside T Nagar bus terminus. Buses being diverted.",
        ]
    }
]

def _generate_synthetic_image() -> bytes:
    """Generate a lightweight JPEG byte array to simulate media upload."""
    img = Image.new("RGB", (64, 64), color=(random.randint(40, 200), random.randint(40, 200), random.randint(150, 255)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()

async def stream_live_traffic(
    api_url: str = "http://localhost:8000/v1",
    count: int = 25,
    interval: float = 2.0,
) -> None:
    """Simulate real-time live incoming traffic by posting to the live FastAPI gateway."""
    logger.info("📡 Starting Live Traffic Streaming Simulator...")
    logger.info(f"   Target Gateway: {api_url}/reports")
    logger.info(f"   Interval: {interval}s | Iterations: {'Continuous' if count == 0 else count}")

    total_sent = 0
    successful = 0

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            while True:
                total_sent += 1
                scenario = random.choice(SIM_SCENARIOS)
                snippet = random.choice(scenario["texts"])
                
                # Small random spatial jitter (approx 1-3km)
                lat = scenario["lat"] + random.uniform(-0.02, 0.02)
                lon = scenario["lon"] + random.uniform(-0.02, 0.02)
                device_id = f"sim-device-{random.randint(100, 999)}"

                # Prepare payload
                data = {
                    "event_category": scenario["category"],
                    "location_method": "gps",
                    "lat": str(round(lat, 5)),
                    "lon": str(round(lon, 5)),
                    "description": snippet,
                    "language": "en",
                }

                files = {}
                # 30% chance of attaching synthetic photo
                if random.random() < 0.35:
                    files["media"] = ("live_weather.jpg", _generate_synthetic_image(), "image/jpeg")

                headers = {
                    "X-Device-Id": device_id,
                }

                try:
                    res = await client.post(f"{api_url}/reports", data=data, files=files if files else None, headers=headers)
                    if res.status_code in (200, 201, 202):
                        successful += 1
                        body = res.json()
                        rep_id = body.get("id", "ok")
                        logger.info(
                            f"[{total_sent:03d}] ⚡ STREAMED REPORT: {scenario['city']:10} | {scenario['category']:12} | "
                            f"ID: {rep_id[:8]}... | Status: {res.status_code} OK (Triggered Celery/Kafka/SSE)"
                        )
                    else:
                        logger.warning(f"[{total_sent:03d}] ⚠ API returned {res.status_code}: {res.text[:120]}")
                except Exception as exc:
                    logger.error(f"[{total_sent:03d}] ❌ Error posting to API: {exc}")

                if count > 0 and total_sent >= count:
                    break

                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            logger.info("Simulation halted by user.")

    logger.info(f"🏁 Live stream simulation finished: {successful}/{total_sent} reports successfully ingested.")


# ═══════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

async def main():
    parser = argparse.ArgumentParser(description="SkySignal 2.0 Weather Traffic Simulator & Seeder")
    parser.add_argument("--seed", action="store_true", help="Bulk seed database with comprehensive Indian weather events & reports")
    parser.add_argument("--reset", action="store_true", default=True, help="Purge/truncate existing tables before seeding")
    parser.add_argument("--stream", "--live", dest="stream", action="store_true", help="Run live traffic streaming simulator into the API")
    parser.add_argument("--count", type=int, default=20, help="Number of reports to stream (0 for continuous)")
    parser.add_argument("--interval", type=float, default=1.8, help="Interval in seconds between simulated reports")
    parser.add_argument("--api-url", type=str, default="http://localhost:8000/v1", help="FastAPI gateway URL for live streaming")

    args = parser.parse_args()

    # Default action if no flags provided: seed first, then inform
    do_seed = args.seed or (not args.seed and not args.stream)
    do_stream = args.stream

    if do_seed:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as session:
            await bulk_seed_traffic(session, reset=args.reset)
        await engine.dispose()

    if do_stream:
        await stream_live_traffic(api_url=args.api_url, count=args.count, interval=args.interval)
    elif do_seed and not args.stream:
        logger.info("\n💡 TIP: To start a live traffic stream simulation anytime, run:")
        logger.info("   python backend/scripts/simulate_traffic.py --stream --count 30 --interval 1.5")


if __name__ == "__main__":
    asyncio.run(main())

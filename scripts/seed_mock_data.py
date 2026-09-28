import sys, os
# Load backend environment variables for proper DB configuration
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / 'backend' / '.env')
# Add backend directory to PYTHONPATH so that 'app' package can be imported
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Automatically detect if PostgreSQL is mapped to port 5433 (via docker-compose)
import socket
def _is_port_listening(port: int) -> bool:
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.5):
            return True
    except Exception:
        return False

current_db_url = os.environ.get("DATABASE_URL", "")
if _is_port_listening(5433) and ("localhost:5432" in current_db_url or "127.0.0.1:5432" in current_db_url):
    try:
        import asyncpg, asyncio
        async def _probe():
            conn = await asyncpg.connect("postgresql://skygrid:skygrid_secret@127.0.0.1:5432/skygrid", timeout=1.0)
            await conn.close()
        asyncio.run(_probe())
    except Exception:
        # Fall back to Docker-mapped port 5433
        new_url = current_db_url.replace("localhost:5432", "localhost:5433").replace("127.0.0.1:5432", "127.0.0.1:5433")
        os.environ["DATABASE_URL"] = new_url
        os.environ["POSTGRES_PORT"] = "5433"
        print(f"[INFO] Auto-detected Docker PostGIS on port 5433. Using: {new_url}")

import asyncio
import random
import uuid
import asyncpg
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement

from app.db.session import async_session
from app.models.source import Source
from app.models.event import Event, EventReportMap
from app.models.report import Report

# ---------------------------------------------------------------------------
# Helper: wait for PostgreSQL to become reachable (useful when containers are
# just starting). Retries with exponential back‑off.
# ---------------------------------------------------------------------------
async def wait_for_db(retries: int = 12, base_delay: float = 2.0) -> None:
    """Attempt to open a raw asyncpg connection until it succeeds.
    Raises the last exception after exhausting retries.
    """
    from app.core.config import settings
    # Adjust DSN for asyncpg (remove '+asyncpg' suffix)
    dsn = settings.DATABASE_URL.replace('+asyncpg', '')
    for attempt in range(1, retries + 1):
        try:
            conn = await asyncpg.connect(dsn)
            await conn.close()
            print(f"[OK] DB connection established (attempt {attempt})")
            return
        except Exception as exc:
            print(f"[WARN] DB not ready (attempt {attempt}/{retries}): {exc}")
            if attempt == retries:
                raise
            await asyncio.sleep(base_delay * attempt)

# ---------------------------------------------------------------------------
# Mock data definitions
# ---------------------------------------------------------------------------
SOURCES_DATA = [
    {"platform": "twitter", "handle": "@weather_bot"},
    {"platform": "citizen_app", "handle": None},
    {"platform": "news", "handle": "Times of India"},
    {"platform": "imd_official", "handle": "IMD"},
]

EVENTS_DATA = [
    {
        "title": "Severe Flooding in Mumbai",
        "category": "flooding",
        "severity": "critical",
        "lifecycle_status": "active",
        "city": "Mumbai",
        "state": "Maharashtra",
        "region": "west",
        "centroid": [72.8777, 19.0760],
    },
    {
        "title": "Heatwave in Ahmedabad",
        "category": "heatwave",
        "severity": "high",
        "lifecycle_status": "confirmed",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "region": "west",
        "centroid": [72.5714, 23.0225],
    },
    {
        "title": "Thunderstorm in Delhi",
        "category": "thunderstorm",
        "severity": "moderate",
        "lifecycle_status": "emerging",
        "city": "Delhi",
        "state": "Delhi",
        "region": "north",
        "centroid": [77.2090, 28.6139],
    },
    {
        "title": "Dust Storm in Rajasthan",
        "category": "dust_storm",
        "severity": "moderate",
        "lifecycle_status": "detected",
        "city": "Jaisalmer",
        "state": "Rajasthan",
        "region": "west",
        "centroid": [70.9125, 26.9125],
    },
    {
        "title": "Fog in Shimla",
        "category": "fog",
        "severity": "low",
        "lifecycle_status": "confirmed",
        "city": "Shimla",
        "state": "Himachal Pradesh",
        "region": "north",
        "centroid": [77.1734, 31.1048],
    },
]

# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------
async def truncate_tables(sess: AsyncSession) -> None:
    await sess.execute(text("TRUNCATE TABLE event_report_map, events, reports, sources RESTART IDENTITY CASCADE;"))
    await sess.commit()

async def seed_sources(sess: AsyncSession) -> list[Source]:
    sources = []
    for data in SOURCES_DATA:
        src = Source(platform=data["platform"], handle=data["handle"])
        sess.add(src)
        sources.append(src)
    await sess.commit()
    return sources

async def seed_events(sess: AsyncSession) -> list[Event]:
    events = []
    now = datetime.now(timezone.utc)
    for data in EVENTS_DATA:
        lon, lat = data["centroid"]
        ev = Event(
            title=data["title"],
            category=data["category"],
            severity=data["severity"],
            lifecycle_status=data["lifecycle_status"],
            city=data["city"],
            state=data["state"],
            region=data["region"],
            confidence=0.8,
            detected_at=now,
            centroid=WKTElement(f"POINT({lon} {lat})", srid=4326),
        )
        ev._seed_lon = lon
        ev._seed_lat = lat
        sess.add(ev)
        events.append(ev)
    await sess.commit()
    return events

async def seed_reports(sess: AsyncSession, events: list[Event], sources: list[Source]) -> None:
    now = datetime.now(timezone.utc)
    for _ in range(25):
        event = random.choice(events)
        source = random.choice(sources)
        lon = getattr(event, "_seed_lon", 72.8777)
        lat = getattr(event, "_seed_lat", 19.0760)
        offset_lon = lon + random.uniform(-0.05, 0.05)
        offset_lat = lat + random.uniform(-0.05, 0.05)
        rep = Report(
            source_id=source.id,
            source_native_id=str(uuid.uuid4()),
            raw_text=f"Reported {event.category} near {event.city}",
            clean_text=f"{event.category.capitalize()} observed near {event.city}",
            language="en",
            location=WKTElement(f"POINT({offset_lon} {offset_lat})", srid=4326),
            reported_at=now,
            event_category=event.category,
            category_confidence=random.uniform(0.6, 0.98),
            p_misleading=random.uniform(0.0, 0.5),
            status=random.choice(["pending", "verified"]),
        )
        sess.add(rep)
        await sess.flush()
        mapping = EventReportMap(event_id=event.id, report_id=rep.id)
        sess.add(mapping)
    await sess.commit()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main() -> None:
    await wait_for_db()
    async with async_session() as sess:
        await truncate_tables(sess)
        sources = await seed_sources(sess)
        events = await seed_events(sess)
        await seed_reports(sess, events, sources)

if __name__ == "__main__":
    asyncio.run(main())

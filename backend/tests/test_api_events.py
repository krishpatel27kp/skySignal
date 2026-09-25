import pytest
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.admin import AdminUser
from app.models.event import Event, EventReportMap
from app.models.report import Report
from app.models.source import Source

@pytest.fixture
async def admin_token(db: AsyncSession) -> str:
    admin = AdminUser(
        email=f"test_{uuid.uuid4()}@imd.gov.in",
        password_hash="fake",
        role="senior_admin"
    )
    db.add(admin)
    await db.commit()
    token, _ = create_access_token({"sub": str(admin.id)})
    return token

@pytest.fixture
async def sample_events(db: AsyncSession) -> list[Event]:
    e1 = Event(
        title="Detected Event",
        category="flooding",
        centroid="SRID=4326;POINT(72 19)",
        severity="low",
        confidence=0.5,
        lifecycle_status="detected",
        detected_at=datetime.now(timezone.utc),
    )
    e2 = Event(
        title="Active Event",
        category="flooding",
        centroid="SRID=4326;POINT(72 19)",
        severity="high",
        confidence=0.9,
        lifecycle_status="active",
        detected_at=datetime.now(timezone.utc),
    )
    db.add_all([e1, e2])
    await db.commit()
    return [e1, e2]

@pytest.mark.asyncio
async def test_public_events_visibility_restriction(client: AsyncClient, sample_events):
    # No auth
    response = await client.get("/v1/events")
    assert response.status_code == 200
    results = response.json()["results"]
    
    # Should only see 'active', not 'detected'
    assert len(results) >= 1
    assert all(r["lifecycle_status"] in ["active", "confirmed"] for r in results)
    
@pytest.mark.asyncio
async def test_admin_events_full_visibility(client: AsyncClient, admin_token: str, sample_events):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = await client.get("/v1/events", headers=headers)
    assert response.status_code == 200
    results = response.json()["results"]
    
    # Should see both
    statuses = [r["lifecycle_status"] for r in results]
    assert "detected" in statuses
    assert "active" in statuses

@pytest.mark.asyncio
async def test_event_detail_public_vs_admin(client: AsyncClient, admin_token: str, sample_events):
    active_event_id = str([e.id for e in sample_events if e.lifecycle_status == "active"][0])
    
    # Public
    res_pub = await client.get(f"/v1/events/{active_event_id}")
    assert res_pub.status_code == 200
    pub_data = res_pub.json()
    assert "evidence" in pub_data
    assert "reports_list" not in pub_data or pub_data["reports"] is None
    assert "lifecycle_history" not in pub_data or pub_data["lifecycle_history"] is None
    
    # Admin
    headers = {"Authorization": f"Bearer {admin_token}"}
    res_adm = await client.get(f"/v1/events/{active_event_id}", headers=headers)
    assert res_adm.status_code == 200
    adm_data = res_adm.json()
    assert adm_data["reports"] is not None
    assert adm_data["lifecycle_history"] is not None

@pytest.mark.asyncio
async def test_event_merge_recomputes_target(client: AsyncClient, db: AsyncSession, admin_token: str, sample_events):
    source_event = sample_events[0]
    target_event = sample_events[1]
    
    # Mock some reports linked to source_event
    src = Source(platform="twitter")
    db.add(src)
    await db.commit()
    
    r = Report(
        source_id=src.id, 
        event_category="flooding", 
        reported_at=datetime.now(timezone.utc),
        location="SRID=4326;POINT(72 19)"
    )
    db.add(r)
    await db.commit()
    
    m = EventReportMap(event_id=source_event.id, report_id=r.id)
    db.add(m)
    await db.commit()
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"with_event_id": str(target_event.id)}
    
    res = await client.post(f"/v1/events/{source_event.id}/merge", headers=headers, json=payload)
    assert res.status_code == 200
    assert res.json()["reports_moved"] == 1
    
    # Check DB
    source_db_stmt = select(Event).where(Event.id == source_event.id)
    source_db = (await db.scalars(source_db_stmt)).first()
    await db.refresh(source_db)
    assert source_db.lifecycle_status == "resolved"
    
    # Check mappings
    mappings_stmt = select(EventReportMap).where(EventReportMap.event_id == target_event.id)
    target_mappings = (await db.scalars(mappings_stmt)).all()
    assert any(mapping.report_id == r.id for mapping in target_mappings)

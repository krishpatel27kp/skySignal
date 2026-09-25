import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.admin import AdminUser
from app.models.report import Report
from app.models.source import CitizenSession

@pytest.fixture
async def admin_token(db: AsyncSession) -> str:
    # Create test admin
    import uuid
    admin = AdminUser(
        email=f"test_{uuid.uuid4()}@imd.gov.in",
        password_hash="fake",
        role="senior_admin"
    )
    db.add(admin)
    await db.commit()
    token, _ = create_access_token({"sub": str(admin.id)})
    return token

@pytest.mark.asyncio
async def test_submit_citizen_report_success(client: AsyncClient, db: AsyncSession):
    headers = {"X-Device-Id": "test-device-123"}
    data = {
        "event_category": "flooding",
        "location_method": "gps",
        "lat": "19.0",
        "lon": "72.0",
        "description": "Test report",
    }
    
    # We won't test file upload here for simplicity, description is present
    response = await client.post("/v1/reports", headers=headers, data=data)
    
    assert response.status_code == 201
    res_data = response.json()
    assert "id" in res_data
    assert res_data["status"] == "pending"
    
    # Verify DB
    report_id = res_data["id"]
    from sqlalchemy.orm import selectinload
    stmt = select(Report).options(selectinload(Report.citizen_session)).where(Report.id == report_id)
    report = (await db.scalars(stmt)).first()
    assert report is not None
    assert report.event_category == "flooding"
    assert report.citizen_session is not None
    assert report.citizen_session.device_id == "test-device-123"

@pytest.mark.asyncio
async def test_submit_citizen_report_validation_errors(client: AsyncClient):
    headers = {"X-Device-Id": "test-device-123"}
    
    # Missing media and description
    data = {
        "event_category": "flooding",
        "location_method": "gps",
        "lat": "19.0",
        "lon": "72.0",
    }
    response = await client.post("/v1/reports", headers=headers, data=data)
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Provide a description and/or at least one media file"
    
    # Missing GPS coords
    data = {
        "event_category": "flooding",
        "location_method": "gps",
        "description": "Test"
    }
    response = await client.post("/v1/reports", headers=headers, data=data)
    assert response.status_code == 400
    assert "lat and lon are required" in response.json()["error"]["message"]

@pytest.mark.asyncio
async def test_reports_mine_isolation(client: AsyncClient, db: AsyncSession):
    import uuid
    h1 = {"X-Device-Id": f"dev-1-{uuid.uuid4()}"}
    h2 = {"X-Device-Id": f"dev-2-{uuid.uuid4()}"}
    
    data = {"event_category": "fog", "location_method": "manual", "lat": "1.0", "lon": "1.0", "description": "T"}
    
    # User 1 submits 2 reports
    r1 = await client.post("/v1/reports", headers=h1, data=data)
    assert r1.status_code == 201, f"Failed: {r1.json()}"
    await client.post("/v1/reports", headers=h1, data=data)
    
    # User 2 submits 1 report
    await client.post("/v1/reports", headers=h2, data=data)
    
    res1 = await client.get("/v1/reports/mine", headers=h1)
    assert res1.status_code == 200
    assert len(res1.json()["results"]) == 2
    
    res2 = await client.get("/v1/reports/mine", headers=h2)
    assert res2.status_code == 200
    assert len(res2.json()["results"]) == 1

@pytest.mark.asyncio
async def test_admin_reports_filtering_and_search(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Search for specific report
    response = await client.get("/v1/reports?event_category=fog", headers=headers)
    assert response.status_code == 200
    assert "results" in response.json()

@pytest.mark.asyncio
async def test_bulk_action_reports(client: AsyncClient, db: AsyncSession, admin_token: str):
    # Submit a report to verify
    h = {"X-Device-Id": "dev-bulk"}
    d = {"event_category": "fog", "location_method": "denied", "description": "bulk"}
    res = await client.post("/v1/reports", headers=h, data=d)
    r_id = res.json()["id"]
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {"report_ids": [r_id], "action": "verify"}
    
    action_res = await client.post("/v1/reports/bulk-action", headers=headers, json=payload)
    assert action_res.status_code == 200
    assert action_res.json()["updated"] == 1
    
    report = await db.get(Report, r_id)
    assert report.status == "verified"

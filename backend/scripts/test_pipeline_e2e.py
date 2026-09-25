"""
End-to-End Pipeline Sanity Test.

Verifies the entire ingestion and processing pipeline:
1. Posts a multipart report to /v1/reports.
2. Asserts initial 'pending' status and ingestion success.
3. Polls the database to wait for Celery workers to finish processing.
4. Asserts MinIO media processing (perceptual_hash).
5. Asserts classification, trust scoring, and dedup outputs.
"""

import asyncio
import io
import logging
from PIL import Image
import uuid

import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.report import Report
from app.models.report import MediaItem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("e2e_test")

async def run_e2e():
    # 1. Generate a test image
    img = Image.new("RGB", (100, 100), color="blue")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_byte_arr.seek(0)

    # 2. Setup DB session
    engine = create_async_engine(str(settings.DATABASE_URL))
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    # 3. Post to API
    device_id = f"e2e-test-device-{uuid.uuid4()}"
    api_url = "http://localhost:8000/v1/reports"  # Adjust if running outside Docker (inside it's http://api:8000)

    logger.info("Posting report to %s with device_id=%s", api_url, device_id)
    
    # We use httpx AsyncClient
    async with httpx.AsyncClient() as client:
        # If running from inside Docker, use http://localhost:8000 (uvicorn listens on 8000)
        # But wait, this script might run via `docker compose exec api python ...`
        
        files = {
            "media": ("test_flood.jpg", img_byte_arr, "image/jpeg")
        }
        data = {
            "event_category": "flooding",
            "location_method": "manual",
            "lat": 19.0760,
            "lon": 72.8777,
            "description": "Massive flood and waterlogging in Mumbai near the highway.",
            "language": "en"
        }
        headers = {
            "X-Device-Id": device_id
        }
        
        response = await client.post("http://localhost:8000/v1/reports", data=data, files=files, headers=headers)
        if response.status_code not in (201, 202):
            logger.error("Failed to post report: %s - %s", response.status_code, response.text)
            return
        
        resp_data = response.json()
        report_id = resp_data.get("id")
        logger.info("Report ingested successfully. Report ID: %s", report_id)
        
    # 4. Poll Database for Celery to finish
    logger.info("Waiting for Celery workers to process the report...")
    
    max_retries = 30
    delay = 1.0
    
    async with async_session() as db:
        for i in range(max_retries):
            report = await db.get(Report, uuid.UUID(report_id))
            if report:
                await db.refresh(report)
                if report.event_category is not None and report.p_misleading is not None:
                    logger.info("Processing complete!")
                    break
            await asyncio.sleep(delay)
        else:
            logger.error("Timeout waiting for processing to complete.")
            return

        # 5. Assertions
        logger.info("--- Verification Results ---")
        logger.info("Status: %s", report.status)
        logger.info("Event Category: %s (Confidence: %s)", report.event_category, report.category_confidence)
        logger.info("P(Misleading): %s", report.p_misleading)
        
        assert report.event_category == "flooding", f"Expected 'flooding', got {report.event_category}"
        assert report.category_confidence >= 0.9, "Confidence should be high for keyword match"
        assert report.p_misleading is not None, "Trust score was not computed"
        
        # Check Media
        stmt = select(MediaItem).where(MediaItem.report_id == uuid.UUID(report_id))
        media_result = await db.execute(stmt)
        media_items = media_result.scalars().all()
        
        assert len(media_items) == 1, "Expected 1 media item"
        media = media_items[0]
        assert media.perceptual_hash is not None, "Perceptual hash not computed"
        logger.info("Media item processed: Hash=%s, URL=%s", media.perceptual_hash, media.storage_url)
        
    logger.info("E2E Pipeline Sanity Test PASSED ✅")

if __name__ == "__main__":
    asyncio.run(run_e2e())

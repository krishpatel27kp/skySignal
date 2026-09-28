import asyncio
import httpx
import time
import json
import uuid

API_BASE = "http://127.0.0.1:8000/v1"
DEVICE_ID = str(uuid.uuid4())

async def run_e2e_test():
    print("🚀 Starting End-to-End Pipeline Test")
    print(f"📱 Simulating Citizen App with Device ID: {DEVICE_ID}")

    async with httpx.AsyncClient() as client:
        # 1. Send Report
        print("\n[1] Submitting POST /v1/reports...")
        payload = {
            "event_category": "flooding",
            "location_method": "gps",
            "description": "Severe flooding reported near the main highway! Water is knee deep.",
            "lat": 19.0760, # Mumbai
            "lon": 72.8777,
        }
        
        headers = {
            "X-Device-Id": DEVICE_ID
        }

        start_time = time.time()
        # Note: Sending as data (form-data) because FastAPI endpoint expects Form(...)
        response = await client.post(
            f"{API_BASE}/reports", 
            data=payload,
            headers=headers
        )

        if response.status_code == 201:
            print(f"✅ Report successfully ingested! (Time: {time.time() - start_time:.2f}s)")
            data = response.json()
            print(f"📦 Response Payload: {json.dumps(data, indent=2)}")
        else:
            print(f"❌ Failed to submit report! Status: {response.status_code}")
            print(response.text)
            return

        print("\n[2] How to trace the pipeline execution:")
        print("Run the following terminal commands to verify the Kafka worker pipeline:")
        print("---------------------------------------------------------")
        print("Tailing Kafka Worker Logs:")
        print("  docker logs skysignal-worker --tail 100 -f")
        print("---------------------------------------------------------")
        print("What you should see in the worker logs:")
        print("  1. raw.citizen -> Ingests the JSON payload")
        print("  2. normalized.reports -> Standardizes timestamps and geospatial coordinates")
        print("  3. processed.dedup -> Checks for duplicate reports in the same radius")
        print("  4. processed.classified -> Assigns confidence scores based on device trust")
        print("  5. weather.events -> Fuses multiple reports into a single 'Event'")
        
        print("\n[3] How to verify the real-time UI stream:")
        print("Open your browser network tab at http://localhost:5173")
        print("Look for the active SSE connection to `/v1/events/stream`.")
        print("You should see an `event_updated` payload pushed instantly to the React frontend!")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())

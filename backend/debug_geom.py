import asyncio
from app.db.session import async_session
from app.models.event import Event
from app.models.report import Report
from sqlalchemy import select, func

async def f():
    async with async_session() as db:
        try:
            r1 = (await db.execute(select(Report).limit(1))).scalar_one()
            event = (await db.execute(select(Event).limit(1))).scalar_one()
            sensor_stmt = (
                select(SensorReading)
                .join(Event, Event.id == event.id)
                .where(
                    SensorReading.rainfall_mm >= 5.0,
                    func.ST_DWithin(SensorReading.location, Event.centroid, 30000.0),
                    SensorReading.recorded_at >= event.detected_at,
                    SensorReading.recorded_at <= event.last_updated_at
                )
                .order_by(func.ST_Distance(SensorReading.location, Event.centroid))
                .limit(1)
            )
            res = await db.execute(sensor_stmt)
            print("WORKED")
        except Exception as e:
            print(f"EXACT ERROR: {e}")

asyncio.run(f())

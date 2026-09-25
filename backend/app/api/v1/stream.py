from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis

from app.core.config import settings
from app.api.deps import get_current_admin
from app.models.admin import AdminUser

stream_router = APIRouter(prefix="/events", tags=["events_stream"])
logger = logging.getLogger("skysignal.stream")

# Backward compatibility alias
get_stream_admin = get_current_admin


async def event_stream(request: Request) -> AsyncGenerator[str, None]:
    """
    Async generator that subscribes to the Redis Pub/Sub channel
    `events_telemetry` and yields formatted SSE strings to the client.
    """
    channel_name = settings.REDIS_CHANNEL_EVENTS_TELEMETRY or "events_telemetry"
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(channel_name)
    
    logger.info("Admin connected to SSE event stream on channel '%s'.", channel_name)
    
    try:
        while True:
            if await request.is_disconnected():
                logger.info("Admin client disconnected from SSE stream.")
                break
                
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is not None and "data" in message:
                raw_data = message["data"]
                try:
                    parsed = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                    event_type = parsed.get("type", "event_updated") if isinstance(parsed, dict) else "event_updated"
                    payload_data = parsed.get("data", parsed) if isinstance(parsed, dict) else parsed
                    data_str = json.dumps(payload_data, default=str)
                except Exception:
                    event_type = "event_updated"
                    data_str = str(raw_data)

                yield f"event: {event_type}\ndata: {data_str}\n\n"
                
            await asyncio.sleep(0.05)
    except asyncio.CancelledError:
        logger.info("SSE event stream cancelled.")
    finally:
        try:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()
            await r.aclose()
        except Exception as exc:
            logger.debug("Error closing Redis pubsub on SSE exit: %s", exc)


@stream_router.get(
    "/stream",
    summary="Real-time SSE telemetry event stream (Admin only)",
    description=(
        "Establishes a persistent Server-Sent Events (SSE) connection streaming "
        "real-time weather intelligence updates from Redis Pub/Sub. "
        "Requires analyst or senior_admin role via Bearer header or token query parameter."
    ),
)
async def stream_events(
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
):
    """Protected Server-Sent Events stream for real-time dashboard telemetry."""
    return StreamingResponse(
        event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

"""
SkySignal Event Service.

Handles weather event lifecycle querying, guest scoping enforcement,
and audit logging.
"""

from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event

logger = logging.getLogger("skysignal.events")

PUBLIC_LIFECYCLE_STATUSES: List[str] = ["confirmed", "active"]


class EventService:
    """Service layer for event querying and scoping."""

    @staticmethod
    def get_public_statuses() -> List[str]:
        """Return the statuses accessible by unauthenticated guests."""
        return list(PUBLIC_LIFECYCLE_STATUSES)

    @staticmethod
    def is_public_event(event: Event) -> bool:
        """Check whether an event is safe to expose to unauthenticated guests."""
        return event.lifecycle_status in PUBLIC_LIFECYCLE_STATUSES


event_service = EventService()

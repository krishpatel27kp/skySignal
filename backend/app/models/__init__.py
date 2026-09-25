"""
SQLAlchemy 2.0 ORM models — import all models here so that
``Base.metadata`` is fully populated for Alembic autogenerate
and relationship resolution.
"""

from app.models.source import Source, CitizenSession  # noqa: F401
from app.models.report import (  # noqa: F401
    Report,
    MediaItem,
    DuplicateCluster,
    DeadLetterReport,
    DeadLetterReports,
)
from app.models.event import (  # noqa: F401
    Event,
    EventReportMap,
    EventLifecycleLog,
    SensorReading,
)
from app.models.admin import AdminUser, AuditLog  # noqa: F401

__all__ = [
    "Source",
    "CitizenSession",
    "Report",
    "MediaItem",
    "DuplicateCluster",
    "DeadLetterReport",
    "DeadLetterReports",
    "Event",
    "EventReportMap",
    "EventLifecycleLog",
    "SensorReading",
    "AdminUser",
    "AuditLog",
]

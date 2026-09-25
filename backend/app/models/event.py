"""
Event, EventReportMap, EventLifecycleLog, and SensorReading models.

``Event`` is the fused, evidence-backed weather event — the primary
object the admin dashboard displays.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)

    # PostGIS geography — computed centroid of fused reports
    centroid = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region: Mapped[str | None] = mapped_column(String(30), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(String(20), nullable=False)
    has_contradiction: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false",
    )
    independent_source_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0",
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── Relationships ────────────────────────────────────────────
    report_links: Mapped[list["EventReportMap"]] = relationship(
        back_populates="event", cascade="all, delete-orphan", lazy="selectin",
    )
    lifecycle_logs: Mapped[list["EventLifecycleLog"]] = relationship(
        back_populates="event", cascade="all, delete-orphan", lazy="selectin",
    )
    sensor_readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="corroborated_event", lazy="selectin",
    )

    @property
    def lat(self) -> float | None:
        if self.centroid is not None:
            try:
                from geoalchemy2.shape import to_shape
                return to_shape(self.centroid).y
            except Exception:
                pass
        return None

    @property
    def lon(self) -> float | None:
        if self.centroid is not None:
            try:
                from geoalchemy2.shape import to_shape
                return to_shape(self.centroid).x
            except Exception:
                pass
        return None

    __table_args__ = (
        CheckConstraint(
            "category IN ('rainfall','thunderstorm','flooding','heatwave',"
            "'fog','dust_storm','strong_wind')",
            name="ck_events_category",
        ),
        CheckConstraint(
            "severity IN ('minor','moderate','severe')",
            name="ck_events_severity",
        ),
        CheckConstraint(
            "lifecycle_status IN ('detected','emerging','confirmed',"
            "'active','declining','resolved')",
            name="ck_events_lifecycle_status",
        ),
        Index(
            "ix_events_lifecycle_category_detected",
            "lifecycle_status", "category", "detected_at",
        ),
        Index("ix_events_centroid", "centroid", postgresql_using="gist"),
        Index("ix_events_severity", "severity"),
        Index("ix_events_region", "region"),
    )


class EventReportMap(Base):
    """Many-to-many join: fused events ↔ their constituent reports."""

    __tablename__ = "event_report_map"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        primary_key=True,
    )
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    event: Mapped["Event"] = relationship(back_populates="report_links")
    report: Mapped["Report"] = relationship()  # noqa: F821


class EventLifecycleLog(Base):
    """Audit trail of every lifecycle state transition for an event."""

    __tablename__ = "event_lifecycle_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    transitioned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    trigger_reason: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )

    # Relationships
    event: Mapped["Event"] = relationship(back_populates="lifecycle_logs")


class SensorReading(Base):
    """Official IMD sensor data — used only for corroboration during fusion."""

    __tablename__ = "sensor_readings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    station_id: Mapped[str] = mapped_column(String(50), nullable=False)
    location = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )
    rainfall_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    corroborates_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    corroborated_event: Mapped["Event | None"] = relationship(
        back_populates="sensor_readings",
    )

    __table_args__ = (
        Index("ix_sensor_readings_location", "location", postgresql_using="gist"),
        Index("ix_sensor_readings_station_recorded", "station_id", "recorded_at"),
    )

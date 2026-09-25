"""
Report, MediaItem, DuplicateCluster, and DeadLetterReport models.

``Report`` is the canonical, normalised record for every ingested piece
of weather information — the universal schema every adapter writes into.

``DuplicateCluster`` groups near-duplicate reports.  The FK between
reports ↔ duplicate_clusters is circular, broken with ``use_alter``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geography
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False,
    )
    citizen_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("citizen_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_native_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )
    duplicate_cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "duplicate_clusters.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_reports_duplicate_cluster_id",
        ),
        nullable=True,
    )
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    clean_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # PostGIS geography column — POINT with WGS84 (SRID 4326)
    location = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=True,
    )

    raw_location_text: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region: Mapped[str | None] = mapped_column(String(30), nullable=True)
    geocode_confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True,
    )
    geocode_method: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    event_category: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )
    category_confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True,
    )
    p_misleading: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Relationships ────────────────────────────────────────────
    source: Mapped["Source"] = relationship(  # noqa: F821
        back_populates="reports",
    )
    citizen_session: Mapped["CitizenSession | None"] = relationship(  # noqa: F821
        back_populates="reports",
    )
    media_items: Mapped[list["MediaItem"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", lazy="selectin",
    )
    duplicate_cluster: Mapped["DuplicateCluster | None"] = relationship(
        back_populates="members",
        foreign_keys=[duplicate_cluster_id],
    )

    @property
    def source_platform(self) -> str:
        return self.source.platform if self.source else "unknown"

    @property
    def source_handle(self) -> str | None:
        return self.source.handle if self.source else None

    @property
    def lat(self) -> float | None:
        if self.location is not None:
            try:
                from geoalchemy2.shape import to_shape
                return to_shape(self.location).y
            except Exception:
                pass
        return None

    @property
    def lon(self) -> float | None:
        if self.location is not None:
            try:
                from geoalchemy2.shape import to_shape
                return to_shape(self.location).x
            except Exception:
                pass
        return None

    __table_args__ = (
        CheckConstraint(
            "geocode_method IS NULL OR geocode_method IN ('gps','ner_geocoded','manual')",
            name="ck_reports_geocode_method",
        ),
        CheckConstraint(
            "event_category IS NULL OR event_category IN "
            "('rainfall','thunderstorm','flooding','heatwave','fog','dust_storm','strong_wind','dust storm','strong wind')",
            name="ck_reports_event_category",
        ),
        CheckConstraint(
            "status IN ('pending','verified','rejected','under_review')",
            name="ck_reports_status",
        ),
        UniqueConstraint(
            "source_id", "source_native_id",
            name="uq_reports_source_native_id",
        ),
        Index("ix_reports_status_category_reported", "status", "event_category", "reported_at"),
        Index("ix_reports_location", "location", postgresql_using="gist"),
        Index("ix_reports_duplicate_cluster_id", "duplicate_cluster_id"),
    )


class MediaItem(Base):
    __tablename__ = "media_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    storage_url: Mapped[str] = mapped_column(String(500), nullable=False)
    perceptual_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True,
    )
    keyframe_hashes = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    report: Mapped["Report"] = relationship(back_populates="media_items")

    __table_args__ = (
        CheckConstraint(
            "media_type IN ('image','video')",
            name="ck_media_items_media_type",
        ),
        Index("ix_media_items_report_id", "report_id"),
    )


class DuplicateCluster(Base):
    __tablename__ = "duplicate_clusters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    representative_report_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reports.id", use_alter=True, name="fk_dup_clusters_rep_report"),
        nullable=True,
    )
    member_count: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    representative_report: Mapped["Report | None"] = relationship(
        foreign_keys=[representative_report_id],
    )
    members: Mapped[list["Report"]] = relationship(
        back_populates="duplicate_cluster",
        foreign_keys=[Report.duplicate_cluster_id],
    )


class DeadLetterReport(Base):
    """Malformed ingestion payloads that failed validation — stored for
    inspection rather than silently dropped."""

    __tablename__ = "dead_letter_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    source_platform: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )
    raw_payload = mapped_column(JSONB, nullable=False)
    error_detail: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


# Alias to support both DeadLetterReport and DeadLetterReports
DeadLetterReports = DeadLetterReport

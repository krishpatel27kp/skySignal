"""
Source and CitizenSession models.

``Source`` tracks each distinct originator of reports (social media account,
news outlet, citizen-app channel) so credibility is per-source over time.

``CitizenSession`` associates citizen reports via a device ID without
requiring account creation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    platform: Mapped[str] = mapped_column(
        String(30), nullable=False,
    )
    handle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trust_score: Mapped[float] = mapped_column(
        Float, default=0.5, server_default="0.5",
    )
    total_reports: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0",
    )
    verified_reports: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    reports: Mapped[list["Report"]] = relationship(  # noqa: F821
        back_populates="source", lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "platform IN ('twitter','citizen_app','news','youtube','imd_official')",
            name="ck_sources_platform",
        ),
        UniqueConstraint("platform", "handle", name="uq_sources_platform_handle"),
    )


class CitizenSession(Base):
    __tablename__ = "citizen_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    device_id: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True,
    )
    preferred_language: Mapped[str] = mapped_column(
        String(10), default="en", server_default="en",
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    reports: Mapped[list["Report"]] = relationship(  # noqa: F821
        back_populates="citizen_session", lazy="selectin",
    )

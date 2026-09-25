"""
AdminUser and AuditLog models.

``AdminUser`` holds IMD analyst / admin accounts.
``AuditLog`` records every verification / administrative action.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), default="analyst", server_default="analyst",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    audit_entries: Mapped[list["AuditLog"]] = relationship(
        back_populates="admin_user", lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('analyst','senior_admin')",
            name="ck_admin_users_role",
        ),
    )


class AuditLog(Base):
    """Records every verification / administrative action for accountability."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    target_type: Mapped[str] = mapped_column(String(10), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    details = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    admin_user: Mapped["AdminUser"] = relationship(
        back_populates="audit_entries",
    )

    __table_args__ = (
        CheckConstraint(
            "action IN ('verify_report','reject_report','verify_event',"
            "'reject_event','merge_event','escalate_event','merge_cluster','bulk_action')",
            name="ck_audit_log_action",
        ),
        CheckConstraint(
            "target_type IN ('report','event','cluster')",
            name="ck_audit_log_target_type",
        ),
        Index("ix_audit_log_target", "target_type", "target_id"),
        Index("ix_audit_log_admin_created", "admin_user_id", "created_at"),
    )

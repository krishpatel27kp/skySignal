"""Initial schema — all 12 tables with PostGIS and pgcrypto extensions.

Revision ID: 0001
Revises: None
Create Date: 2026-09-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extensions ───────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # ── 1. sources ───────────────────────────────────────────────
    op.create_table(
        "sources",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("platform", sa.String(30), nullable=False),
        sa.Column("handle", sa.String(255), nullable=True),
        sa.Column("trust_score", sa.Float, server_default="0.5", nullable=False),
        sa.Column("total_reports", sa.Integer, server_default="0", nullable=False),
        sa.Column("verified_reports", sa.Integer, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "platform IN ('twitter','citizen_app','news','youtube','imd_official')",
            name="ck_sources_platform",
        ),
        sa.UniqueConstraint("platform", "handle", name="uq_sources_platform_handle"),
    )

    # ── 2. citizen_sessions ──────────────────────────────────────
    op.create_table(
        "citizen_sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("device_id", sa.String(255), nullable=False, unique=True),
        sa.Column("preferred_language", sa.String(10), server_default="en", nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 3. admin_users ───────────────────────────────────────────
    op.create_table(
        "admin_users",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), server_default="analyst", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('analyst','senior_admin')", name="ck_admin_users_role"),
    )

    # ── 4. duplicate_clusters (created before reports; circular FK added later) ──
    op.create_table(
        "duplicate_clusters",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("representative_report_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("member_count", sa.Integer, server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 5. reports ───────────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("source_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("citizen_session_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("citizen_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_native_id", sa.String(255), nullable=True),
        sa.Column("duplicate_cluster_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("duplicate_clusters.id", ondelete="SET NULL"), nullable=True),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("clean_text", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("location", Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True),
        sa.Column("raw_location_text", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("region", sa.String(30), nullable=True),
        sa.Column("geocode_confidence", sa.Float, nullable=True),
        sa.Column("geocode_method", sa.String(20), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("event_category", sa.String(30), nullable=True),
        sa.Column("category_confidence", sa.Float, nullable=True),
        sa.Column("p_misleading", sa.Float, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "geocode_method IS NULL OR geocode_method IN ('gps','ner_geocoded','manual')",
            name="ck_reports_geocode_method",
        ),
        sa.CheckConstraint(
            "event_category IS NULL OR event_category IN "
            "('rainfall','thunderstorm','flooding','heatwave','fog','dust_storm','strong_wind')",
            name="ck_reports_event_category",
        ),
        sa.CheckConstraint(
            "status IN ('pending','verified','rejected','under_review')",
            name="ck_reports_status",
        ),
        sa.UniqueConstraint("source_id", "source_native_id", name="uq_reports_source_native_id"),
    )

    # Indexes for reports
    op.create_index("ix_reports_status_category_reported", "reports", ["status", "event_category", "reported_at"])
    op.create_index("ix_reports_location", "reports", ["location"], postgresql_using="gist")
    op.create_index("ix_reports_duplicate_cluster_id", "reports", ["duplicate_cluster_id"])

    # ── Circular FK: duplicate_clusters.representative_report_id → reports.id
    op.create_foreign_key(
        "fk_dup_clusters_rep_report",
        "duplicate_clusters", "reports",
        ["representative_report_id"], ["id"],
    )

    # ── 6. media_items ───────────────────────────────────────────
    op.create_table(
        "media_items",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("report_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("media_type", sa.String(10), nullable=False),
        sa.Column("storage_url", sa.String(500), nullable=False),
        sa.Column("perceptual_hash", sa.String(64), nullable=True),
        sa.Column("keyframe_hashes", sa.dialects.postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("media_type IN ('image','video')", name="ck_media_items_media_type"),
    )
    op.create_index("ix_media_items_report_id", "media_items", ["report_id"])

    # ── 7. events ────────────────────────────────────────────────
    op.create_table(
        "events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("centroid", Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("region", sa.String(30), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("lifecycle_status", sa.String(20), nullable=False),
        sa.Column("has_contradiction", sa.Boolean, server_default="false", nullable=False),
        sa.Column("independent_source_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "category IN ('rainfall','thunderstorm','flooding','heatwave','fog','dust_storm','strong_wind')",
            name="ck_events_category",
        ),
        sa.CheckConstraint(
            "severity IN ('low','moderate','high','critical')",
            name="ck_events_severity",
        ),
        sa.CheckConstraint(
            "lifecycle_status IN ('detected','emerging','confirmed','active','declining','resolved')",
            name="ck_events_lifecycle_status",
        ),
    )
    op.create_index("ix_events_lifecycle_category_detected", "events", ["lifecycle_status", "category", "detected_at"])
    op.create_index("ix_events_centroid", "events", ["centroid"], postgresql_using="gist")
    op.create_index("ix_events_severity", "events", ["severity"])
    op.create_index("ix_events_region", "events", ["region"])

    # ── 8. event_report_map ──────────────────────────────────────
    op.create_table(
        "event_report_map",
        sa.Column("event_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("report_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 9. event_lifecycle_log ───────────────────────────────────
    op.create_table(
        "event_lifecycle_log",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("event_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(20), nullable=True),
        sa.Column("to_status", sa.String(20), nullable=False),
        sa.Column("transitioned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("trigger_reason", sa.String(255), nullable=True),
    )

    # ── 10. sensor_readings ──────────────────────────────────────
    op.create_table(
        "sensor_readings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("station_id", sa.String(50), nullable=False),
        sa.Column("location", Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("rainfall_mm", sa.Float, nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("corroborates_event_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sensor_readings_location", "sensor_readings", ["location"], postgresql_using="gist")
    op.create_index("ix_sensor_readings_station_recorded", "sensor_readings", ["station_id", "recorded_at"])

    # ── 11. audit_log ────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("admin_user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("target_type", sa.String(10), nullable=False),
        sa.Column("target_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("details", sa.dialects.postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "action IN ('verify_report','reject_report','verify_event','reject_event','merge_event','escalate_event')",
            name="ck_audit_log_action",
        ),
        sa.CheckConstraint("target_type IN ('report','event')", name="ck_audit_log_target_type"),
    )
    op.create_index("ix_audit_log_target", "audit_log", ["target_type", "target_id"])
    op.create_index("ix_audit_log_admin_created", "audit_log", ["admin_user_id", "created_at"])

    # ── 12. dead_letter_reports ──────────────────────────────────
    op.create_table(
        "dead_letter_reports",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("source_platform", sa.String(30), nullable=True),
        sa.Column("raw_payload", sa.dialects.postgresql.JSONB, nullable=False),
        sa.Column("error_detail", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("dead_letter_reports")
    op.drop_table("audit_log")
    op.drop_table("sensor_readings")
    op.drop_table("event_lifecycle_log")
    op.drop_table("event_report_map")
    op.drop_table("events")
    op.drop_table("media_items")
    # Drop circular FK before dropping tables
    op.drop_constraint("fk_dup_clusters_rep_report", "duplicate_clusters", type_="foreignkey")
    op.drop_table("reports")
    op.drop_table("duplicate_clusters")
    op.drop_table("admin_users")
    op.drop_table("citizen_sessions")
    op.drop_table("sources")
    op.execute("DROP EXTENSION IF EXISTS pgcrypto;")
    op.execute("DROP EXTENSION IF EXISTS postgis;")

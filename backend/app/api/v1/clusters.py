"""
Duplicate Clusters Endpoints.

Provides administrative routes for reviewing and merging duplicate clusters:
- ``POST /v1/duplicate-clusters/{cluster_id}/merge``: Confirm and merge a duplicate cluster
- ``GET /v1/duplicate-clusters/{cluster_id}``: Retrieve cluster details and members
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin, get_db
from app.core.errors import AppError
from app.models.admin import AdminUser, AuditLog
from app.models.report import DuplicateCluster, Report

clusters_router = APIRouter(
    prefix="/duplicate-clusters",
    tags=["duplicate_clusters"],
    dependencies=[Depends(get_current_admin)],
)


class MergeClusterRequest(BaseModel):
    primary_report_id: Optional[uuid.UUID] = None
    note: Optional[str] = None


@clusters_router.post(
    "/{cluster_id}/merge",
    summary="Confirm & merge duplicate cluster (Admin only)",
    description="Merges all reports within a duplicate cluster into a verified consolidated group.",
)
async def merge_duplicate_cluster(
    cluster_id: uuid.UUID,
    payload: Optional[MergeClusterRequest] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Merge duplicate cluster reports into a unified cluster state.
    Strictly restricted to authenticated analysts or senior admins.
    """
    stmt = (
        select(DuplicateCluster)
        .options(selectinload(DuplicateCluster.members))
        .where(DuplicateCluster.id == cluster_id)
    )
    cluster = (await db.scalars(stmt)).first()
    if not cluster:
        raise AppError(
            status_code=404,
            code="not_found",
            message="Duplicate cluster not found",
        )

    # Set representative report if provided
    if payload and payload.primary_report_id:
        cluster.representative_report_id = payload.primary_report_id

    # Mark member reports as verified / linked
    for report in cluster.members:
        if report.status == "pending":
            report.status = "verified"

    # Record administrative action in AuditLog
    details = {
        "member_count": cluster.member_count,
        "representative_report_id": str(cluster.representative_report_id)
        if cluster.representative_report_id
        else None,
    }
    if payload and payload.note:
        details["note"] = payload.note

    audit = AuditLog(
        admin_user_id=admin.id,
        action="merge_event",  # Matches ck_audit_log_action constraint
        target_type="report",
        target_id=cluster.representative_report_id or cluster.id,
        details=details,
    )
    db.add(audit)
    await db.commit()

    return {
        "id": str(cluster.id),
        "merged": True,
        "member_count": cluster.member_count,
        "representative_report_id": str(cluster.representative_report_id)
        if cluster.representative_report_id
        else None,
    }


@clusters_router.get(
    "/{cluster_id}",
    summary="Get duplicate cluster details (Admin only)",
)
async def get_duplicate_cluster(
    cluster_id: uuid.UUID,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Fetch details and member reports for a duplicate cluster."""
    stmt = (
        select(DuplicateCluster)
        .options(selectinload(DuplicateCluster.members).selectinload(Report.source))
        .where(DuplicateCluster.id == cluster_id)
    )
    cluster = (await db.scalars(stmt)).first()
    if not cluster:
        raise AppError(
            status_code=404,
            code="not_found",
            message="Duplicate cluster not found",
        )

    return {
        "id": str(cluster.id),
        "representative_report_id": str(cluster.representative_report_id)
        if cluster.representative_report_id
        else None,
        "member_count": cluster.member_count,
        "members": [
            {
                "id": str(r.id),
                "clean_text": r.clean_text,
                "city": r.city,
                "state": r.state,
                "source_platform": r.source_platform,
                "status": r.status,
                "reported_at": r.reported_at,
            }
            for r in cluster.members
        ],
    }

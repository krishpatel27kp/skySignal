from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.admin import AdminUser, AuditLog
from app.api.deps import get_current_admin
from app.schemas.common import PaginatedResponse

audit_router = APIRouter(
    prefix="/audit-log",
    tags=["audit"],
    dependencies=[Depends(get_current_admin)],
)

@audit_router.get("")
@audit_router.get("/")
async def get_audit_log(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated list of audit logs."""
    stmt = select(AuditLog).options(joinedload(AuditLog.admin_user)).order_by(AuditLog.created_at.desc())
    
    # Count total
    count_stmt = select(func.count()).select_from(AuditLog)
    total = (await db.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.limit(limit).offset(offset)
    result = await db.scalars(stmt)
    items = result.all()
    
    # Map to expected frontend format, extracting email
    formatted_items = []
    for log in items:
        formatted_items.append({
            "id": str(log.id),
            "admin_email": log.admin_user.email if log.admin_user else "unknown",
            "action": log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id),
            "details": log.details,
            "created_at": log.created_at
        })
        
    return {"results": formatted_items, "total": total, "limit": limit, "offset": offset}

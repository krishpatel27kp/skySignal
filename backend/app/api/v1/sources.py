from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_admin
from app.models.admin import AdminUser
from app.models.source import Source
from pydantic import BaseModel

sources_router = APIRouter(prefix="/sources", tags=["Sources"])

class SourceResponse(BaseModel):
    id: uuid.UUID
    platform: str
    handle: str | None = None
    trust_score: float
    total_reports: int
    verified_reports: int
    created_at: datetime

    class Config:
        from_attributes = True

@sources_router.get(
    "",
    response_model=list[SourceResponse],
    summary="List all data sources (Admin)",
)
async def list_sources(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Source).order_by(Source.trust_score.desc())
    result = await db.scalars(stmt)
    return result.all()

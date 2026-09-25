from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field, model_validator


class MediaItemResponse(BaseModel):
    type: str = Field(alias="media_type")
    url: str = Field(alias="storage_url")

    class Config:
        populate_by_name = True
        from_attributes = True


class ReportResponse(BaseModel):
    id: uuid.UUID
    source_platform: str
    source_handle: Optional[str] = None
    raw_text: Optional[str] = None
    media: list[MediaItemResponse] = Field(default_factory=list)
    lat: Optional[float] = None
    lon: Optional[float] = None
    city: Optional[str] = None
    state: Optional[str] = None
    event_category: Optional[str] = None
    category_confidence: Optional[float] = None
    p_misleading: Optional[float] = None
    duplicate_cluster_id: Optional[uuid.UUID] = None
    status: str
    reported_at: datetime

    class Config:
        from_attributes = True


class DuplicateClusterResponse(BaseModel):
    id: uuid.UUID
    member_count: int
    members: list[ReportResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ReportDetailResponse(ReportResponse):
    duplicate_cluster: Optional[DuplicateClusterResponse] = None

    class Config:
        from_attributes = True

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict, Field, model_validator, AliasChoices

from app.schemas.reports import ReportResponse

def time_ago(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    
    if seconds < 60:
        return "just now"
    elif seconds < 3600:
        mins = seconds // 60
        return f"{mins} min ago"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    else:
        days = seconds // 86400
        return f"{days} day{'s' if days > 1 else ''} ago"

class EventResponse(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    city: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None
    severity: Optional[str] = None
    confidence: float
    lifecycle_status: str
    has_contradiction: bool
    reports: int = Field(validation_alias=AliasChoices("reports", "independent_source_count"))
    detected_at: datetime
    last_updated_at: datetime
    resolved_at: Optional[datetime] = None

    # Computed fields for frontend
    name: str = Field(default="")
    type: str = Field(default="")
    place: str = Field(default="")
    status: str = Field(default="")
    time: str = Field(default="")

    @model_validator(mode="before")
    def compute_frontend_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # Dict processing
            title = values.get("title", "")
            category = values.get("category", "")
            city = values.get("city")
            state = values.get("state")
            lifecycle = values.get("lifecycle_status", "")
            updated_at = values.get("last_updated_at")
            
            values["name"] = title
            values["type"] = category.replace("_", " ").title() if category else ""
            place_parts = [p for p in (city, state) if p]
            values["place"] = ", ".join(place_parts) if place_parts else "Unknown Location"
            values["status"] = lifecycle.title() if lifecycle else ""
            if updated_at:
                values["time"] = time_ago(updated_at)
        else:
            # ORM Model processing
            values.name = values.title
            values.type = values.category.replace("_", " ").title() if values.category else ""
            place_parts = [p for p in (values.city, values.state) if p]
            values.place = ", ".join(place_parts) if place_parts else "Unknown Location"
            values.status = values.lifecycle_status.title() if values.lifecycle_status else ""

            if values.last_updated_at:
                values.time = time_ago(values.last_updated_at)
        
        return values

    class Config:
        from_attributes = True

class LifecycleTransitionSchema(BaseModel):
    to_status: str
    transitioned_at: datetime

    class Config:
        from_attributes = True

class OfficialSensorEvidence(BaseModel):
    present: bool
    station_id: Optional[str] = None
    rainfall_mm: Optional[float] = None

class EventEvidenceSchema(BaseModel):
    official_sensor: OfficialSensorEvidence
    independent_reports: int = 0
    unique_photos: int = 0
    duplicate_reports_merged: int = 0
    news_articles: int = 0

class EventDetailResponse(EventResponse):
    evidence: Optional[EventEvidenceSchema] = None
    lifecycle_history: Optional[list[LifecycleTransitionSchema]] = None
    reports: Any = None # Can be int (for public) or list of reports (for admin)

    class Config:
        from_attributes = True

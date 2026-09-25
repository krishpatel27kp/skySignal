from __future__ import annotations

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.admin import AdminUser
from app.models.event import Event
from app.models.report import Report
from app.models.source import Source
from app.api.deps import get_current_admin

analytics_router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_admin)],
)

@analytics_router.get("/overview")
async def get_overview(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate metrics for the dashboard top cards (Admin only)."""
    
    # Active Events
    active_events_stmt = select(func.count()).select_from(Event).where(Event.lifecycle_status == "active")
    active_events = (await db.execute(active_events_stmt)).scalar() or 0
    
    # Critical/High Events
    critical_events_stmt = select(func.count()).select_from(Event).where(
        Event.lifecycle_status == "active",
        Event.severity.in_(["high", "critical"])
    )
    critical_events = (await db.execute(critical_events_stmt)).scalar() or 0
    
    # Total Reports
    total_reports_stmt = select(func.count()).select_from(Report)
    total_reports = (await db.execute(total_reports_stmt)).scalar() or 0
    
    # Pending Reports
    pending_reports_stmt = select(func.count()).select_from(Report).where(
        Report.status.in_(["pending", "under_review"])
    )
    pending_reports = (await db.execute(pending_reports_stmt)).scalar() or 0

    return {
        "active_events": active_events,
        "critical_high_events": critical_events,
        "total_reports": total_reports,
        "pending_reports": pending_reports
    }

@analytics_router.get("/timeseries")
async def get_timeseries(
    granularity: str = Query("day", pattern="^(hour|day|week)$"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return report/event counts bucketed by time (Admin only)."""
    # Using PostgreSQL date_trunc for bucketing
    date_func = func.date_trunc(granularity, Report.ingested_at)
    
    # Reports grouping
    reports_stmt = select(
        date_func.label("date"),
        func.count(Report.id).label("count")
    ).group_by(date_func).order_by(date_func)
    
    reports_res = await db.execute(reports_stmt)
    report_data = {str(r.date): r.count for r in reports_res.all() if r.date}
    
    # Events grouping
    event_date_func = func.date_trunc(granularity, Event.detected_at)
    events_stmt = select(
        event_date_func.label("date"),
        func.count(Event.id).label("count")
    ).group_by(event_date_func).order_by(event_date_func)
    
    events_res = await db.execute(events_stmt)
    event_data = {str(r.date): r.count for r in events_res.all() if r.date}
    
    # Merge keys
    all_dates = sorted(list(set(report_data.keys()) | set(event_data.keys())))
    
    series = []
    for d in all_dates:
        series.append({
            "date": d,
            "reports": report_data.get(d, 0),
            "events": event_data.get(d, 0)
        })
        
    return {"series": series}

@analytics_router.get("/by-category")
async def get_by_category(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Event distribution by category (Admin only)."""
    stmt = select(
        Event.category.label("category"),
        func.count(Event.id).label("count")
    ).group_by(Event.category)
    
    res = await db.execute(stmt)
    categories = [{"category": r.category, "count": r.count} for r in res.all()]
    
    return {"categories": categories}

@analytics_router.get("/source-reliability")
async def get_source_reliability(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return sources and their verified rates (Admin only)."""
    stmt = select(
        Source.handle,
        Source.platform,
        Source.total_reports,
        Source.verified_reports,
        Source.trust_score
    ).order_by(Source.trust_score.desc()).limit(20)
    
    res = await db.execute(stmt)
    sources = []
    for r in res.all():
        score = float(r.trust_score or 0.0)
        pct = score * 100.0 if score <= 1.0 else score
        trust_tier = "low"
        if pct >= 80:
            trust_tier = "high"
        elif pct >= 50:
            trust_tier = "medium"
            
        sources.append({
            "handle": r.handle or r.platform,
            "platform": r.platform,
            "total_reports": r.total_reports or 0,
            "verified_reports": r.verified_reports or 0,
            "verified_rate": round(pct / 100.0, 2),
            "trust_tier": trust_tier
        })
        
    return {"sources": sources}

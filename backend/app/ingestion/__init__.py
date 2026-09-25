"""
Per-source ingestion adapters (citizen_app, twitter, news_rss, imd_data, youtube)
and the central pipeline validation/persistence gate.
"""

from app.ingestion import citizen_app, imd_data, news_rss, pipeline, twitter, youtube
from app.ingestion.pipeline import ingest_report

__all__ = [
    "citizen_app",
    "twitter",
    "news_rss",
    "imd_data",
    "youtube",
    "pipeline",
    "ingest_report",
]

"""
Celery application configuration.

Workers are started with:
    celery -A app.workers.celery_app worker --loglevel=info

Task modules are auto-discovered from ``app.workers.tasks``.
"""

from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "skygrid",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,  # fair scheduling for pipeline workers
    beat_schedule={
        "evaluate-event-decays-every-5-minutes": {
            "task": "evaluate_event_decays",
            "schedule": 300.0,
        },
    },
)

# Auto-discover tasks in app/workers/tasks.py (added in later sections)
celery_app.autodiscover_tasks(["app.workers"])

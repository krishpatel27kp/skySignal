"""
Celery task definitions and pipeline chain.

Tasks wrap the async worker functions (dedup, classify, trust) in
synchronous Celery tasks, managing their own database sessions.

Chain order:
    dedup_report → classify_report → score_trust → enqueue_fusion

Each task receives a ``report_id`` string and returns it for the next
step in the chain.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from celery import chain

from app.workers.celery_app import celery_app

logger = logging.getLogger("skygrid.tasks")


def _run_async(coro: Any) -> Any:
    """
    Run an async coroutine from a synchronous Celery worker context.

    Creates a fresh event loop per invocation to avoid conflicts
    with the Celery worker's thread pool.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _get_session():
    """Create a one-shot async session for a Celery task."""
    from app.db.session import async_session, engine
    await engine.dispose(close=False)  # clear pool to avoid loop conflicts
    return async_session()


# ── Deduplication Task ───────────────────────────────────────────

@celery_app.task(name="dedup_report", bind=True, max_retries=3)
def dedup_report_task(self, report_id: str) -> str:
    """
    Celery task wrapper for the dedup worker.

    Scopes candidates to recent reports within the same city/state,
    computes text (TF-IDF cosine) and image (Hamming distance) similarity,
    and clusters duplicates via Union-Find.
    """
    async def _run() -> str:
        from app.workers.dedup import dedup_report
        async with await _get_session() as db:
            try:
                result = await dedup_report(report_id, db)
                await db.commit()
                return result
            except Exception:
                await db.rollback()
                raise

    try:
        return _run_async(_run())
    except Exception as exc:
        logger.error("dedup_report failed for %s: %s", report_id, exc)
        raise self.retry(exc=exc, countdown=10)


# ── Classification Task ─────────────────────────────────────────

@celery_app.task(name="classify_report", bind=True, max_retries=3)
def classify_report_task(self, report_id: str) -> str:
    """
    Celery task wrapper for the classification worker.

    Two-pass classifier: rule-based regex (Hindi+English) with 0.95
    confidence, then scikit-learn TF-IDF + SGD ML fallback.
    Low confidence (< 0.60) triggers 'under_review' status.
    """
    async def _run() -> str:
        from app.workers.classification import classify_report
        async with await _get_session() as db:
            try:
                result = await classify_report(report_id, db)
                await db.commit()
                return result
            except Exception:
                await db.rollback()
                raise

    try:
        return _run_async(_run())
    except Exception as exc:
        logger.error("classify_report failed for %s: %s", report_id, exc)
        raise self.retry(exc=exc, countdown=10)


# ── Trust Scoring Task ───────────────────────────────────────────

@celery_app.task(name="score_trust", bind=True, max_retries=3)
def score_trust_task(self, report_id: str) -> str:
    """
    Celery task wrapper for the trust scoring worker.

    Computes p_misleading from source trust, media presence,
    text quality, and corroboration using a calibrated logistic function.
    """
    async def _run() -> str:
        from app.workers.trust import score_trust
        async with await _get_session() as db:
            try:
                result = await score_trust(report_id, db)
                await db.commit()
                return result
            except Exception:
                await db.rollback()
                raise

    try:
        return _run_async(_run())
    except Exception as exc:
        logger.error("score_trust failed for %s: %s", report_id, exc)
        raise self.retry(exc=exc, countdown=10)


# ── Fusion Enqueue Hook ─────────────────────────────────────────

@celery_app.task(name="process_event_fusion", bind=True, max_retries=3)
def process_event_fusion_task(self, report_id: str) -> str:
    """
    Executes clustering, confidence, contradiction, and lifecycle evaluation.
    """
    async def _run() -> str:
        from app.fusion import fuse_report
        async with await _get_session() as db:
            try:
                result = await fuse_report(report_id, db)
                await db.commit()
                return result
            except Exception:
                await db.rollback()
                raise

    try:
        return _run_async(_run())
    except Exception as exc:
        logger.error("process_event_fusion failed for %s: %s", report_id, exc)
        raise self.retry(exc=exc, countdown=10)


@celery_app.task(name="evaluate_event_decays")
def evaluate_event_decays_task() -> None:
    """
    Scheduled Celery task running periodically to evaluate time-based decays.
    """
    async def _run() -> None:
        from app.fusion.lifecycle import evaluate_time_based_decays
        async with await _get_session() as db:
            try:
                await evaluate_time_based_decays(db)
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    try:
        _run_async(_run())
    except Exception as exc:
        logger.error("evaluate_event_decays failed: %s", exc)

# ── Pipeline Chain ───────────────────────────────────────────────

def build_processing_chain(report_id: str) -> chain:
    """
    Build the chained Celery pipeline for a newly ingested report:

        dedup → classify → score_trust → enqueue_fusion

    Returns a Celery chain signature ready to be applied or delayed.
    """
    return chain(
        dedup_report_task.s(report_id),
        classify_report_task.s(),
        score_trust_task.s(),
        process_event_fusion_task.s(),
    )


def process_report(report_id: str) -> Any:
    """
    Convenience function: build and dispatch the full processing chain.

    Returns the AsyncResult of the chain.
    """
    return build_processing_chain(report_id).apply_async()

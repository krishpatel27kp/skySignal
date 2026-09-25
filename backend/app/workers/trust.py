"""
Trust scoring worker.

Computes ``p_misleading`` (0.0 to 1.0) using an engineered feature vector
evaluated through a calibrated logistic function:

    Features:
    • ``source_trust_score``  — from the ``sources`` table (0.0–1.0)
    • ``has_media``           — boolean (images/videos attached)
    • ``text_length``         — character count of clean_text
    • ``punctuation_ratio``   — fraction of punctuation characters
    • ``corroboration_proxy`` — ``member_count`` from duplicate_clusters

The logistic function maps the weighted feature vector to a probability
that the report is misleading. High-trust sources with media and
corroboration yield low p_misleading; anonymous text-only reports
with excessive punctuation score higher.
"""

from __future__ import annotations

import logging
import math
import string
import uuid
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import DuplicateCluster, Report
from app.models.source import Source

logger = logging.getLogger("skygrid.trust")

# ── Feature Weights (tuned heuristically) ────────────────────────
# Negative weights → reduce p_misleading (trusted signals).
# Positive weights → increase p_misleading (suspicious signals).
WEIGHTS: dict[str, float] = {
    "source_trust_score": -2.5,    # trusted source → less misleading
    "has_media": -1.2,             # media attached → less misleading
    "text_length_norm": -0.3,      # longer text → slightly less misleading
    "punctuation_ratio": 1.8,      # excessive punctuation → more misleading
    "corroboration_proxy": -1.5,   # corroborated by duplicates → less misleading
}
BIAS = 0.5  # baseline logit


def _compute_features(
    source_trust: float,
    has_media: bool,
    text: str | None,
    member_count: int,
) -> dict[str, float]:
    """
    Build the feature vector from report attributes.

    Returns
    -------
    dict[str, float]
        Named features ready for the logistic scorer.
    """
    clean = text or ""
    text_len = len(clean)
    punct_count = sum(1 for c in clean if c in string.punctuation)
    punct_ratio = punct_count / max(text_len, 1)

    return {
        "source_trust_score": source_trust,
        "has_media": 1.0 if has_media else 0.0,
        "text_length_norm": min(text_len / 500.0, 1.0),  # normalise to [0, 1]
        "punctuation_ratio": punct_ratio,
        "corroboration_proxy": min(member_count / 5.0, 1.0),  # cap at 5 corroborations
    }


def compute_p_misleading(
    source_trust: float,
    has_media: bool,
    text: str | None,
    member_count: int,
) -> float:
    """
    Compute p_misleading via a calibrated logistic function.

    Parameters
    ----------
    source_trust : float
        Trust score of the source (0.0–1.0).
    has_media : bool
        Whether the report has attached media.
    text : str | None
        Cleaned report text.
    member_count : int
        Number of corroborating reports in the duplicate cluster.

    Returns
    -------
    float
        Probability that the report is misleading (0.0–1.0).
    """
    features = _compute_features(source_trust, has_media, text, member_count)

    # Compute logit: bias + Σ(w_i × x_i)
    logit = BIAS
    for name, weight in WEIGHTS.items():
        logit += weight * features.get(name, 0.0)

    # Sigmoid activation
    p = 1.0 / (1.0 + math.exp(-logit))
    return round(p, 4)


# ── Main Worker Function ─────────────────────────────────────────

async def score_trust(
    report_id: str,
    db: AsyncSession,
) -> str:
    """
    Score the given report's p_misleading.

    Reads the source's trust_score, checks for media items, reads the
    duplicate cluster's member_count, and computes p_misleading using
    the calibrated logistic function.

    Writes ``reports.p_misleading``.

    Parameters
    ----------
    report_id : str
        UUID of the report to score.
    db : AsyncSession
        Active database session.

    Returns
    -------
    str
        The same report_id (for Celery chaining).
    """
    rid = uuid.UUID(report_id)
    report = await db.get(Report, rid)

    if not report:
        logger.warning("score_trust: report %s not found", report_id)
        return report_id

    # Fetch source trust_score
    source = await db.get(Source, report.source_id)
    source_trust = source.trust_score if source else 0.5

    # Check for media
    has_media = bool(report.media_items)

    # Fetch corroboration from duplicate cluster
    member_count = 1
    if report.duplicate_cluster_id:
        cluster = await db.get(DuplicateCluster, report.duplicate_cluster_id)
        if cluster:
            member_count = cluster.member_count

    p = compute_p_misleading(
        source_trust=source_trust,
        has_media=has_media,
        text=report.clean_text or report.raw_text,
        member_count=member_count,
    )

    await db.execute(
        update(Report).where(Report.id == rid).values(p_misleading=p)
    )

    logger.info("Trust scored report %s → p_misleading=%.4f", report_id, p)

    return report_id

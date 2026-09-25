"""
Deduplication worker.

Scopes candidate comparisons to recent reports (within the last 12 hours
and within the same city/state). Clusters near-duplicates using:

  • **Text:** TF-IDF cosine similarity (scikit-learn); threshold ≥ 0.85.
    NOTE: This is a prototype pairwise O(n²) implementation.
    Production version should use MinHash + LSH (Locality-Sensitive Hashing)
    to bucket similar content before comparison, bringing complexity down to
    near-linear for large national-scale ingestion.

  • **Image:** Hamming distance between 64-bit perceptual hashes; threshold ≤ 5.

  • **Clustering:** Transitive grouping via Union-Find. Updates or creates
    ``duplicate_clusters``, sets ``representative_report_id`` to the earliest
    report, and assigns ``reports.duplicate_cluster_id``.

Non-representative reports in a duplicate cluster inherit classifications
from the representative to avoid redundant ML execution.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.report import DuplicateCluster, MediaItem, Report

logger = logging.getLogger("skygrid.dedup")

# ── Configuration ────────────────────────────────────────────────
TEXT_SIM_THRESHOLD = 0.85
IMAGE_HAMMING_THRESHOLD = 5
LOOKBACK_HOURS = 12


# ── Union-Find ───────────────────────────────────────────────────

class UnionFind:
    """Disjoint-set (Union-Find) with path compression and union by rank."""

    def __init__(self) -> None:
        self._parent: dict[uuid.UUID, uuid.UUID] = {}
        self._rank: dict[uuid.UUID, int] = {}

    def find(self, x: uuid.UUID) -> uuid.UUID:
        if x not in self._parent:
            self._parent[x] = x
            self._rank[x] = 0
        while self._parent[x] != x:
            self._parent[x] = self._parent[self._parent[x]]  # path compression
            x = self._parent[x]
        return x

    def union(self, a: uuid.UUID, b: uuid.UUID) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self._rank[ra] < self._rank[rb]:
            ra, rb = rb, ra
        self._parent[rb] = ra
        if self._rank[ra] == self._rank[rb]:
            self._rank[ra] += 1

    def groups(self) -> dict[uuid.UUID, list[uuid.UUID]]:
        """Return root → [member_ids] mapping for all non-singleton groups."""
        from collections import defaultdict

        clusters: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
        for node in self._parent:
            clusters[self.find(node)].append(node)
        return {root: members for root, members in clusters.items() if len(members) > 1}


# ── Similarity Functions ────────────────────────────────────────

def compute_text_similarities(texts: list[str]) -> list[tuple[int, int, float]]:
    """
    Compute pairwise cosine similarity between all texts using TF-IDF.

    Returns list of (i, j, similarity) tuples where similarity ≥ TEXT_SIM_THRESHOLD.

    NOTE: This is a prototype pairwise O(n²) implementation.
    Production version should use MinHash + LSH to bucket similar content
    before comparison, reducing complexity to near-linear for national-scale ingestion.
    """
    if len(texts) < 2:
        return []

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words="english",
            sublinear_tf=True,
        )
        tfidf_matrix = vectorizer.fit_transform(texts)
        sim_matrix = cosine_similarity(tfidf_matrix)

        pairs: list[tuple[int, int, float]] = []
        for i in range(len(texts)):
            for j in range(i + 1, len(texts)):
                if sim_matrix[i, j] >= TEXT_SIM_THRESHOLD:
                    pairs.append((i, j, float(sim_matrix[i, j])))
        return pairs

    except ImportError:
        logger.warning("scikit-learn not available; text dedup skipped")
        return []


def compute_hamming_distance(hash_a: str, hash_b: str) -> int:
    """
    Compute Hamming distance between two hex-encoded perceptual hashes.

    Each hash is a 64-bit hex string (16 hex chars). Distance is the
    number of differing bits.
    """
    try:
        int_a = int(hash_a, 16)
        int_b = int(hash_b, 16)
        return bin(int_a ^ int_b).count("1")
    except (ValueError, TypeError):
        return 64  # max distance on error


def find_image_duplicates(
    media_map: dict[uuid.UUID, list[str]],
) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """
    Find report pairs with images whose Hamming distance ≤ IMAGE_HAMMING_THRESHOLD.

    Parameters
    ----------
    media_map : dict
        report_id → list of perceptual_hash strings

    Returns
    -------
    list of (report_id_a, report_id_b) pairs that are image-duplicates.
    """
    report_ids = list(media_map.keys())
    pairs: list[tuple[uuid.UUID, uuid.UUID]] = []

    for i in range(len(report_ids)):
        for j in range(i + 1, len(report_ids)):
            hashes_a = media_map[report_ids[i]]
            hashes_b = media_map[report_ids[j]]
            for ha in hashes_a:
                for hb in hashes_b:
                    if compute_hamming_distance(ha, hb) <= IMAGE_HAMMING_THRESHOLD:
                        pairs.append((report_ids[i], report_ids[j]))
                        break
                else:
                    continue
                break

    return pairs


# ── Main Dedup Logic ─────────────────────────────────────────────

async def dedup_report(
    report_id: str,
    db: AsyncSession,
) -> str:
    """
    Find and cluster duplicates for the given report.

    Scopes candidates to reports ingested within the last LOOKBACK_HOURS
    that share the same city or state. Runs text and image similarity,
    then clusters matches using Union-Find.

    Parameters
    ----------
    report_id : str
        UUID of the report to dedup against.
    db : AsyncSession
        Active database session.

    Returns
    -------
    str
        The same report_id (for Celery chaining).
    """
    rid = uuid.UUID(report_id)

    # Fetch the target report with media eagerly loaded
    stmt_target = (
        select(Report)
        .options(selectinload(Report.media_items))
        .where(Report.id == rid)
    )
    target = (await db.execute(stmt_target)).scalar_one_or_none()
    if not target:
        logger.warning("dedup_report: report %s not found", report_id)
        return report_id

    # Already clustered? Skip
    if target.duplicate_cluster_id:
        logger.debug("Report %s already in cluster, skipping dedup", report_id)
        return report_id

    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)

    # Build candidate query: same city/state, recent, not the same report
    conditions = [
        Report.id != rid,
        Report.ingested_at >= cutoff,
    ]
    if target.city:
        conditions.append(Report.city == target.city)
    elif target.state:
        conditions.append(Report.state == target.state)
    else:
        # No location — scope to all recent (small prototype assumption)
        pass

    stmt = (
        select(Report)
        .options(selectinload(Report.media_items))
        .where(*conditions)
        .limit(500)
    )
    candidates_result = await db.execute(stmt)
    candidates: list[Report] = list(candidates_result.scalars().all())

    if not candidates:
        return report_id

    # ── Text similarity ──────────────────────────────────────────
    all_reports = [target] + candidates
    texts = [r.clean_text or r.raw_text or "" for r in all_reports]

    uf = UnionFind()
    text_pairs = compute_text_similarities(texts)
    for i, j, _sim in text_pairs:
        uf.union(all_reports[i].id, all_reports[j].id)

    # ── Image similarity ─────────────────────────────────────────
    media_map: dict[uuid.UUID, list[str]] = {}
    for r in all_reports:
        hashes = [
            m.perceptual_hash
            for m in (r.media_items or [])
            if m.perceptual_hash
        ]
        if hashes:
            media_map[r.id] = hashes

    img_pairs = find_image_duplicates(media_map)
    for a, b in img_pairs:
        uf.union(a, b)

    # ── Persist clusters ─────────────────────────────────────────
    groups = uf.groups()

    # Only process groups containing the target report
    target_root = uf.find(rid)
    if target_root not in groups:
        return report_id

    member_ids = groups[target_root]

    # Find the earliest report in the cluster (representative)
    member_reports = [r for r in all_reports if r.id in member_ids]
    member_reports.sort(key=lambda r: r.ingested_at or datetime.min.replace(tzinfo=timezone.utc))
    representative = member_reports[0]

    # Check if representative already has a cluster
    existing_cluster_id = representative.duplicate_cluster_id

    if existing_cluster_id:
        cluster_id = existing_cluster_id
        # Update member count
        await db.execute(
            update(DuplicateCluster)
            .where(DuplicateCluster.id == cluster_id)
            .values(member_count=len(member_ids))
        )
    else:
        # Create new cluster
        cluster = DuplicateCluster(
            representative_report_id=representative.id,
            member_count=len(member_ids),
        )
        db.add(cluster)
        await db.flush()
        cluster_id = cluster.id

    # Assign all members to the cluster
    for mid in member_ids:
        await db.execute(
            update(Report)
            .where(Report.id == mid)
            .values(duplicate_cluster_id=cluster_id)
        )

    # Non-representative reports inherit classification from representative
    if representative.event_category:
        for mid in member_ids:
            if mid != representative.id:
                await db.execute(
                    update(Report)
                    .where(Report.id == mid)
                    .values(
                        event_category=representative.event_category,
                        category_confidence=representative.category_confidence,
                    )
                )

    logger.info(
        "Dedup: clustered %d reports under cluster %s (representative=%s)",
        len(member_ids),
        cluster_id,
        representative.id,
    )

    return report_id

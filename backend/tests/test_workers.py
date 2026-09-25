"""
Unit and integration tests for Section 5 — processing pipeline workers.

Covers:
1. Dedup: Union-Find clustering, text similarity, image Hamming distance.
2. Classification: keyword routing (Hindi + English), ML fallback, under_review flagging.
3. Trust: p_misleading scoring for various feature combinations.
4. Task chain wiring.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.pipeline import ingest_report
from app.models.report import DuplicateCluster, Report
from app.models.source import Source
from app.schemas.canonical import CanonicalReport
from app.workers.classification import Classifier, classify_report, classify_rule_based
from app.workers.dedup import (
    UnionFind,
    compute_hamming_distance,
    compute_text_similarities,
    dedup_report,
)
from app.workers.trust import compute_p_misleading, score_trust


# ═══════════════════════════════════════════════════════════════════
#  1. DEDUP TESTS
# ═══════════════════════════════════════════════════════════════════


class TestUnionFind:
    """Unit tests for the Union-Find data structure."""

    def test_union_find_singletons(self) -> None:
        uf = UnionFind()
        a, b = uuid.uuid4(), uuid.uuid4()
        uf.find(a)
        uf.find(b)
        assert uf.groups() == {}  # no groups until union

    def test_union_find_merges(self) -> None:
        uf = UnionFind()
        ids = [uuid.uuid4() for _ in range(4)]
        uf.union(ids[0], ids[1])
        uf.union(ids[2], ids[3])
        groups = uf.groups()
        assert len(groups) == 2

    def test_union_find_transitive(self) -> None:
        """A-B and B-C should form a single group {A, B, C}."""
        uf = UnionFind()
        a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        uf.union(a, b)
        uf.union(b, c)
        groups = uf.groups()
        assert len(groups) == 1
        members = list(groups.values())[0]
        assert set(members) == {a, b, c}


class TestTextSimilarity:
    """Unit tests for TF-IDF cosine text similarity."""

    def test_identical_texts_above_threshold(self) -> None:
        texts = [
            "Heavy rainfall lashing Mumbai since morning",
            "Heavy rainfall lashing Mumbai since morning",
        ]
        pairs = compute_text_similarities(texts)
        assert len(pairs) == 1
        assert pairs[0][2] >= 0.85  # similarity >= threshold

    def test_dissimilar_texts_no_pairs(self) -> None:
        texts = [
            "Heavy rainfall lashing Mumbai since morning",
            "Delhi airport fog delays flights visibility near zero",
        ]
        pairs = compute_text_similarities(texts)
        assert len(pairs) == 0

    def test_similar_texts_above_threshold(self) -> None:
        """Near-duplicate reports with minor word differences should match.
        A third dissimilar document is included so TF-IDF IDF is meaningful."""
        texts = [
            "Heavy rainfall causes severe waterlogging in Mumbai Western Express Highway flooding reported",
            "Heavy rainfall causes severe waterlogging in Mumbai Western Express Highway flooding update",
            "Delhi airport operations normal clear skies temperatures pleasant",
        ]
        pairs = compute_text_similarities(texts)
        # The first two should match; the third should not match either
        assert any(p[0] == 0 and p[1] == 1 for p in pairs)
        assert all(not (p[0] == 0 and p[1] == 2) for p in pairs)  # no match with dissimilar


class TestImageHamming:
    """Unit tests for perceptual hash Hamming distance."""

    def test_identical_hashes_distance_zero(self) -> None:
        h = "aabbccddeeff0011"
        assert compute_hamming_distance(h, h) == 0

    def test_close_hashes_within_threshold(self) -> None:
        """Two hashes differing by ≤5 bits should be flagged as duplicates."""
        # Differ by exactly 1 bit in the last hex char (1 → 0)
        h1 = "aabbccddeeff0011"
        h2 = "aabbccddeeff0010"
        dist = compute_hamming_distance(h1, h2)
        assert dist <= 5

    def test_distant_hashes_beyond_threshold(self) -> None:
        h1 = "0000000000000000"
        h2 = "ffffffffffffffff"
        dist = compute_hamming_distance(h1, h2)
        assert dist > 5


@pytest.mark.anyio
async def test_dedup_clusters_identical_reports(db: AsyncSession) -> None:
    """
    Two reports with identical text ingested within the dedup window
    should be grouped into a single duplicate_cluster with the earliest
    report as the representative.
    """
    unique_suffix = str(uuid.uuid4())[:8]
    text = f"Unique dedup test {unique_suffix} heavy flooding reported ring road area vehicles submerged"
    # Use a unique fake city so the dedup search scope doesn't pick up unrelated old data
    fake_city = f"TestCity-{unique_suffix}"

    # Ingest two nearly identical reports with unique native IDs
    canonical_1 = CanonicalReport(
        source_platform="news",
        source_handle="TOI",
        source_native_id=f"dedup-test-1-{unique_suffix}",
        raw_text=text,
        reported_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        city=fake_city,
        state="TestState",
    )
    canonical_2 = CanonicalReport(
        source_platform="news",
        source_handle="NDTV",
        source_native_id=f"dedup-test-2-{unique_suffix}",
        raw_text=text,
        reported_at=datetime.now(timezone.utc),
        city=fake_city,
        state="TestState",
    )

    with patch("app.ingestion.pipeline._publish_to_stream", new_callable=AsyncMock):
        _, r1 = await ingest_report(canonical_1, db)
        _, r2 = await ingest_report(canonical_2, db)

    assert r1.status == "created"
    assert r2.status == "created"

    # Run dedup on the second report (it should find the first)
    await dedup_report(r2.report_id, db)
    await db.commit()

    # Verify the second report is now in a cluster
    report2 = await db.get(Report, uuid.UUID(r2.report_id))
    assert report2 is not None
    assert report2.duplicate_cluster_id is not None

    cluster = await db.get(DuplicateCluster, report2.duplicate_cluster_id)
    assert cluster is not None
    assert cluster.member_count >= 2  # at least the two we ingested


# ═══════════════════════════════════════════════════════════════════
#  2. CLASSIFICATION TESTS
# ═══════════════════════════════════════════════════════════════════


class TestRuleBasedClassifier:
    """Unit tests for the regex/keyword rule-based classifier."""

    def test_english_rainfall(self) -> None:
        cat, conf = classify_rule_based("Heavy rain and monsoon downpour in Mumbai")
        assert cat == "rainfall"
        assert conf == 0.95

    def test_hindi_flooding(self) -> None:
        cat, conf = classify_rule_based("बाढ़ से लोगों को बहुत नुकसान हुआ जलभराव बढ़ गया")
        assert cat == "flooding"
        assert conf == 0.95

    def test_english_fog(self) -> None:
        cat, conf = classify_rule_based("Dense fog disrupts flights at Delhi airport visibility zero")
        assert cat == "fog"
        assert conf == 0.95

    def test_hindi_heatwave(self) -> None:
        cat, conf = classify_rule_based("भीषण गर्मी और लू चल रही है तापमान 47 डिग्री")
        assert cat == "heatwave"
        assert conf == 0.95

    def test_english_thunderstorm(self) -> None:
        cat, conf = classify_rule_based("Severe thunderstorm with lightning strikes reported")
        assert cat == "thunderstorm"
        assert conf == 0.95

    def test_english_cyclone_as_strong_wind(self) -> None:
        cat, conf = classify_rule_based("Cyclone approaching eastern coast with strong winds")
        assert cat == "strong_wind"
        assert conf == 0.95

    def test_english_dust_storm(self) -> None:
        cat, conf = classify_rule_based("Massive sandstorm engulfs western Rajasthan")
        assert cat == "dust_storm"
        assert conf == 0.95

    def test_unknown_text_returns_none(self) -> None:
        cat, conf = classify_rule_based("The stock market opened higher today")
        assert cat is None
        assert conf == 0.0


class TestUnifiedClassifier:
    """Tests for the unified Classifier interface (rule → ML fallback)."""

    def test_predict_uses_rules_first(self) -> None:
        cat, conf = Classifier.predict("Heavy rainfall lashing Mumbai")
        assert cat == "rainfall"
        assert conf == 0.95  # rule-based confidence

    def test_predict_ml_fallback_on_ambiguous_text(self) -> None:
        """Text that doesn't match any exact keyword should use ML fallback."""
        cat, conf = Classifier.predict(
            "The sky turned dark and water came from everywhere, villages are drowning"
        )
        assert cat is not None  # ML should produce something
        assert isinstance(conf, float)


@pytest.mark.anyio
async def test_classify_report_updates_db(db: AsyncSession) -> None:
    """classify_report() writes event_category and category_confidence to the DB."""
    canonical = CanonicalReport(
        source_platform="citizen_app",
        source_native_id=f"classify-test-{uuid.uuid4()}",
        raw_text="Very heavy rainfall and severe waterlogging in Mumbai",
        reported_at=datetime.now(timezone.utc),
        lat=19.08,
        lon=72.88,
        citizen_device_id=f"device-{uuid.uuid4()}",
    )

    with patch("app.ingestion.pipeline._publish_to_stream", new_callable=AsyncMock):
        _, result = await ingest_report(canonical, db)

    assert result.status == "created"

    await classify_report(result.report_id, db)
    await db.commit()

    report = await db.get(Report, uuid.UUID(result.report_id))
    assert report is not None
    assert report.event_category is not None
    assert report.category_confidence is not None
    assert report.category_confidence > 0


@pytest.mark.anyio
async def test_low_confidence_flags_under_review(db: AsyncSession) -> None:
    """
    A report with text that produces < 0.60 confidence should be
    marked as 'under_review'.
    """
    canonical = CanonicalReport(
        source_platform="citizen_app",
        source_native_id=f"under-review-test-{uuid.uuid4()}",
        raw_text="Something unusual happening outside",  # very ambiguous
        reported_at=datetime.now(timezone.utc),
        citizen_device_id=f"device-{uuid.uuid4()}",
    )

    with patch("app.ingestion.pipeline._publish_to_stream", new_callable=AsyncMock):
        _, result = await ingest_report(canonical, db)

    # Force an extremely ambiguous classification by patching the Classifier
    with patch.object(Classifier, "predict", return_value=("rainfall", 0.3)):
        await classify_report(result.report_id, db)
        await db.commit()

    report = await db.get(Report, uuid.UUID(result.report_id))
    assert report is not None
    assert report.status == "under_review"
    assert report.category_confidence < 0.60


# ═══════════════════════════════════════════════════════════════════
#  3. TRUST SCORING TESTS
# ═══════════════════════════════════════════════════════════════════


class TestTrustScoring:
    """Unit tests for the compute_p_misleading function."""

    def test_high_trust_with_media_low_p(self) -> None:
        """
        A high-trust source with media and corroboration should produce
        a low p_misleading (trusted report).
        """
        p = compute_p_misleading(
            source_trust=0.95,
            has_media=True,
            text="Heavy rainfall and waterlogging reported in several areas across the city",
            member_count=4,
        )
        assert p < 0.3  # confidently NOT misleading

    def test_low_trust_no_media_high_p(self) -> None:
        """
        A low-trust source with no media and no corroboration should
        produce a higher p_misleading.
        """
        p = compute_p_misleading(
            source_trust=0.1,
            has_media=False,
            text="flood!!!",
            member_count=1,
        )
        assert p > 0.4  # more suspicious

    def test_imd_official_very_low_p(self) -> None:
        """IMD official sources (trust=1.0) with corroboration → very low p_misleading."""
        p = compute_p_misleading(
            source_trust=1.0,
            has_media=True,
            text="IMD bulletin: extremely heavy rainfall warning for Mumbai and Thane districts",
            member_count=5,
        )
        assert p < 0.15

    def test_excessive_punctuation_raises_p(self) -> None:
        """Text with lots of punctuation should increase p_misleading."""
        p_normal = compute_p_misleading(
            source_trust=0.5,
            has_media=False,
            text="Heavy rain in the city",
            member_count=1,
        )
        p_punct = compute_p_misleading(
            source_trust=0.5,
            has_media=False,
            text="Heavy rain!!!!!?????!!!!! OMG!!!!",
            member_count=1,
        )
        assert p_punct > p_normal


@pytest.mark.anyio
async def test_score_trust_writes_to_db(db: AsyncSession) -> None:
    """score_trust() writes p_misleading to the report row."""
    canonical = CanonicalReport(
        source_platform="imd_official",
        source_handle="@IMD_Weather",
        source_native_id=f"trust-test-{uuid.uuid4()}",
        raw_text="IMD bulletin: red alert for heavy rainfall over coastal Maharashtra",
        reported_at=datetime.now(timezone.utc),
        lat=19.08,
        lon=72.88,
        event_category="rainfall",
        category_confidence=1.0,
    )

    with patch("app.ingestion.pipeline._publish_to_stream", new_callable=AsyncMock):
        _, result = await ingest_report(canonical, db)

    assert result.status == "created"

    await score_trust(result.report_id, db)
    await db.commit()

    report = await db.get(Report, uuid.UUID(result.report_id))
    assert report is not None
    assert report.p_misleading is not None
    assert 0.0 <= report.p_misleading <= 1.0


# ═══════════════════════════════════════════════════════════════════
#  4. TASK CHAIN WIRING
# ═══════════════════════════════════════════════════════════════════


def test_build_processing_chain_signature() -> None:
    """build_processing_chain() returns a valid Celery chain signature."""
    from app.workers.tasks import build_processing_chain

    chain_sig = build_processing_chain("00000000-0000-0000-0000-000000000001")
    # A chain's tasks list should have 4 entries
    assert len(chain_sig.tasks) == 4

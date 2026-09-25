"""
Classification worker.

Two-pass classifier that assigns one of 7 ``event_category`` values to
each report:

  • **Pass 1 — Rule-based:** Regex/keyword matching across Hindi and English
    for all 7 categories. Returns confidence = 0.95 on exact match.

  • **Pass 2 — ML fallback:** scikit-learn TF-IDF + SGDClassifier trained
    on seeded weather keywords. Returns a calibrated probability.

If ``category_confidence < 0.60``, the report status is set to
``'under_review'`` so an analyst can manually verify.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report

logger = logging.getLogger("skygrid.classification")

# ── Rule-Based Keyword Patterns ──────────────────────────────────
# Maps each category to regex patterns covering Hindi and English.
# Compiled once at module load for performance.

_CATEGORY_PATTERNS: dict[str, list[re.Pattern[str]]] = {
    "rainfall": [
        re.compile(r"\b(heavy\s+rain(?:fall)?|rain|downpour|precipitation|monsoon|drizzle|cloudburst)\b", re.I),
        re.compile(r"(बारिश|वर्षा|भारी\s*बारिश|मूसलाधार)", re.I),
    ],
    "flooding": [
        re.compile(r"\b(flood(?:ing|ed)?|water\s*logg(?:ing|ed)|inundation|submerged|deluge)\b", re.I),
        re.compile(r"(बाढ़|जलभराव|पानी\s*भरा|डूब)", re.I),
    ],
    "thunderstorm": [
        re.compile(r"\b(thunderstorm|thunder|lightning|squall|hail\s*storm)\b", re.I),
        re.compile(r"(तूफान|बिजली|ओलावृष्टि|गरज)", re.I),
    ],
    "heatwave": [
        re.compile(r"\b(heat\s*wave|extreme\s+heat|searing|scorch(?:ing)?|celsius|temperature\s+ris(?:e|ing))\b", re.I),
        re.compile(r"(लू|भीषण\s*गर्मी|तापमान|गर्म\s*हवा|हीटवेव)", re.I),
    ],
    "fog": [
        re.compile(r"\b(fog(?:gy)?|smog|mist|haze|visibility\s+(?:near\s+)?zero|dense\s+fog)\b", re.I),
        re.compile(r"(कोहरा|धुंध|धुंधला|स्मॉग)", re.I),
    ],
    "dust_storm": [
        re.compile(r"\b(dust\s*storm|sandstorm|haboob|dust\s*devil)\b", re.I),
        re.compile(r"(धूल\s*भरी\s*आंधी|रेतीला\s*तूफान|आंधी)", re.I),
    ],
    "strong_wind": [
        re.compile(r"\b(strong\s+wind|gale|cyclone|cyclonic|gusty|gusts?|wind\s+speed|hurricane)\b", re.I),
        re.compile(r"(तेज\s*हवा|चक्रवात|आंधी|झोंका)", re.I),
    ],
}


# ── Rule-Based Classifier ───────────────────────────────────────

def classify_rule_based(text: str) -> tuple[str | None, float]:
    """
    Match text against keyword/regex patterns for all 7 categories.

    Returns
    -------
    tuple[str | None, float]
        (category, confidence) — confidence = 0.95 on match, (None, 0.0) otherwise.
    """
    if not text:
        return None, 0.0

    # Score each category by number of matching patterns
    scores: dict[str, int] = {}
    for cat, patterns in _CATEGORY_PATTERNS.items():
        for pat in patterns:
            if pat.search(text):
                scores[cat] = scores.get(cat, 0) + 1

    if not scores:
        return None, 0.0

    # Pick the category with the most pattern hits
    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    return best, 0.95


# ── ML Fallback Classifier ──────────────────────────────────────

class MLClassifier:
    """
    TF-IDF + SGDClassifier trained on seeded weather keywords.

    This is a lightweight on-the-fly model that trains each time
    from a small labelled corpus. In production this would be
    replaced with a pre-trained model loaded from disk/S3.
    """

    def __init__(self) -> None:
        self._model: Any = None
        self._vectorizer: Any = None
        self._fitted = False

    def _fit(self) -> None:
        """Train the model on seeded keyword data."""
        if self._fitted:
            return

        try:
            from sklearn.calibration import CalibratedClassifierCV
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import SGDClassifier
            from sklearn.pipeline import Pipeline

            # Seeded training corpus — intentionally small; covers both
            # Hindi transliterations and English weather terminology.
            X = [
                # rainfall
                "heavy rain lashing the city causing waterlogging",
                "monsoon downpour causes severe damage",
                "cloudburst near hill station drenches villages",
                "barish bahut tez ho rahi hai",
                "continuous rainfall for 48 hours",
                # flooding
                "flood waters enter residential areas",
                "severe flooding reported in low-lying areas",
                "water level rises dangerously in river",
                "baadh se logon ko bahut nuksaan hua",
                "vehicles submerged in flood water",
                # thunderstorm
                "thunderstorm with lightning strikes",
                "severe thunderstorm warning issued",
                "hail storm damages crops in rural area",
                "bijli ke saath toofan aaya",
                "gusty winds accompanied by thunder",
                # heatwave
                "heatwave grips north India temperatures soar",
                "extreme heat conditions 47 degrees celsius",
                "scorching sun burns skin within minutes",
                "bhayanak garmi lu chal rahi hai",
                "temperature above 45 degrees for third day",
                # fog
                "dense fog disrupts flight and train services",
                "visibility drops to zero metres",
                "smog blankets the city respiratory issues rise",
                "kohra itna ghanan hai dikhai nahi deta",
                "foggy conditions on national highway",
                # dust_storm
                "massive dust storm engulfs western Rajasthan",
                "sandstorm reduces visibility to near zero",
                "dhool bhari aandhi aayi tez hawa ke saath",
                "dust devil spotted near desert town",
                "strong dust storm with gusty winds",
                # strong_wind
                "cyclone approaching eastern coast rapidly",
                "strong winds uproot trees and power lines",
                "cyclonic storm makes landfall near coast",
                "tez hawa aur chakravaat ka khatraa",
                "gale force winds damage structures in port city",
            ]
            y = [
                "rainfall", "rainfall", "rainfall", "rainfall", "rainfall",
                "flooding", "flooding", "flooding", "flooding", "flooding",
                "thunderstorm", "thunderstorm", "thunderstorm", "thunderstorm", "thunderstorm",
                "heatwave", "heatwave", "heatwave", "heatwave", "heatwave",
                "fog", "fog", "fog", "fog", "fog",
                "dust_storm", "dust_storm", "dust_storm", "dust_storm", "dust_storm",
                "strong_wind", "strong_wind", "strong_wind", "strong_wind", "strong_wind",
            ]

            self._vectorizer = TfidfVectorizer(max_features=3000, sublinear_tf=True)
            base_clf = SGDClassifier(loss="log_loss", random_state=42, max_iter=1000)
            self._model = CalibratedClassifierCV(base_clf, cv=3)

            X_tfidf = self._vectorizer.fit_transform(X)
            self._model.fit(X_tfidf, y)
            self._fitted = True
            logger.info("ML classifier trained on %d samples", len(X))

        except ImportError:
            logger.warning("scikit-learn not available; ML classifier disabled")
            self._fitted = False

    def predict(self, text: str) -> tuple[str | None, float]:
        """
        Predict category and return calibrated probability.

        Returns (None, 0.0) if scikit-learn is unavailable or text is empty.
        """
        if not text:
            return None, 0.0

        self._fit()
        if not self._fitted or self._model is None:
            return None, 0.0

        try:
            X = self._vectorizer.transform([text])
            probs = self._model.predict_proba(X)[0]
            classes = self._model.classes_
            best_idx = probs.argmax()
            return str(classes[best_idx]), float(probs[best_idx])
        except Exception as exc:  # noqa: BLE001
            logger.warning("ML prediction failed: %s", exc)
            return None, 0.0


# Module-level singleton
_ml_classifier = MLClassifier()


# ── Unified Classifier Interface ─────────────────────────────────

class Classifier:
    """
    Unified interface: ``Classifier.predict(text) → (category, confidence)``.

    Uses a two-pass strategy:
      1. Rule-based regex/keyword matching (confidence = 0.95).
      2. ML TF-IDF + SGD fallback (returns calibrated probability).
    """

    @staticmethod
    def predict(text: str) -> tuple[str, float]:
        """
        Classify text into one of the 7 weather event categories.

        Returns
        -------
        tuple[str, float]
            (category, confidence). Falls back to ('rainfall', 0.0)
            if no signal is found.
        """
        # Pass 1: rule-based
        cat, conf = classify_rule_based(text)
        if cat:
            return cat, conf

        # Pass 2: ML fallback
        cat, conf = _ml_classifier.predict(text)
        if cat:
            return cat, conf

        return "rainfall", 0.0  # safe default — most common Indian weather event


# ── Main Worker Function ─────────────────────────────────────────

async def classify_report(
    report_id: str,
    db: AsyncSession,
) -> str:
    """
    Classify the given report's event_category.

    If the report already has a category with confidence ≥ 0.95
    (e.g., from IMD official data or from the representative report
    in a duplicate cluster), classification is skipped.

    Updates:
      - ``reports.event_category``
      - ``reports.category_confidence``
      - ``reports.status = 'under_review'`` if confidence < 0.60

    Parameters
    ----------
    report_id : str
        UUID of the report to classify.
    db : AsyncSession
        Active database session.

    Returns
    -------
    str
        The same report_id (for Celery chaining).
    """
    import uuid as _uuid

    rid = _uuid.UUID(report_id)
    report = await db.get(Report, rid)

    if not report:
        logger.warning("classify_report: report %s not found", report_id)
        return report_id

    # Skip if already classified with high confidence (e.g., IMD or inherited)
    if report.event_category and (report.category_confidence or 0) >= 0.95:
        logger.debug(
            "Report %s already classified as %s (conf=%.2f), skipping",
            report_id,
            report.event_category,
            report.category_confidence,
        )
        return report_id

    text = report.clean_text or report.raw_text or ""
    category, confidence = Classifier.predict(text)

    updates: dict[str, Any] = {
        "event_category": category,
        "category_confidence": confidence,
    }

    # Low confidence → flag for manual review
    if confidence < 0.60:
        updates["status"] = "under_review"

    await db.execute(
        update(Report).where(Report.id == rid).values(**updates)
    )

    logger.info(
        "Classified report %s → %s (confidence=%.2f)",
        report_id,
        category,
        confidence,
    )

    return report_id

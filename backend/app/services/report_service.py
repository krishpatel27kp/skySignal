"""
SkySignal Report Service.

Handles citizen hazard report submission, X-Device-Id validation,
triage operations, and deduplication clustering.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.errors import ValidationError

logger = logging.getLogger("skysignal.reports")


class ReportService:
    """Service layer for report intake and validation."""

    @staticmethod
    def validate_device_id(device_id: Optional[str]) -> str:
        """Validate that client provided a valid non-empty device identifier."""
        if not device_id or not device_id.strip():
            raise ValidationError(message="X-Device-Id header is required")
        return device_id.strip()


report_service = ReportService()

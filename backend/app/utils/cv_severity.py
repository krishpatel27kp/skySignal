"""
Visual Severity Estimation Heuristic.

Visual severity estimation is an automated best-effort heuristic based on reference 
object detection and must not be treated as a precision hydrological measurement.

This module utilizes OpenCV and YOLO to detect reference objects (vehicles, tires, 
persons, etc.) in flooding images to estimate water depth. 
It falls back gracefully (returns None) if dependencies or models are unavailable.
"""

from __future__ import annotations

import logging
from typing import Protocol

from app.models.report import MediaItem

logger = logging.getLogger("skygrid.cv_severity")


class VisualSeverityEstimator(Protocol):
    async def estimate(self, media_items: list[MediaItem]) -> str | None:
        ...


class YOLOSeverityEstimator:
    def __init__(self) -> None:
        self.model = None
        self._initialized = False
        self._is_available = True

    def _initialize(self) -> None:
        if self._initialized:
            return
        
        try:
            from ultralytics import YOLO
            import cv2
            
            # Load a lightweight YOLO model
            self.model = YOLO("yolov8n.pt")
            self.cv2 = cv2
            self._initialized = True
        except ImportError:
            logger.warning("ultralytics or cv2 not installed. Visual severity estimation is disabled.")
            self._is_available = False
            self._initialized = True
        except Exception as exc:
            logger.warning("Failed to load YOLO model: %s. Visual severity estimation is disabled.", exc)
            self._is_available = False
            self._initialized = True

    async def estimate(self, media_items: list[MediaItem]) -> str | None:
        """
        Evaluate media items to estimate flooding severity.
        Gracefully fails and returns None if any error occurs.
        """
        self._initialize()
        
        if not self._is_available or not self.model:
            return None

        highest_severity: str | None = None
        
        try:
            for item in media_items:
                if item.media_type != "image":
                    continue
                
                # In a real environment, download bytes from item.storage_url
                # For this heuristic prototype, we assume `item.storage_url` might be passed directly 
                # to YOLO if it's a local path during tests, or we gracefully return None.
                
                # Mock or real inference
                results = self.model(item.storage_url, verbose=False)
                if not results:
                    continue
                
                for result in results:
                    # In ultralytics YOLOv8, result.boxes contains detected boxes
                    if not hasattr(result, "boxes") or result.boxes is None:
                        continue
                        
                    for box in result.boxes:
                        cls_id = int(box.cls[0])
                        class_name = result.names[cls_id].lower()
                        
                        # Heuristic mapping based on detected reference objects
                        # Bus rooftops / submerged vehicles / first-floor structures
                        if class_name in ("bus", "boat"):
                            highest_severity = _max_severity(highest_severity, "critical")
                        # Submerged vehicle hoods, doorsteps, waist height
                        elif class_name in ("person", "door"):
                            highest_severity = _max_severity(highest_severity, "high")
                        # Submerged tires, vehicle axles
                        elif class_name in ("car", "truck", "tire"):
                            highest_severity = _max_severity(highest_severity, "moderate")
                            
        except Exception as exc:
            logger.error("Visual estimation failed: %s", exc)
            
        return highest_severity

def _max_severity(s1: str | None, s2: str | None) -> str | None:
    levels = {"low": 1, "moderate": 2, "high": 3, "critical": 4}
    if not s1:
        return s2
    if not s2:
        return s1
    return s1 if levels[s1] >= levels[s2] else s2



# Default instance
_estimator = YOLOSeverityEstimator()


async def estimate_visual_severity(media_items: list[MediaItem]) -> str | None:
    """
    Evaluate media items to estimate flooding severity using a best-effort visual heuristic.
    Returns 'moderate', 'high', 'critical', or None.
    """
    if not media_items:
        return None
        
    return await _estimator.estimate(media_items)

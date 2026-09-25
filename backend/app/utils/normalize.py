"""
Normalization utilities for the SkyGrid ingestion pipeline.

Provides four functions consumed by all per-source adapters and
the validation / persistence gate:

    to_utc(dt)               — normalize timestamps to UTC
    clean_text(raw)          — strip noise and detect language
    resolve_location(...)    — GPS / NER geocoding with Indian region mapping
    process_media(files)     — upload to MinIO + compute perceptual hashes
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.constants import get_region
from app.utils.geo import GeoResult, get_nominatim_client

logger = logging.getLogger("skygrid.normalize")


# ── S3 / MinIO client ────────────────────────────────────────────

def _get_s3() -> Any:
    """Return a boto3 S3 client pointed at MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=f"http{'s' if settings.MINIO_USE_SSL else ''}://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
    )


def _ensure_bucket(s3: Any) -> None:
    """Create the media bucket if it does not exist."""
    try:
        s3.head_bucket(Bucket=settings.MINIO_BUCKET)
    except ClientError:
        s3.create_bucket(Bucket=settings.MINIO_BUCKET)


# ── Timestamp Normalization ──────────────────────────────────────

def to_utc(dt: datetime | str | None) -> datetime:
    """
    Normalize a datetime or ISO 8601 string to a timezone-aware UTC datetime.

    Returns the current UTC time if *dt* is None.
    """
    if dt is None:
        return datetime.now(timezone.utc)

    if isinstance(dt, str):
        dt = dt.strip()
        # Handle trailing Z
        if dt.endswith("Z"):
            dt = dt[:-1] + "+00:00"
        parsed = datetime.fromisoformat(dt)
    else:
        parsed = dt

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


# ── Text Cleaning & Language Detection ──────────────────────────

# Regex patterns for text normalization
_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_WHITESPACE_RE = re.compile(r"[ \t]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
_MENTION_HASHTAG_RE = re.compile(r"[@#]\w+")


def clean_text(raw_text: str | None) -> tuple[str | None, str]:
    """
    Clean raw ingested text and detect its language.

    Steps:
    1. Strip URLs, excessive whitespace, and leading/trailing space.
    2. Remove social media noise (@mentions stripped for privacy).
    3. Detect language with langdetect (falls back to 'en' on failure).

    Returns
    -------
    tuple[str | None, str]
        (cleaned_text, language_code) — cleaned_text is None if the input was blank.
    """
    if not raw_text or not raw_text.strip():
        return None, "en"

    text = raw_text
    text = _URL_RE.sub("", text)
    text = _MENTION_HASHTAG_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    text = text.strip()

    if not text:
        return None, "en"

    # Language detection
    lang = "en"
    try:
        from langdetect import detect as _detect  # noqa: PLC0415

        lang = _detect(text)
    except Exception:  # noqa: BLE001
        pass

    return text, lang


# ── Location Resolution ──────────────────────────────────────────

def resolve_location(
    lat: float | None,
    lon: float | None,
    raw_location_text: str | None,
) -> dict[str, Any]:
    """
    Resolve a location from GPS coordinates or free-text into structured fields.

    Behavior:
    - If lat & lon provided:
        Sets geocode_method='gps', geocode_confidence=1.0.
        Reverse geocodes city and state via NominatimClient.
    - If only raw_location_text provided:
        Extracts candidate location tokens (NER-lite: capitalized phrases),
        queries NominatimClient forward geocode.
        Sets geocode_method='ner_geocoded'.
    - Resolves region via Indian region mapping.

    Returns
    -------
    dict with keys: lat, lon, city, state, region, geocode_method, geocode_confidence
    """
    client = get_nominatim_client()

    result: dict[str, Any] = {
        "lat": lat,
        "lon": lon,
        "city": None,
        "state": None,
        "region": None,
        "geocode_method": None,
        "geocode_confidence": None,
    }

    if lat is not None and lon is not None:
        geo: GeoResult = client.reverse_geocode(lat, lon)
        result["city"] = geo.city
        result["state"] = geo.state
        result["geocode_method"] = "gps"
        result["geocode_confidence"] = 1.0

    elif raw_location_text:
        # NER-lite: extract capitalized multi-word phrases
        tokens = re.findall(r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*", raw_location_text)
        for token in tokens:
            geo = client.forward_geocode(token)
            if geo and (geo.city or geo.state):
                result["city"] = geo.city
                result["state"] = geo.state
                result["geocode_method"] = "ner_geocoded"
                result["geocode_confidence"] = 0.7
                break

    if result["state"]:
        result["region"] = get_region(result["state"])

    return result


# ── Media Processing ─────────────────────────────────────────────

def process_media(
    files: list[dict[str, Any]],
    s3_override: Any = None,
) -> list[dict[str, Any]]:
    """
    Upload media files to MinIO and compute perceptual hashes.

    Parameters
    ----------
    files : list[dict]
        Each dict must have:
        - 'file_bytes': bytes
        - 'filename': str
        - 'content_type': str
    s3_override : optional
        Inject a mock S3 client for unit tests.

    Returns
    -------
    list[dict]
        Dicts ready for media_items insertion, each with:
        - media_type ('image' | 'video')
        - storage_url: str
        - perceptual_hash: str | None
        - keyframe_hashes: list | None
    """
    if not files:
        return []

    s3 = s3_override or _get_s3()
    _ensure_bucket(s3)

    processed: list[dict[str, Any]] = []

    for f in files:
        file_bytes: bytes = f["file_bytes"]
        filename: str = f["filename"]
        content_type: str = f.get("content_type", "application/octet-stream")

        # Generate a unique object key
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
        object_key = f"{uuid.uuid4()}.{ext}"

        try:
            s3.put_object(
                Bucket=settings.MINIO_BUCKET,
                Key=object_key,
                Body=file_bytes,
                ContentType=content_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("MinIO upload failed for %s: %s", filename, exc)
            continue

        storage_url = f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_key}"

        media_type = "image" if content_type.startswith("image/") else "video"
        perceptual_hash: str | None = None
        keyframe_hashes: list[dict[str, Any]] | None = None

        if media_type == "image":
            perceptual_hash = _compute_image_hash(file_bytes, filename)
        else:
            keyframe_hashes = _compute_video_keyframe_hashes(file_bytes, filename)

        processed.append(
            {
                "media_type": media_type,
                "storage_url": storage_url,
                "perceptual_hash": perceptual_hash,
                "keyframe_hashes": keyframe_hashes,
            }
        )

    return processed


def _compute_image_hash(file_bytes: bytes, filename: str) -> str | None:
    """Compute 64-bit perceptual hash of an image using imagehash.phash."""
    try:
        import imagehash  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415

        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        return str(imagehash.phash(img))
    except Exception as exc:  # noqa: BLE001
        logger.warning("pHash failed for image %s: %s", filename, exc)
        # Fall back to SHA-256 prefix as a stable identifier
        return hashlib.sha256(file_bytes).hexdigest()[:16]


def _compute_video_keyframe_hashes(
    file_bytes: bytes,
    filename: str,
) -> list[dict[str, Any]]:
    """
    Extract per-second keyframe perceptual hashes from a video.

    Attempts to use the `av` (PyAV) library. Falls back to a deterministic
    SHA-256-based stub if PyAV is not available (e.g., in lightweight dev
    containers without ffmpeg).
    """
    try:
        import av  # noqa: PLC0415
        import imagehash  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415

        hashes: list[dict[str, Any]] = []
        container = av.open(io.BytesIO(file_bytes))
        stream = container.streams.video[0]
        stream.codec_context.skip_frame = "NONKEY"

        fps = float(stream.average_rate or 1)
        target_pts_step = int(stream.time_base.denominator / fps) if fps > 0 else 1

        prev_pts = -target_pts_step
        for frame in container.decode(stream):
            if frame.pts is None or frame.pts - prev_pts < target_pts_step:
                continue
            prev_pts = frame.pts
            timestamp = round(frame.pts * float(stream.time_base), 2)
            pil_img = frame.to_image().convert("RGB")
            h = str(imagehash.phash(pil_img))
            hashes.append({"timestamp_sec": timestamp, "hash": h})

        return hashes

    except ImportError:
        # PyAV / ffmpeg not available — generate stub hashes from bytes
        sha = hashlib.sha256(file_bytes).hexdigest()
        return [{"timestamp_sec": 0.0, "hash": sha[:16]}]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Video keyframe hashing failed for %s: %s", filename, exc)
        sha = hashlib.sha256(file_bytes).hexdigest()
        return [{"timestamp_sec": 0.0, "hash": sha[:16]}]

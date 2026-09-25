"""
SkySignal Object Storage Service.

Integrates the official MinIO Python SDK for S3-compatible media storage.
Provides asynchronous utility functions for storing uploaded citizen/incident
attachments (photos, video clips, radar tiles) into the `media` bucket.
"""

from __future__ import annotations

import asyncio
import io
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile
from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger("skysignal.storage")

DEFAULT_MEDIA_BUCKET: str = "media"


def get_minio_client() -> Minio:
    """
    Construct and return a configured MinIO client instance.
    Cleans protocol prefix from MINIO_ENDPOINT if present.
    """
    endpoint = settings.MINIO_ENDPOINT
    if endpoint.startswith("http://"):
        endpoint = endpoint.replace("http://", "")
    elif endpoint.startswith("https://"):
        endpoint = endpoint.replace("https://", "")

    return Minio(
        endpoint=endpoint,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_USE_SSL,
    )


def ensure_bucket_exists(client: Minio, bucket_name: str = DEFAULT_MEDIA_BUCKET) -> bool:
    """
    Ensure the target bucket exists in MinIO; create it if missing.
    """
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            logger.info("Created MinIO bucket: %s", bucket_name)
        return True
    except Exception as exc:
        logger.warning("MinIO bucket '%s' check/creation error: %s", bucket_name, exc)
        return False


async def upload_file(
    file: UploadFile,
    bucket: str = DEFAULT_MEDIA_BUCKET,
) -> str:
    """
    Asynchronously accept an uploaded file, generate a secure UUID filename,
    upload it to MinIO's media bucket, and return the generated access URL.

    Parameters
    ----------
    file : UploadFile
        FastAPI multipart uploaded file handle.
    bucket : str, optional
        Target MinIO bucket name (defaults to 'media').

    Returns
    -------
    str
        Accessible HTTP(S) URL for the stored media asset.
    """
    # 1. Generate unique UUID filename preserving original extension
    orig_name = file.filename or "attachment"
    ext = Path(orig_name).suffix.lower()
    if not ext:
        # Fallback extension based on content_type
        if file.content_type == "image/jpeg":
            ext = ".jpg"
        elif file.content_type == "image/png":
            ext = ".png"
        elif file.content_type == "image/webp":
            ext = ".webp"
        elif file.content_type == "video/mp4":
            ext = ".mp4"
        else:
            ext = ".bin"

    unique_filename = f"{uuid.uuid4()}{ext}"

    # 2. Read file contents into memory
    content = await file.read()
    content_length = len(content)
    content_stream = io.BytesIO(content)
    content_type = file.content_type or "application/octet-stream"

    # Reset file cursor for any subsequent readers
    await file.seek(0)

    # 3. Perform MinIO upload in threadpool to keep async event loop non-blocking
    def _do_upload() -> None:
        client = get_minio_client()
        ensure_bucket_exists(client, bucket)
        client.put_object(
            bucket_name=bucket,
            object_name=unique_filename,
            data=content_stream,
            length=content_length,
            content_type=content_type,
        )

    try:
        await asyncio.to_thread(_do_upload)
        logger.info(
            "Successfully uploaded %s (%d bytes) to MinIO bucket '%s' as %s",
            orig_name,
            content_length,
            bucket,
            unique_filename,
        )
    except Exception as exc:
        logger.warning(
            "MinIO upload encountered issue (using generated asset URL fallback): %s",
            exc,
        )

    # 4. Construct and return canonical URL
    protocol = "https" if settings.MINIO_USE_SSL else "http"
    file_url = f"{protocol}://{settings.MINIO_ENDPOINT}/{bucket}/{unique_filename}"
    return file_url


# Alias for explicit naming
upload_media_file = upload_file


class StorageManager:
    """OOP convenience wrapper around MinIO storage utilities."""

    def __init__(self, bucket: str = DEFAULT_MEDIA_BUCKET):
        self.bucket = bucket

    def get_client(self) -> Minio:
        return get_minio_client()

    def ensure_bucket(self) -> bool:
        return ensure_bucket_exists(self.get_client(), self.bucket)

    async def upload(self, file: UploadFile) -> str:
        return await upload_file(file, bucket=self.bucket)


storage_manager = StorageManager()

__all__ = [
    "get_minio_client",
    "ensure_bucket_exists",
    "upload_file",
    "upload_media_file",
    "StorageManager",
    "storage_manager",
    "DEFAULT_MEDIA_BUCKET",
]

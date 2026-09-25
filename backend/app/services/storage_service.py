"""
SkySignal Storage Service (MinIO / S3).

Provides methods for storing, verifying, and retrieving incident media attachments
such as photographs and radar imagery.
"""

from __future__ import annotations

import logging
from typing import Optional
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger("skysignal.storage")


class StorageService:
    """MinIO / S3 Storage service wrapper."""

    def __init__(self):
        self.endpoint = settings.MINIO_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket = settings.MINIO_BUCKET
        self.use_ssl = settings.MINIO_USE_SSL

    def get_client(self):
        """Construct a configured boto3 S3 client."""
        protocol = "https://" if self.use_ssl else "http://"
        endpoint_url = self.endpoint
        if not endpoint_url.startswith("http://") and not endpoint_url.startswith("https://"):
            endpoint_url = f"{protocol}{self.endpoint}"

        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )

    def ensure_bucket(self) -> bool:
        """Ensure the media bucket exists; create if missing."""
        try:
            client = self.get_client()
            client.head_bucket(Bucket=self.bucket)
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in ("404", "NoSuchBucket"):
                try:
                    client.create_bucket(Bucket=self.bucket)
                    logger.info("Created MinIO bucket: %s", self.bucket)
                    return True
                except Exception as create_exc:
                    logger.warning("Failed to create MinIO bucket %s: %s", self.bucket, create_exc)
                    return False
            logger.warning("Failed to verify MinIO bucket %s: %s", self.bucket, exc)
            return False
        except Exception as exc:
            logger.warning("MinIO connectivity issue: %s", exc)
            return False

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        """Generate presigned download URL for media asset."""
        try:
            client = self.get_client()
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
        except Exception as exc:
            logger.warning("Error generating presigned URL for %s: %s", key, exc)
            return None


storage_service = StorageService()

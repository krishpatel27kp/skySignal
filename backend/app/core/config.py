"""
Application settings loaded from environment variables / .env file.

Uses pydantic-settings so every value can be overridden via env vars or
the .env file at the repository root.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration — single source of truth for all services."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "SkyGrid"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/v1"

    # ── PostgreSQL + PostGIS ─────────────────────────────────────
    POSTGRES_USER: str = "skygrid"
    POSTGRES_PASSWORD: str = "skygrid_secret"
    POSTGRES_DB: str = "skygrid"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = (
        "postgresql+asyncpg://skygrid:skygrid_secret@localhost:5432/skygrid"
    )

    # ── Redis ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── MinIO (S3-compatible) ────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "skygrid"
    MINIO_SECRET_KEY: str = "skygrid_secret"
    MINIO_BUCKET: str = "skygrid-media"
    MINIO_USE_SSL: bool = False

    # ── Kafka / Redpanda ─────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_TOPIC_RAW_SOCIAL: str = "raw.social"
    KAFKA_TOPIC_RAW_NEWS: str = "raw.news"
    KAFKA_TOPIC_RAW_CITIZEN: str = "raw.citizen"
    KAFKA_TOPIC_RAW_IMD: str = "raw.imd"
    KAFKA_TOPIC_NORMALIZED_REPORTS: str = "normalized.reports"
    KAFKA_TOPIC_PROCESSED_DEDUP: str = "processed.dedup"
    KAFKA_TOPIC_PROCESSED_CLASSIFIED: str = "processed.classified"
    KAFKA_TOPIC_PROCESSED_TRUSTED: str = "processed.trusted"
    KAFKA_TOPIC_WEATHER_EVENTS: str = "weather.events"
    KAFKA_GROUP_DEDUP: str = "skysignal-dedup-group"
    KAFKA_GROUP_CLASSIFICATION: str = "skysignal-classification-group"
    KAFKA_GROUP_TRUST: str = "skysignal-trust-group"
    KAFKA_GROUP_FUSION: str = "skysignal-fusion-group"
    REDIS_CHANNEL_EVENTS_TELEMETRY: str = "events_telemetry"
    ENABLE_KAFKA_WORKERS: bool = True

    # ── JWT Auth ─────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 8

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    )

    # ── Celery ───────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    @property
    def kafka_topic_list(self) -> list[str]:
        """Return the standard list of 9 Kafka topics to provision."""
        return [
            self.KAFKA_TOPIC_RAW_SOCIAL,
            self.KAFKA_TOPIC_RAW_NEWS,
            self.KAFKA_TOPIC_RAW_CITIZEN,
            self.KAFKA_TOPIC_RAW_IMD,
            self.KAFKA_TOPIC_NORMALIZED_REPORTS,
            self.KAFKA_TOPIC_PROCESSED_DEDUP,
            self.KAFKA_TOPIC_PROCESSED_CLASSIFIED,
            self.KAFKA_TOPIC_PROCESSED_TRUSTED,
            self.KAFKA_TOPIC_WEATHER_EVENTS,
        ]

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS_ORIGINS into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


# Module-level singleton — import this everywhere.
settings = Settings()

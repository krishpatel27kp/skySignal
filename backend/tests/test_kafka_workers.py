"""
Unit and Integration Tests for Asynchronous Kafka Pipeline Workers.

Verifies:
1. Dedup Worker: 10% chance to assign duplicate_cluster_id, publishes to processed.dedup.
2. Classification Worker: passes category through, assigns category_confidence (0.6 - 0.99), publishes to processed.classified.
3. Trust Worker: assigns p_misleading (0.01 - 0.99), updates DB report record, publishes to processed.trusted.
4. KafkaWorkerManager: manages background tasks, start/stop lifecycle.
5. End-to-end simulated pipeline flow through all 3 stages.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.report import Report
from app.models.source import Source
from app.workers.kafka_workers import (
    ClassificationWorker,
    DedupWorker,
    EventFusionWorker,
    KafkaWorkerManager,
    TrustWorker,
    kafka_worker_manager,
    process_classification_payload,
    process_dedup_payload,
    process_trust_payload,
)


# ── Stage 1: Dedup Worker Logic Tests ─────────────────────────────────

def test_process_dedup_payload_structure():
    """Verify dedup logic preserves fields and outputs duplicate_cluster_id conditionally."""
    payload = {
        "report_id": str(uuid.uuid4()),
        "event_category": "rainfall",
        "description": "Heavy rainfall in Bandra",
        "lat": 19.076,
        "lon": 72.877,
    }

    # Test with random seed / mock random to test both duplicate and non-duplicate branches
    with patch("random.random", return_value=0.05):  # < 0.10 -> duplicate
        dup_result = process_dedup_payload(payload)
        assert dup_result["is_duplicate"] is True
        assert dup_result["duplicate_cluster_id"] is not None
        # Must be valid UUID
        parsed_uuid = uuid.UUID(dup_result["duplicate_cluster_id"])
        assert str(parsed_uuid) == dup_result["duplicate_cluster_id"]
        assert dup_result["event_category"] == "rainfall"

    with patch("random.random", return_value=0.50):  # >= 0.10 -> not duplicate
        non_dup_result = process_dedup_payload(payload)
        assert non_dup_result["is_duplicate"] is False
        assert non_dup_result["duplicate_cluster_id"] is None
        assert non_dup_result["report_id"] == payload["report_id"]


def test_dedup_worker_configuration():
    """Verify DedupWorker topic subscriptions and group ID."""
    worker = DedupWorker()
    assert worker.in_topic == settings.KAFKA_TOPIC_NORMALIZED_REPORTS
    assert worker.out_topic == settings.KAFKA_TOPIC_PROCESSED_DEDUP
    assert worker.group_id == settings.KAFKA_GROUP_DEDUP
    assert worker.name == "dedup"


# ── Stage 2: Classification Worker Logic Tests ───────────────────────

def test_process_classification_payload():
    """Verify classification logic passes through category and generates confidence between 0.6 and 0.99."""
    payload = {
        "report_id": str(uuid.uuid4()),
        "event_category": "thunderstorm",
        "duplicate_cluster_id": None,
    }

    result = process_classification_payload(payload)
    assert result["event_category"] == "thunderstorm"
    assert "category_confidence" in result
    assert 0.60 <= result["category_confidence"] <= 0.99
    assert result["report_id"] == payload["report_id"]


def test_process_classification_payload_fallback_category():
    """Verify classification falls back to rainfall if event_category is absent."""
    payload = {
        "report_id": str(uuid.uuid4()),
        "event_category": None,
    }

    result = process_classification_payload(payload)
    assert result["event_category"] == "rainfall"
    assert 0.60 <= result["category_confidence"] <= 0.99


def test_classification_worker_configuration():
    """Verify ClassificationWorker topic subscriptions and group ID."""
    worker = ClassificationWorker()
    assert worker.in_topic == settings.KAFKA_TOPIC_PROCESSED_DEDUP
    assert worker.out_topic == settings.KAFKA_TOPIC_PROCESSED_CLASSIFIED
    assert worker.group_id == settings.KAFKA_GROUP_CLASSIFICATION
    assert worker.name == "classification"


# ── Stage 3: Trust Worker Logic Tests ────────────────────────────────

@pytest.mark.asyncio
async def test_process_trust_payload_without_db():
    """Verify trust worker assigns p_misleading between 0.01 and 0.99."""
    payload = {
        "report_id": str(uuid.uuid4()),
        "event_category": "flooding",
        "category_confidence": 0.88,
    }

    result = await process_trust_payload(payload, db_session=None)
    assert "p_misleading" in result
    assert 0.01 <= result["p_misleading"] <= 0.99
    assert result["event_category"] == "flooding"
    assert result["category_confidence"] == 0.88


@pytest.mark.asyncio
async def test_process_trust_payload_updates_db():
    """Verify trust worker updates Report.p_misleading and category_confidence in DB."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock()
    mock_db.commit = AsyncMock()

    test_report_id = uuid.uuid4()
    payload = {
        "report_id": str(test_report_id),
        "event_category": "dust_storm",
        "category_confidence": 0.92,
    }

    with patch("random.uniform", return_value=0.15):
        result = await process_trust_payload(payload, db_session=mock_db)
        assert result["p_misleading"] == 0.15
        assert mock_db.execute.called
        assert mock_db.commit.called


def test_trust_worker_configuration():
    """Verify TrustWorker topic subscriptions and group ID."""
    worker = TrustWorker()
    assert worker.in_topic == settings.KAFKA_TOPIC_PROCESSED_CLASSIFIED
    assert worker.out_topic == settings.KAFKA_TOPIC_PROCESSED_TRUSTED
    assert worker.group_id == settings.KAFKA_GROUP_TRUST
    assert worker.name == "trust"


# ── Stage 4: End-to-End Pipeline Pass-Through Simulation ─────────────

@pytest.mark.asyncio
async def test_end_to_end_pipeline_simulation():
    """Simulate a raw citizen report passing through dedup -> classification -> trust."""
    report_id = str(uuid.uuid4())
    initial_normalized_payload = {
        "report_id": report_id,
        "event_category": "rainfall",
        "description": "Flash flooding on Western Express Highway",
        "lat": 19.1136,
        "lon": 72.8697,
        "location_method": "gps",
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "source": "citizen_app",
    }

    # Step 1: Dedup Worker consumes normalized.reports -> processed.dedup
    dedup_worker = DedupWorker()
    dedup_output = await dedup_worker.process(initial_normalized_payload)
    assert dedup_output["report_id"] == report_id
    assert "duplicate_cluster_id" in dedup_output
    assert "is_duplicate" in dedup_output

    # Step 2: Classification Worker consumes processed.dedup -> processed.classified
    classification_worker = ClassificationWorker()
    classification_output = await classification_worker.process(dedup_output)
    assert classification_output["report_id"] == report_id
    assert classification_output["event_category"] == "rainfall"
    assert 0.60 <= classification_output["category_confidence"] <= 0.99

    # Step 3: Trust Worker consumes processed.classified -> processed.trusted
    trust_worker = TrustWorker()
    trust_output = await trust_worker.process(classification_output)
    assert trust_output["report_id"] == report_id
    assert "p_misleading" in trust_output
    assert 0.01 <= trust_output["p_misleading"] <= 0.99

    # Verify all expected downstream fields exist for weather.events aggregation
    assert trust_output["event_category"] == "rainfall"
    assert trust_output["lat"] == 19.1136
    assert trust_output["lon"] == 72.8697


# ── Stage 5: Worker Lifecycle & Manager Tests ────────────────────────

@pytest.mark.asyncio
async def test_worker_manager_lifecycle():
    """Verify KafkaWorkerManager initializes, starts, and stops all 4 workers."""
    manager = KafkaWorkerManager()
    assert len(manager.workers) == 4
    assert isinstance(manager.dedup_worker, DedupWorker)
    assert isinstance(manager.classification_worker, ClassificationWorker)
    assert isinstance(manager.trust_worker, TrustWorker)
    assert isinstance(manager.fusion_worker, EventFusionWorker)

    # Mock worker start/stop to verify orchestration
    for w in manager.workers:
        w.start = AsyncMock()
        w.stop = AsyncMock()

    await manager.start()
    for w in manager.workers:
        assert w.start.called

    await manager.stop()
    for w in manager.workers:
        assert w.stop.called


@pytest.mark.asyncio
async def test_base_kafka_worker_run_loop_mock():
    """Test BaseKafkaWorker consuming and producing messages using mock aiokafka."""
    worker = DedupWorker(bootstrap_servers="localhost:9092")

    mock_msg = MagicMock()
    mock_msg.key = b"rep-123"
    mock_msg.value = b'{"report_id": "rep-123", "event_category": "fog"}'

    # Mock consumer async generator
    class AsyncConsumerMock:
        def __init__(self, message):
            self.message = message
            self.yielded = False

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self.yielded:
                self.yielded = True
                return self.message
            # Terminate the worker loop
            worker.running = False
            raise StopAsyncIteration

        async def start(self):
            pass

        async def stop(self):
            pass

    mock_producer = AsyncMock()
    mock_producer.start = AsyncMock()
    mock_producer.stop = AsyncMock()
    mock_producer.send_and_wait = AsyncMock()

    with patch("aiokafka.AIOKafkaConsumer", return_value=AsyncConsumerMock(mock_msg)), \
         patch("aiokafka.AIOKafkaProducer", return_value=mock_producer):
        worker.running = True
        await worker._run_loop()

    assert mock_producer.send_and_wait.called
    topic_sent, kwargs = mock_producer.send_and_wait.call_args[0], mock_producer.send_and_wait.call_args[1]
    assert topic_sent[0] == settings.KAFKA_TOPIC_PROCESSED_DEDUP
    assert kwargs["value"]["report_id"] == "rep-123"

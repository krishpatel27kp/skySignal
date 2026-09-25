#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# SkySignal — Kafka Topic Auto-Provisioning Script
#
# Creates the standard 9 platform topics in Redpanda / Kafka.
# ─────────────────────────────────────────────────────────────────

set -e

BROKER="${KAFKA_BOOTSTRAP_SERVERS:-kafka:29092}"
echo "Provisioning SkySignal Kafka topics against broker: ${BROKER}..."

TOPICS=(
  "raw.social"
  "raw.news"
  "raw.citizen"
  "raw.imd"
  "normalized.reports"
  "processed.dedup"
  "processed.classified"
  "processed.trusted"
  "weather.events"
)

# Attempt provisioning using rpk (Redpanda CLI) if available
if command -v rpk &> /dev/null; then
  echo "Using rpk CLI to create topics..."
  for TOPIC in "${TOPICS[@]}"; do
    echo "Creating topic: ${TOPIC}"
    rpk topic create "${TOPIC}" --brokers "${BROKER}" --partitions 3 --replicas 1 2>/dev/null || true
  done
  echo "Current cluster topics:"
  rpk topic list --brokers "${BROKER}"
else
  # Fallback to python admin client if rpk is not installed
  echo "rpk not found in PATH; falling back to python script..."
  python -m scripts.init_kafka_topics
fi

echo "Kafka topic provisioning completed successfully."

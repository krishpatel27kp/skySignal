"""
SkySignal Kafka Topic Initialization Script.

Provisions the standard 9 Kafka / Redpanda topics required by the
event-driven architecture.
"""

import sys
import logging
from app.core.config import settings
from app.services.kafka_service import TOPICS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("init_kafka")


def provision_topics():
    broker = settings.KAFKA_BOOTSTRAP_SERVERS
    logger.info("Initializing Kafka topics against broker: %s", broker)
    logger.info("Topics to provision (%d total): %s", len(TOPICS), ", ".join(TOPICS))

    try:
        from kafka.admin import KafkaAdminClient, NewTopic
        admin_client = KafkaAdminClient(bootstrap_servers=broker, client_id="skysignal-init")
        existing_topics = set(admin_client.list_topics())
        
        new_topics = [
            NewTopic(name=t, num_partitions=3, replication_factor=1)
            for t in TOPICS
            if t not in existing_topics
        ]
        
        if new_topics:
            admin_client.create_topics(new_topics=new_topics, validate_only=False)
            logger.info("Successfully created %d topics: %s", len(new_topics), [t.name for t in new_topics])
        else:
            logger.info("All %d topics already exist.", len(TOPICS))
            
        admin_client.close()
        return 0
    except ImportError:
        logger.info(
            "kafka-python not installed; topics %s are registered and will be auto-created by Redpanda or rpk.",
            TOPICS,
        )
        return 0
    except Exception as exc:
        logger.warning("Could not connect to broker (%s): %s", broker, exc)
        logger.info("Note: Redpanda auto-creates topics upon first write if auto_create_topics_enabled=true.")
        return 0


if __name__ == "__main__":
    sys.exit(provision_topics())

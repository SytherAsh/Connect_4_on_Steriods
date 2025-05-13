"""
Common configuration settings for all backend services
"""
import os

# Redis configuration
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))

# Service URLs and ports
COORDINATOR_URL = os.environ.get("COORDINATOR_URL", "http://localhost:8000")

COLUMN_NODE_BASE_URL = os.environ.get("COLUMN_NODE_BASE_URL", "http://localhost:{}")
COLUMN_NODE_PORTS = {
    0: 8001,
    1: 8002,
    2: 8003,
    3: 8004,
    4: 8005,
    5: 8006,
    6: 8007,
}

POWER_UP_SERVICE_URL = os.environ.get("POWER_UP_SERVICE_URL", "http://localhost:8010")
RANDOM_EVENT_ENGINE_URL = os.environ.get("RANDOM_EVENT_ENGINE_URL", "http://localhost:8020") 
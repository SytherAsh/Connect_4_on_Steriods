"""
Common configuration settings for all backend services
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv('../env.local')

# Get host IP for network access
HOST_IP = os.environ.get("HOST_IP", "localhost")

# Redis configuration
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))

# Service URLs and ports
COORDINATOR_PORT = int(os.environ.get("COORDINATOR_PORT", 8000))
COORDINATOR_URL = f"http://{HOST_IP}:{COORDINATOR_PORT}"

COLUMN_NODE_BASE_URL = f"http://{HOST_IP}:{{}}"
COLUMN_NODE_PORTS = {
    0: int(os.environ.get("COLUMN_NODE_PORT_0", 8001)),
    1: int(os.environ.get("COLUMN_NODE_PORT_1", 8002)),
    2: int(os.environ.get("COLUMN_NODE_PORT_2", 8003)),
    3: int(os.environ.get("COLUMN_NODE_PORT_3", 8004)),
    4: int(os.environ.get("COLUMN_NODE_PORT_4", 8005)),
    5: int(os.environ.get("COLUMN_NODE_PORT_5", 8006)),
    6: int(os.environ.get("COLUMN_NODE_PORT_6", 8007)),
}

POWER_UP_SERVICE_PORT = int(os.environ.get("POWER_UP_SERVICE_PORT", 8010))
POWER_UP_SERVICE_URL = f"http://{HOST_IP}:{POWER_UP_SERVICE_PORT}"

RANDOM_EVENT_ENGINE_PORT = int(os.environ.get("RANDOM_EVENT_ENGINE_PORT", 8020))
RANDOM_EVENT_ENGINE_URL = f"http://{HOST_IP}:{RANDOM_EVENT_ENGINE_PORT}" 
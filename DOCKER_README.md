# Docker Setup for Connect 4 on Steroids

This guide explains how to run the Connect 4 on Steroids project using Docker containers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

To start the entire application stack:

```bash
docker-compose up -d
```

This command will:
1. Start a RabbitMQ server
2. Build and start the combined backend server with RabbitMQ demo
3. Build and start the frontend application

## Accessing the Application

- Frontend: http://localhost:3000
- RabbitMQ Management UI: http://localhost:15672 (username: guest, password: guest)

## About the Setup

This Docker setup includes:

1. **RabbitMQ Server**: Message broker with management UI
2. **Combined Backend**: Node.js server that includes both:
   - The main game backend
   - The RabbitMQ demo running in "demo" mode (slower events for presentations)
3. **Frontend**: React application served by Nginx

The RabbitMQ demo automatically starts with the backend service, so there's no need to start it separately.

## Port Usage

- **3000**: Frontend application
- **8000**: Backend server
- **5672**: RabbitMQ AMQP protocol (used internally)
- **15672**: RabbitMQ Management UI

If port 5672 is already in use on your system, you can modify the docker-compose.yml file to use a different port:

```yaml
rabbitmq:
  # ...
  ports:
    - "5673:5672"   # Changed from 5672:5672
    - "15672:15672"
```

Then update the RABBITMQ_URL environment variable in the backend service:

```yaml
backend:
  # ...
  environment:
    - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5673
```

## Container Management

### View running containers

```bash
docker-compose ps
```

### View logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs frontend
docker-compose logs backend
docker-compose logs rabbitmq
```

### Restart a service

```bash
docker-compose restart frontend
```

### Stop all services

```bash
docker-compose down
```

### Stop all services and remove volumes

```bash
docker-compose down -v
```

## Rebuilding After Code Changes

If you make changes to the code, you need to rebuild the containers:

```bash
docker-compose build
docker-compose up -d
```

Or for a specific service:

```bash
docker-compose build backend
docker-compose up -d backend
```

## Troubleshooting

### RabbitMQ Connection Issues

If the backend can't connect to RabbitMQ:

1. Check if RabbitMQ is running:
   ```bash
   docker-compose ps rabbitmq
   ```

2. Check RabbitMQ logs:
   ```bash
   docker-compose logs rabbitmq
   ```

3. Restart RabbitMQ:
   ```bash
   docker-compose restart rabbitmq
   ```

### Frontend Can't Connect to Backend

1. Verify the backend is running:
   ```bash
   docker-compose ps backend
   ```

2. Check backend logs for errors:
   ```bash
   docker-compose logs backend
   ```

3. Make sure the WebSocket connection is properly configured in the frontend code.

## Customizing the Demo Mode

If you want to change the RabbitMQ demo mode, you can modify the start.sh script in the Dockerfile.combined file:

```dockerfile
# Change this line in Dockerfile.combined
cd /app/backend/rabbitmq_demo && npm run demo
```

Available options are:
- `npm start` - Standard simulation (frequent events)
- `npm run demo` - Demo simulation (slower events for presentations)
- `npm run continuous` - Continuous simulation with statistics

## Development with Docker

For development, you might want to mount your local code directories into the containers to see changes without rebuilding:

```yaml
# Example modification to docker-compose.yml for development
services:
  frontend:
    # ... other settings
    volumes:
      - ./frontend:/app
    command: npm start
```

## Customizing the Setup

You can modify the `docker-compose.yml` file to:
- Change exposed ports
- Add environment variables
- Add more services
- Configure volume mounts 
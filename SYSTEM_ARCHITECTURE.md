# Connect 4 on Steroids: System Architecture

This document provides a detailed explanation of the Connect 4 on Steroids game architecture, with a focus on the distributed computing model and RabbitMQ integration.

## Table of Contents

1. [Game Overview](#game-overview)
2. [System Architecture](#system-architecture)
3. [Distributed Computing Model](#distributed-computing-model)
4. [RabbitMQ Integration](#rabbitmq-integration)
5. [Service Communication](#service-communication)
6. [Deployment and Scaling](#deployment-and-scaling)

## Game Overview

Connect 4 on Steroids extends the classic Connect 4 game with distributed microservices architecture and exciting features:

- **Multiplayer Gameplay**: Players can join game rooms and compete with others
- **Power-ups**: Special abilities like double drops, column bombs, and gravity flips
- **Random Events**: Unexpected events that change game dynamics during play
- **Real-time Chat**: Communication between players using both WebSockets and RabbitMQ

## System Architecture

The game utilizes a microservices architecture with multiple independent services:

### Core Components

1. **Game Coordinator (Port 8000)**
   - Central orchestration service
   - Manages game rooms, player connections, and turn sequence
   - Coordinates communication between services
   - Handles WebSocket connections for real-time updates

2. **Column Nodes (Ports 8001-8007)**
   - Each column in the game board is managed by a separate microservice
   - Handles piece placement, column state, and special effects
   - Processes column-specific power-ups (blocking, bombing, flipping)
   - Maintains its own state but communicates with the coordinator

3. **Power-up Service (Port 8010)**
   - Manages the power-up inventory and actions
   - Assigns random power-ups to players
   - Processes power-up usage requests
   - Communicates effects to relevant column nodes

4. **Random Event Engine (Port 8020)**
   - Generates unexpected game events
   - Applies global effects to the game board
   - Notifies the coordinator of events for broadcasting

5. **Frontend (Port 3000)**
   - React-based web interface
   - Connects to backend via WebSockets
   - Implements real-time multiplayer using peer-to-peer messaging
   - Renders game board, power-ups, and chat interface

6. **Redis**
   - Used for state persistence
   - Enables pub/sub communication between services
   - Stores game room information and column states

## Distributed Computing Model

The Connect 4 game demonstrates distributed computing principles through its architecture:

### Horizontal Decomposition

The game board is horizontally decomposed, with each column operating as an independent service:

- **Column Independence**: Each column node processes moves independently
- **State Isolation**: Column nodes maintain their own state
- **Parallel Processing**: Multiple moves can be processed simultaneously

### Service Communication

Services communicate through:

1. **HTTP REST API**: For synchronous requests (joining games, making moves)
2. **Redis Pub/Sub**: For state synchronization between services
3. **RabbitMQ**: For event-driven communication and chat messaging

### Fault Tolerance

The system implements fault tolerance through:

- **State Persistence**: Game state is stored in Redis with TTL
- **Service Independence**: Failure of one column node doesn't affect others
- **Message Redundancy**: Critical messages are sent through multiple channels

## RabbitMQ Integration

RabbitMQ serves as the messaging backbone for P2P communication and event processing:

### Exchange and Queue Architecture

1. **Game Events Exchange** (`connect4.events`)
   - Topic exchange for broadcasting game events
   - Routes events based on patterns like `game.start`, `game.move`, `game.end`

2. **Player Notifications Exchange** (`connect4.notifications`)
   - Direct exchange for player-specific notifications
   - Routes messages to player-specific queues

3. **Column Updates Exchange** (`connect4.column_updates`)
   - Topic exchange for column state changes
   - Routes messages based on column ID

4. **Power-ups Exchange** (`connect4.power_ups`)
   - Fanout exchange for power-up events
   - Broadcasts power-up usage to all services

5. **Random Events Exchange** (`connect4.random_events`)
   - Fanout exchange for global game events
   - Broadcasts random events to all services

### Chat Implementation

The RabbitMQ chat solution works as follows:

1. **Topic Exchange**: A topic exchange named `connect4_chat` routes messages based on the room ID
2. **Exclusive Queues**: Each connected client creates a queue that receives messages for their game room
3. **Routing Keys**: Messages use the format `chat.room.[roomId]` to route to the correct recipients
4. **P2P Communication**: Messages are transferred directly between players without going through the game server

### Fallback Mechanism

If RabbitMQ is unavailable, the system falls back to WebSocket-only communication:

- Chat messages are still delivered but marked as "Local Chat" instead of "P2P Chat"
- Game functionality continues to work through the coordinator

## Service Communication

### Coordinator to Column Nodes

1. The Game Coordinator receives player moves via WebSocket
2. It validates the move and identifies the target column
3. It sends an HTTP request to the appropriate Column Node
4. The Column Node processes the move and updates its state
5. The Column Node responds with the result
6. The Coordinator broadcasts the updated game state to all players

### Power-up Flow

1. Player activates a power-up through the UI
2. Request goes to the Coordinator via WebSocket
3. Coordinator forwards the request to the Power-up Service
4. Power-up Service processes the request and determines effects
5. Effects are sent to relevant Column Nodes
6. Column Nodes update their states and respond
7. Coordinator broadcasts the results to all players

### Random Events

1. Random Event Engine periodically generates events
2. Events are sent to the Coordinator
3. Coordinator applies the event effects to the game
4. Affected Column Nodes are updated
5. Event is broadcast to all players

## Deployment and Scaling

The system is designed for flexible deployment:

### Docker Containerization

- Each service is containerized using Docker
- Docker Compose orchestrates the entire system
- Services communicate using Docker network

### Scaling Options

- Column Nodes can be horizontally scaled for multiple simultaneous games
- Game Coordinator can be load-balanced for handling more connections
- Redis and RabbitMQ can be clustered for high availability

### Network Configuration

- Services can be deployed on a single machine using localhost
- For network play, services use the host IP address
- Configuration is managed through environment variables in `env.local`

---

This architecture demonstrates how a seemingly simple game can leverage advanced distributed computing principles to create a scalable, fault-tolerant, and feature-rich multiplayer experience. 
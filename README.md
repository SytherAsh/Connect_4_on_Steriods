# Connect 4 on Steroids

A distributed systems implementation of Connect 4 with special power-ups and random events.

## Overview

Connect 4 on Steroids extends the classic Connect 4 game with distributed microservices architecture and exciting features:

- **Power-ups**: Use special abilities like double drops, column bombs, and gravity flips
- **Random Events**: Unexpected events can change the game dynamics at any time
- **Distributed Architecture**: Backend is composed of microservices running on different ports
- **Real-time Gameplay**: WebSocket-based communication for real-time updates

## System Architecture

The game consists of multiple interconnected services:

- **Column Nodes** (Ports: individual): Manage the state of each column in the game board
- **Game Coordinator** (Port: 8000): Orchestrates the game flow and player actions
- **Power-up Service** (Port: 8010): Manages the power-up inventory and actions
- **Random Event Engine** (Port: 8020): Generates and manages random game events
- **Frontend** (Port: 3000): React-based web interface

## Setup and Running

### Prerequisites

- Python 3.6+
- Node.js 14+
- Redis server

### Quick Start

To start the entire application (backend services and frontend), run:

```bash
./start_game.sh
```

This script will:
1. Check for and start Redis if not running
2. Set up the Python virtual environment
3. Start all backend services
4. Start the React frontend

### Manual Setup

If you prefer to set up services manually:

#### Backend

```bash
# Create and activate virtual environment
python -m venv game
source game/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the services (in separate terminals)
python backend/column_nodes/column_node.py 0  # Repeat for columns 0-6
python -m uvicorn power_up_service.power_up_service:app --host 0.0.0.0 --port 8010
python -m uvicorn random_event_engine.random_event_engine:app --host 0.0.0.0 --port 8020
python -m uvicorn coordinator.coordinator:app --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm start
```

## Gameplay

1. Create or join a game room from the lobby
2. When enough players join, the game can be started
3. Take turns dropping discs into columns
4. Use power-ups during your turn for strategic advantage
5. Watch out for random events that might change the game
6. Connect 4 discs of your color horizontally, vertically, or diagonally to win

## Development

To contribute to the project, first clone the repository:

```bash
git clone <repository-url>
cd connect4-on-steroids
```

Follow the setup instructions above to get the game running locally. 
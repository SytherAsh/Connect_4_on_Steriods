# Connect 4 on Steroids - RabbitMQ Demo

This is a demonstration of how RabbitMQ could be integrated with the Connect 4 on Steroids game for message queuing and event-driven architecture.

## Overview

This demo simulates how the game could use RabbitMQ for:

- Game event broadcasting
- Player move processing
- Column state updates
- Power-up processing
- Random event generation and handling
- Player notifications

## Requirements

- Node.js (v14+)
- RabbitMQ server running locally or accessible via network

## Setup

1. Make sure RabbitMQ is installed and running. If you don't have it installed:
   - **Docker**: `docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management`
   - **Ubuntu**: `sudo apt-get install rabbitmq-server`
   - **Mac**: `brew install rabbitmq`
   - **Windows**: Download from [RabbitMQ website](https://www.rabbitmq.com/download.html)

2. Install dependencies:
   ```
   npm install
   ```

3. Run the demo:
   ```
   npm start
   ```

## Running Options

This demo offers three different ways to run the simulation:

1. **Standard Simulation** - Full simulation with multiple games and frequent events:
   ```
   npm start
   ```

2. **Demo Simulation** - Slower event generation for demonstration purposes (recommended for presentations):
   ```
   npm run demo
   ```
   This mode:
   - Generates events at 5-10 second intervals
   - Uses only a single game with 2 players
   - Provides clearer console output
   - Shows a more controlled sequence of events

3. **Continuous Simulation** - Continuous event generation with statistics:
   ```
   npm run continuous
   ```

## What This Demo Shows

When you run the demo, it will:

1. Connect to RabbitMQ
2. Set up exchanges and queues
3. Create consumers for each queue
4. Simulate a game flow with various events:
   - Game start
   - Player moves
   - Column updates
   - Power-up usage
   - Random events
   - Player notifications
   - Game over

All messages are logged to the console so you can see the flow of events.

## RabbitMQ Management UI

You can access the RabbitMQ Management UI at http://localhost:15672/ (default credentials: guest/guest) to visualize:

- Active connections
- Exchanges
- Queues
- Message rates
- Bindings

## Integration Points

In a real implementation, this RabbitMQ integration would connect to:

1. **Game Coordinator**: Publishing game events and player actions
2. **Column Nodes**: Updating and synchronizing column states
3. **Power-up Service**: Processing power-up effects
4. **Random Event Engine**: Generating and applying random events
5. **Frontend**: Receiving real-time updates via WebSockets

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Game Frontend  │◄────┤  WebSocket API  │◄────┤  Game Events    │
└─────────────────┘     └─────────────────┘     │  Exchange       │
                                               └─────────────────┘
                                                      ▲
                                                      │
┌─────────────────┐     ┌─────────────────┐     ┌─────┴───────────┐
│  Column Nodes   │────►│  Column Updates │────►│  Game           │
└─────────────────┘     │  Exchange       │     │  Coordinator    │
                        └─────────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Power-up       │◄────┤  Power-ups      │◄────┤  Random Event   │
│  Service        │     │  Exchange       │     │  Engine         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Note

This is a demonstration only and is not actually integrated with the Connect 4 on Steroids game. It shows how RabbitMQ could be used to enhance the game's architecture for better scalability, reliability, and real-time event processing. 
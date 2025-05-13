# Connect 4 on Steroids - Multiplayer Setup Guide

This document explains how to set up and run Connect 4 on Steroids in multiplayer mode, allowing players to play from different devices and chat with each other using RabbitMQ.

## Prerequisites

- Node.js 14+ and npm installed on all machines
- RabbitMQ server installed and running
- The Connect 4 on Steroids game code

## RabbitMQ Installation

### Option 1: Install RabbitMQ locally

1. **Install RabbitMQ Server**:
   - **Ubuntu/Debian**: `sudo apt-get install rabbitmq-server`
   - **MacOS**: `brew install rabbitmq`
   - **Windows**: Download and install from [RabbitMQ website](https://www.rabbitmq.com/download.html)

2. **Start RabbitMQ Service**:
   - **Ubuntu/Debian**: `sudo service rabbitmq-server start`
   - **MacOS**: `brew services start rabbitmq`
   - **Windows**: RabbitMQ service should start automatically after installation

3. **Enable the Management Plugin** (optional but recommended):
   ```
   rabbitmq-plugins enable rabbitmq_management
   ```
   This provides a web interface at http://localhost:15672 (username: guest, password: guest)

### Option 2: Use a Cloud RabbitMQ Service

Alternatively, you can use a cloud service like:
- [CloudAMQP](https://www.cloudamqp.com/) (offers a free plan)
- [RabbitMQ on AWS](https://aws.amazon.com/mq/)
- [RabbitMQ on Azure](https://azure.microsoft.com/en-us/services/service-bus/)

## Setting Up the Game for Multiplayer

1. **Configure RabbitMQ URL**:

   Create a `.env` file in the frontend directory with the following content:
   ```
   REACT_APP_RABBITMQ_URL=amqp://username:password@hostname:port
   ```
   
   If running RabbitMQ locally with default settings, use:
   ```
   REACT_APP_RABBITMQ_URL=amqp://guest:guest@localhost:5672
   ```

2. **Install Dependencies**:
   ```
   cd connect4-on-steroids/frontend
   npm install
   ```

3. **Start the Frontend**:
   ```
   npm start
   ```

4. **Start the Backend Services**:
   Follow the regular instructions for starting the backend services.

## How Multiplayer Works

### Network Architecture

1. **Game State Synchronization**:
   - The game state (board positions, turns, etc.) is synchronized through WebSockets connected to the backend.
   - This ensures all players see the same game state.

2. **Chat Messaging**:
   - Chat messages are sent in two ways:
     - Through WebSockets to update game state (for consistency)
     - Through RabbitMQ for peer-to-peer communication between different devices

### RabbitMQ Integration

The game uses RabbitMQ for chat messaging with the following design:

1. **Exchange**: A topic exchange named `connect4_chat` routes messages based on the room ID.
2. **Queues**: Each connected client creates an exclusive queue that receives messages for their game room.
3. **Routing Keys**: Messages use the format `chat.room.[roomId]` to route to the correct recipients.

The RabbitMQ service handles:
- Connecting to the RabbitMQ server
- Creating/joining chat rooms (by binding to the appropriate routing key)
- Sending and receiving messages
- Cleaning up connections when leaving

## Playing in Multiplayer Mode

1. **Create a Game Room**:
   - One player creates a room in the lobby
   - Share the room code or URL with other players

2. **Join Game**:
   - Other players join using the shared code/URL
   - All players will connect to the same game state via WebSockets

3. **Chat During Play**:
   - Use the chat panel to communicate with other players
   - Messages are sent via RabbitMQ and displayed with a "P2P" badge
   - If RabbitMQ is disconnected, chat falls back to WebSocket-only mode

## Troubleshooting

### RabbitMQ Connection Issues

If you see "Local Chat" instead of "P2P Chat" in the chat panel:

1. Verify your RabbitMQ server is running:
   ```
   rabbitmqctl status
   ```

2. Check the connection URL in `.env` file:
   - Ensure hostname, port, username, and password are correct
   - Try connecting with the RabbitMQ Management UI to verify credentials

3. Check console for errors:
   - Open browser developer tools to see connection error details

### Cross-Origin Issues

If you're hosting the game and RabbitMQ on different domains:

1. Configure CORS for the RabbitMQ Web STOMP plugin if you're using it
2. Ensure your RabbitMQ server allows connections from your game's domain

## Security Considerations

For production deployment:

1. **Don't use default credentials**:
   - Create a dedicated RabbitMQ user with limited permissions
   
2. **Enable SSL**:
   - Configure RabbitMQ to use SSL/TLS
   - Update your connection URL to use `amqps://` instead of `amqp://`

3. **Implement Authentication**:
   - Add user authentication to prevent unauthorized access to chat rooms 
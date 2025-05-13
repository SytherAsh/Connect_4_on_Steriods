# RabbitMQ Integration for Multiplayer Support

## Changes Made

1. **Added RabbitMQ Client**
   - Installed `amqplib` package for RabbitMQ communication
   - Created a RabbitMQ service to handle messaging between devices

2. **Created RabbitMQ Service**
   - Implemented in `src/services/RabbitMQService.ts`
   - Provides methods for connecting to RabbitMQ, joining chat rooms, sending messages, and cleanup
   - Uses topic exchanges for routing messages to the correct game rooms

3. **Enhanced GameChat Component**
   - Modified to support both WebSocket and RabbitMQ message channels
   - Added visual indicators to show RabbitMQ connection status
   - Implemented message source tracking to distinguish between regular and P2P messages

4. **Updated GamePage Component**
   - Added roomId parameter to GameChat component for RabbitMQ channel creation

5. **Added Configuration**
   - Created example environment file for RabbitMQ connection settings

## How It Works

1. When a player joins a game, the chat component:
   - Connects to the RabbitMQ server
   - Creates a unique queue for the player's session
   - Binds that queue to the game room's topic

2. When a player sends a message:
   - The message is sent through WebSocket for game state consistency
   - The message is also published to RabbitMQ for direct P2P communication

3. When a message is received:
   - It's displayed in the chat with a badge indicating its source (P2P or WebSocket)
   - Messages are merged from both sources and sorted by timestamp

4. When a player leaves:
   - The RabbitMQ connection is properly cleaned up
   - The queue is automatically deleted (due to exclusive flag)

## Benefits

1. **True Peer-to-Peer Communication**
   - Messages can be exchanged directly between clients without all data passing through the game server
   - Demonstrates understanding of different messaging patterns

2. **Fault Tolerance**
   - Chat continues to work through WebSockets even if RabbitMQ connection fails
   - Visual indicators show users the current connection status

3. **Scalability**
   - RabbitMQ's architecture allows for high volume message handling
   - Topic-based routing ensures messages only go to relevant recipients

## Testing

To test the multiplayer functionality:

1. Run the game on two different devices connected to the same network
2. Make sure both devices can reach the RabbitMQ server
3. Create/join the same game room on both devices
4. Send chat messages and observe the "P2P" badge on received messages
5. If one device disconnects from RabbitMQ, chat should still work (via WebSockets) but without the P2P badges

## Future Improvements

1. **Message Queue Persistence**
   - Store messages when players are offline and deliver them when they reconnect

2. **Private Messaging**
   - Implement direct messaging between specific players using more specific routing keys

3. **Typing Indicators**
   - Add real-time typing indicators using RabbitMQ's pub/sub model 
#!/usr/bin/env python3
import socketio
import asyncio
import json
import time
import uuid

# Set up the Socket.IO client
sio = socketio.AsyncClient(logger=True, engineio_logger=True)

# Define event handlers
@sio.event
async def connect():
    print("Connected to Socket.IO server!")

@sio.event
async def disconnect():
    print("Disconnected from Socket.IO server")

@sio.event
async def connect_error(error):
    print(f"Connection error: {error}")

@sio.event
async def joined_game(data):
    print(f"Successfully joined game! Response: {data}")

@sio.event
async def error(data):
    print(f"Error from server: {data}")

# Other event handlers
@sio.on('*')
async def catch_all(event, data):
    print(f"Received event '{event}' with data: {data}")

async def main():
    # Connect to the Socket.IO server
    await sio.connect('http://localhost:8000')
    
    # Generate test player and room IDs
    player_id = str(uuid.uuid4())
    room_id = str(uuid.uuid4())
    
    print(f"Test player ID: {player_id}")
    print(f"Test room ID: {room_id}")
    
    # Join the game
    await sio.emit('join_game', {
        'player_id': player_id,
        'room_id': room_id
    })
    
    # Wait a moment for the server to process the join
    await asyncio.sleep(2)
    
    # Test power-ups request
    print("Requesting power-ups...")
    await sio.emit('get_power_ups', {
        'room_id': room_id,
        'player_id': player_id,
        'request_id': f'test_{int(time.time())}'
    })
    
    # Wait for responses
    await asyncio.sleep(5)
    
    # Disconnect
    await sio.disconnect()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Test interrupted by user")
    except Exception as e:
        print(f"Error during test: {e}") 
import asyncio
import json
import uuid
from typing import Dict, List, Optional, Set

import redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import time
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import REDIS_HOST, REDIS_PORT, REDIS_DB, COLUMN_NODE_BASE_URL, COLUMN_NODE_PORTS, POWER_UP_SERVICE_URL, RANDOM_EVENT_ENGINE_URL

# Initialize Redis client
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)

# Initialize FastAPI app
app = FastAPI(title="Connect 4 on Steroids - Game Coordinator")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Player(BaseModel):
    id: str
    name: str
    color: str

class Room(BaseModel):
    id: str
    name: str
    players: List[Player] = []
    max_players: int = 4
    is_active: bool = False
    current_turn: Optional[str] = None
    board_state: Dict = {}
    column_nodes: Dict[int, str] = {}  # column_id -> node_url
    created_at: float = time.time()
    random_events_enabled: bool = False

# In-memory store for active connections and game rooms
active_connections: Dict[str, WebSocket] = {}
rooms: Dict[str, Room] = {}

# Column node service URLs
COLUMN_NODE_BASE_URL = "http://localhost:{}"
COLUMN_NODE_PORTS = {
    0: 8001,
    1: 8002,
    2: 8003,
    3: 8004,
    4: 8005,
    5: 8006,
    6: 8007,
}

# Other service URLs
POWER_UP_SERVICE_URL = "http://localhost:8010"
RANDOM_EVENT_ENGINE_URL = "http://localhost:8020"

# WebSocket connection manager
class ConnectionManager:
    async def connect(self, websocket: WebSocket, player_id: str):
        await websocket.accept()
        active_connections[player_id] = websocket
    
    async def disconnect(self, player_id: str):
        if player_id in active_connections:
            del active_connections[player_id]
    
    async def send_personal_message(self, message: dict, player_id: str):
        if player_id in active_connections:
            await active_connections[player_id].send_json(message)
    
    async def broadcast_to_room(self, message: dict, room_id: str):
        room = rooms.get(room_id)
        if room:
            for player in room.players:
                await self.send_personal_message(message, player.id)

manager = ConnectionManager()

# Routes
@app.get("/")
async def root():
    return {"message": "Connect 4 on Steroids Game Coordinator"}

@app.get("/rooms")
async def get_rooms():
    return {"rooms": list(rooms.values())}

@app.post("/rooms")
async def create_room(room_data: dict):
    room_id = str(uuid.uuid4())
    new_room = Room(
        id=room_id,
        name=room_data.get("name", f"Game Room {len(rooms) + 1}"),
        max_players=room_data.get("max_players", 4),
        random_events_enabled=room_data.get("random_events_enabled", False)
    )
    
    # Assign column nodes
    for col_id, port in COLUMN_NODE_PORTS.items():
        new_room.column_nodes[col_id] = COLUMN_NODE_BASE_URL.format(port)
    
    rooms[room_id] = new_room
    return {"room": new_room}

@app.post("/rooms/{room_id}/join")
async def join_room(room_id: str, player_data: dict):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    if len(room.players) >= room.max_players:
        raise HTTPException(status_code=400, detail="Room is full")
    
    if room.is_active:
        raise HTTPException(status_code=400, detail="Game already started")
    
    player_id = str(uuid.uuid4())
    player = Player(
        id=player_id,
        name=player_data.get("name", f"Player {len(room.players) + 1}"),
        color=player_data.get("color", get_next_color(room))
    )
    
    room.players.append(player)
    
    # Broadcast to all players in the room that a new player joined
    await manager.broadcast_to_room(
        {"type": "player_joined", "player": player.dict()},
        room_id
    )
    
    return {"player": player, "room": room}

@app.post("/rooms/{room_id}/start")
async def start_game(room_id: str):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    if len(room.players) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start")
    
    if room.is_active:
        raise HTTPException(status_code=400, detail="Game already started")
    
    # Initialize the game
    room.is_active = True
    room.current_turn = room.players[0].id
    
    # Initialize column states through column nodes
    for col_id, node_url in room.column_nodes.items():
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{node_url}/init",
                    json={"room_id": room_id, "column_id": col_id}
                )
        except Exception as e:
            print(f"Error initializing column {col_id}: {e}")
    
    # Initialize power-ups for each player
    try:
        async with httpx.AsyncClient() as client:
            for player in room.players:
                await client.post(
                    f"{POWER_UP_SERVICE_URL}/initialize",
                    json={"room_id": room_id, "player_id": player.id}
                )
    except Exception as e:
        print(f"Error initializing power-ups: {e}")
    
    # Initialize random events if enabled
    if room.random_events_enabled:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{RANDOM_EVENT_ENGINE_URL}/initialize",
                    json={"room_id": room_id}
                )
        except Exception as e:
            print(f"Error initializing random events: {e}")
    
    # Broadcast game start to all players
    await manager.broadcast_to_room(
        {
            "type": "game_started",
            "room": room.dict(),
            "current_turn": room.current_turn
        },
        room_id
    )
    
    return {"status": "game_started", "room": room}

@app.post("/events/notify")
async def notify_event(event_data: dict):
    """Handle notifications from the random event engine."""
    room_id = event_data.get("room_id")
    event = event_data.get("event")
    effect_result = event_data.get("effect_result")
    
    if not room_id or not event:
        raise HTTPException(status_code=400, detail="Room ID and event are required")
    
    # Check if room exists
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    # Only process if random events are enabled for this room
    if not room.random_events_enabled:
        return {"success": False, "message": "Random events are disabled for this room"}
    
    # Broadcast the event to all players in the room
    await manager.broadcast_to_room(
        {
            "type": "random_event",
            "event": event,
            "effect_result": effect_result
        },
        room_id
    )
    
    return {"success": True, "message": "Event notification sent"}

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await manager.connect(websocket, player_id)
    
    # Find the room this player is in
    player_room = None
    for room_id, room in rooms.items():
        if any(player.id == player_id for player in room.players):
            player_room = room
            break
    
    if not player_room:
        await websocket.close(code=1000, reason="Player not found in any room")
        return
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Process different message types
            message_type = data.get("type")
            
            if message_type == "move":
                # Validate if it's the player's turn
                if player_room.current_turn != player_id:
                    await manager.send_personal_message(
                        {"type": "error", "message": "Not your turn"},
                        player_id
                    )
                    continue
                
                # Process the move through the appropriate column node
                column_id = data.get("column")
                if column_id not in player_room.column_nodes:
                    await manager.send_personal_message(
                        {"type": "error", "message": "Invalid column"},
                        player_id
                    )
                    continue
                
                # Forward the move to the column node
                try:
                    column_url = player_room.column_nodes[column_id]
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{column_url}/drop",
                            json={
                                "room_id": player_room.id,
                                "player_id": player_id,
                                "column_id": column_id
                            }
                        )
                        result = response.json()
                        
                        # Update game state
                        if result.get("success"):
                            # Check for a win
                            win_status = check_win_condition(player_room.id)
                            
                            if win_status.get("winner"):
                                # Game over, notify everyone
                                await manager.broadcast_to_room(
                                    {
                                        "type": "game_over",
                                        "winner": win_status.get("winner"),
                                        "win_type": win_status.get("win_type")
                                    },
                                    player_room.id
                                )
                                player_room.is_active = False
                            else:
                                # Move to next player's turn
                                next_player_index = (
                                    [p.id for p in player_room.players].index(player_id) + 1
                                ) % len(player_room.players)
                                next_player_id = player_room.players[next_player_index].id
                                player_room.current_turn = next_player_id
                                
                                # Notify random event engine about the turn completion
                                if player_room.random_events_enabled:
                                    try:
                                        await client.post(
                                            f"{RANDOM_EVENT_ENGINE_URL}/turn_completed",
                                            json={
                                                "room_id": player_room.id,
                                                "player_id": player_id,
                                                "next_player_id": next_player_id
                                            }
                                        )
                                    except Exception as e:
                                        print(f"Error notifying random event engine: {e}")
                                
                                # Broadcast the updated state
                                await manager.broadcast_to_room(
                                    {
                                        "type": "move_made",
                                        "player_id": player_id,
                                        "column": column_id,
                                        "row": result.get("row"),
                                        "next_turn": player_room.current_turn
                                    },
                                    player_room.id
                                )
                        else:
                            await manager.send_personal_message(
                                {"type": "error", "message": result.get("message", "Move failed")},
                                player_id
                            )
                except Exception as e:
                    print(f"Error processing move: {e}")
                    await manager.send_personal_message(
                        {"type": "error", "message": "Server error processing move"},
                        player_id
                    )
            
            elif message_type == "power_up":
                # Process power-up request
                power_up_id = data.get("power_up_id")
                target_data = data.get("target_data", {})
                
                if not power_up_id:
                    await manager.send_personal_message(
                        {"type": "error", "message": "Power-up ID is required"},
                        player_id
                    )
                    continue
                
                # Forward the request to the power-up service
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{POWER_UP_SERVICE_URL}/use",
                            json={
                                "room_id": player_room.id,
                                "player_id": player_id,
                                "power_up_id": power_up_id,
                                "target_data": target_data
                            }
                        )
                        result = response.json()
                        
                        if result.get("success"):
                            # Broadcast the power-up effect to all players
                            await manager.broadcast_to_room(
                                {
                                    "type": "power_up_used",
                                    "player_id": player_id,
                                    "power_up_id": power_up_id,
                                    "effect": result.get("effect", {}),
                                    "remaining_uses": result.get("power_up", {}).get("remaining_uses", 0)
                                },
                                player_room.id
                            )
                        else:
                            await manager.send_personal_message(
                                {"type": "error", "message": result.get("message", "Failed to use power-up")},
                                player_id
                            )
                except Exception as e:
                    print(f"Error processing power-up: {e}")
                    await manager.send_personal_message(
                        {"type": "error", "message": "Server error processing power-up"},
                        player_id
                    )
            
            elif message_type == "chat":
                # Broadcast chat message to all players in the room
                await manager.broadcast_to_room(
                    {
                        "type": "chat",
                        "player_id": player_id,
                        "message": data.get("message", "")
                    },
                    player_room.id
                )
    
    except WebSocketDisconnect:
        await manager.disconnect(player_id)
        
        # If game is active, handle player disconnection
        if player_room and player_room.is_active:
            # Remove player from the game
            player_room.players = [p for p in player_room.players if p.id != player_id]
            
            # If no players left, clean up the room
            if not player_room.players:
                if player_room.id in rooms:
                    del rooms[player_room.id]
            else:
                # If it was the disconnected player's turn, move to the next player
                if player_room.current_turn == player_id:
                    next_player_index = 0  # Default to first player
                    player_room.current_turn = player_room.players[next_player_index].id
                
                # Notify remaining players
                await manager.broadcast_to_room(
                    {
                        "type": "player_left",
                        "player_id": player_id,
                        "current_turn": player_room.current_turn
                    },
                    player_room.id
                )
    
    except Exception as e:
        print(f"WebSocket error: {e}")
        await manager.disconnect(player_id)

def get_next_color(room: Room) -> str:
    """Get the next available color for a new player."""
    used_colors = [player.color for player in room.players]
    available_colors = ["red", "yellow", "green", "blue"]
    
    for color in available_colors:
        if color not in used_colors:
            return color
    
    return "purple"  # Default if all colors are taken

def check_win_condition(room_id: str) -> dict:
    """Check if there's a win condition in the current game state."""
    # Fetch all column states
    column_states = {}
    for col_id, port in COLUMN_NODE_PORTS.items():
        try:
            # Synchronous HTTP request for simplicity in this function
            node_url = COLUMN_NODE_BASE_URL.format(port)
            response = httpx.get(
                f"{node_url}/state/{room_id}",
                timeout=2.0
            )
            if response.status_code == 200:
                column_state = response.json().get("column_state", {})
                column_states[col_id] = column_state.get("cells", [])
        except Exception as e:
            print(f"Error fetching column {col_id} state: {e}")
    
    if not column_states:
        return {"winner": None, "win_type": None}
    
    # Create a 2D board representation for easier win checking
    # Initialize with None
    NUM_ROWS = 6  # Standard Connect 4 height
    NUM_COLS = 7  # Standard Connect 4 width
    board = [[None for _ in range(NUM_ROWS)] for _ in range(NUM_COLS)]
    
    # Fill the board with the current state
    for col_id, cells in column_states.items():
        col_id = int(col_id)  # Ensure column ID is an integer
        for row_id, cell in enumerate(cells):
            if row_id < NUM_ROWS:
                board[col_id][row_id] = cell
    
    # Check horizontal wins (row by row)
    for row in range(NUM_ROWS):
        for col in range(NUM_COLS - 3):  # Only need to check starting positions 0-3
            if (board[col][row] is not None and
                board[col][row] == board[col+1][row] and
                board[col+1][row] == board[col+2][row] and
                board[col+2][row] == board[col+3][row]):
                return {
                    "winner": board[col][row],
                    "win_type": "horizontal",
                    "positions": [(col, row), (col+1, row), (col+2, row), (col+3, row)]
                }
    
    # Check vertical wins (column by column)
    for col in range(NUM_COLS):
        for row in range(NUM_ROWS - 3):  # Only need to check starting positions 0-2
            if (board[col][row] is not None and
                board[col][row] == board[col][row+1] and
                board[col][row+1] == board[col][row+2] and
                board[col][row+2] == board[col][row+3]):
                return {
                    "winner": board[col][row],
                    "win_type": "vertical",
                    "positions": [(col, row), (col, row+1), (col, row+2), (col, row+3)]
                }
    
    # Check diagonal wins (rising: bottom-left to top-right)
    for col in range(NUM_COLS - 3):  # Only need to check columns 0-3
        for row in range(3, NUM_ROWS):  # Only need to check rows 3-5
            if (board[col][row] is not None and
                board[col][row] == board[col+1][row-1] and
                board[col+1][row-1] == board[col+2][row-2] and
                board[col+2][row-2] == board[col+3][row-3]):
                return {
                    "winner": board[col][row],
                    "win_type": "diagonal_rising",
                    "positions": [(col, row), (col+1, row-1), (col+2, row-2), (col+3, row-3)]
                }
    
    # Check diagonal wins (falling: top-left to bottom-right)
    for col in range(NUM_COLS - 3):  # Only need to check columns 0-3
        for row in range(NUM_ROWS - 3):  # Only need to check rows 0-2
            if (board[col][row] is not None and
                board[col][row] == board[col+1][row+1] and
                board[col+1][row+1] == board[col+2][row+2] and
                board[col+2][row+2] == board[col+3][row+3]):
                return {
                    "winner": board[col][row],
                    "win_type": "diagonal_falling",
                    "positions": [(col, row), (col+1, row+1), (col+2, row+2), (col+3, row+3)]
                }
    
    # Check for a draw (all columns full)
    all_full = True
    for col in range(NUM_COLS):
        if None in board[col]:
            all_full = False
            break
    
    if all_full:
        return {"winner": "draw", "win_type": "draw"}
    
    # No win condition found
    return {"winner": None, "win_type": None}

# Additional helper functions and endpoints to be implemented
# - Power-up management
# - Random events
# - Game state persistence
# - Matchmaking
# - Leaderboard

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 
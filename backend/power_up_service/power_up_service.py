import asyncio
import json
import redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import httpx

# Initialize Redis client for state persistence
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Initialize FastAPI app
app = FastAPI(title="Connect 4 on Steroids - Power-Up Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class PowerUp(BaseModel):
    id: str
    name: str
    description: str
    remaining_uses: int

class PlayerPowerUps(BaseModel):
    player_id: str
    power_ups: Dict[str, PowerUp] = {}

# In-memory store for player power-ups per room
room_player_power_ups: Dict[str, Dict[str, PlayerPowerUps]] = {}

# Column node service URLs (for power-up effects)
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

# Power-up definitions
POWER_UP_TYPES = {
    "double_drop": {
        "name": "Double Drop",
        "description": "Place two discs in one turn",
        "initial_uses": 1
    },
    "undo_move": {
        "name": "Undo Move",
        "description": "Undo the last move",
        "initial_uses": 1
    },
    "column_bomb": {
        "name": "Column Bomb",
        "description": "Remove all discs from a column",
        "initial_uses": 1
    },
    "column_block": {
        "name": "Column Block",
        "description": "Block a column for 1 turn",
        "initial_uses": 1
    },
    "gravity_flip": {
        "name": "Gravity Flip",
        "description": "Flip gravity in a column",
        "initial_uses": 1
    },
    "steal_column": {
        "name": "Steal Column",
        "description": "Take control of a column for 1 turn",
        "initial_uses": 1
    }
}

# Routes
@app.get("/")
async def root():
    return {"message": "Connect 4 on Steroids Power-Up Service"}

@app.post("/initialize")
async def initialize_player_power_ups(data: dict):
    """Initialize power-ups for a player in a room."""
    room_id = data.get("room_id")
    player_id = data.get("player_id")
    
    if not room_id or not player_id:
        raise HTTPException(status_code=400, detail="Room ID and player ID are required")
    
    # Initialize player's power-ups
    player_power_ups = PlayerPowerUps(
        player_id=player_id,
        power_ups={}
    )
    
    # Assign initial power-ups
    for power_up_id, power_up_info in POWER_UP_TYPES.items():
        player_power_ups.power_ups[power_up_id] = PowerUp(
            id=power_up_id,
            name=power_up_info["name"],
            description=power_up_info["description"],
            remaining_uses=power_up_info["initial_uses"]
        )
    
    # Store in Redis with TTL (24 hours)
    redis_key = f"room:{room_id}:player:{player_id}:power_ups"
    redis_client.setex(redis_key, 86400, json.dumps(player_power_ups.dict()))
    
    # Store in memory
    if room_id not in room_player_power_ups:
        room_player_power_ups[room_id] = {}
    
    room_player_power_ups[room_id][player_id] = player_power_ups
    
    return {"status": "initialized", "player_id": player_id, "power_ups": player_power_ups}

@app.get("/player/{room_id}/{player_id}")
async def get_player_power_ups(room_id: str, player_id: str):
    """Get the power-ups available for a player."""
    # Try to get from memory first
    if room_id in room_player_power_ups and player_id in room_player_power_ups[room_id]:
        return {"power_ups": room_player_power_ups[room_id][player_id]}
    
    # If not in memory, try to get from Redis
    redis_key = f"room:{room_id}:player:{player_id}:power_ups"
    power_ups_json = redis_client.get(redis_key)
    
    if power_ups_json:
        power_ups_dict = json.loads(power_ups_json)
        player_power_ups = PlayerPowerUps(**power_ups_dict)
        
        # Cache in memory
        if room_id not in room_player_power_ups:
            room_player_power_ups[room_id] = {}
        room_player_power_ups[room_id][player_id] = player_power_ups
        
        return {"power_ups": player_power_ups}
    
    raise HTTPException(status_code=404, detail="Power-ups not found for this player")

@app.post("/use")
async def use_power_up(data: dict):
    """Use a power-up."""
    room_id = data.get("room_id")
    player_id = data.get("player_id")
    power_up_id = data.get("power_up_id")
    target_data = data.get("target_data", {})
    
    if not room_id or not player_id or not power_up_id:
        raise HTTPException(status_code=400, detail="Room ID, player ID, and power-up ID are required")
    
    # Get player's power-ups
    if room_id not in room_player_power_ups or player_id not in room_player_power_ups[room_id]:
        # Try to get from Redis
        redis_key = f"room:{room_id}:player:{player_id}:power_ups"
        power_ups_json = redis_client.get(redis_key)
        
        if power_ups_json:
            power_ups_dict = json.loads(power_ups_json)
            player_power_ups = PlayerPowerUps(**power_ups_dict)
            
            if room_id not in room_player_power_ups:
                room_player_power_ups[room_id] = {}
            room_player_power_ups[room_id][player_id] = player_power_ups
        else:
            raise HTTPException(status_code=404, detail="Power-ups not found for this player")
    
    player_power_ups = room_player_power_ups[room_id][player_id]
    
    # Check if the player has the power-up
    if power_up_id not in player_power_ups.power_ups:
        raise HTTPException(status_code=400, detail=f"Player does not have the {power_up_id} power-up")
    
    power_up = player_power_ups.power_ups[power_up_id]
    
    # Check if the player has any uses left
    if power_up.remaining_uses <= 0:
        raise HTTPException(status_code=400, detail=f"No uses remaining for {power_up.name}")
    
    # Apply the power-up effect based on its type
    result = await apply_power_up_effect(power_up_id, room_id, player_id, target_data)
    
    if result.get("success"):
        # Decrement the remaining uses
        power_up.remaining_uses -= 1
        
        # Update in Redis
        redis_key = f"room:{room_id}:player:{player_id}:power_ups"
        redis_client.setex(redis_key, 86400, json.dumps(player_power_ups.dict()))
        
        return {
            "success": True,
            "power_up": power_up,
            "effect": result
        }
    else:
        return {
            "success": False,
            "message": result.get("message", "Failed to apply power-up effect")
        }

async def apply_power_up_effect(power_up_id: str, room_id: str, player_id: str, target_data: dict):
    """Apply the effect of a power-up."""
    if power_up_id == "double_drop":
        # Double Drop allows a player to place two discs in one turn
        column1 = target_data.get("column1")
        column2 = target_data.get("column2")
        
        if column1 is None or column2 is None:
            return {"success": False, "message": "Two column indices are required for Double Drop"}
        
        # Apply drops to both columns
        async with httpx.AsyncClient() as client:
            try:
                response1 = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column1])}/drop",
                    json={
                        "room_id": room_id,
                        "player_id": player_id,
                        "column_id": column1
                    }
                )
                
                result1 = response1.json()
                
                if not result1.get("success"):
                    return {"success": False, "message": f"First drop failed: {result1.get('message')}"}
                
                response2 = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column2])}/drop",
                    json={
                        "room_id": room_id,
                        "player_id": player_id,
                        "column_id": column2
                    }
                )
                
                result2 = response2.json()
                
                if not result2.get("success"):
                    return {"success": False, "message": f"Second drop failed: {result2.get('message')}"}
                
                return {
                    "success": True,
                    "drop1": result1,
                    "drop2": result2
                }
            except Exception as e:
                return {"success": False, "message": f"Error: {str(e)}"}
    
    elif power_up_id == "column_bomb":
        # Column Bomb removes all discs from a column
        column = target_data.get("column")
        
        if column is None:
            return {"success": False, "message": "Column index is required for Column Bomb"}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column])}/power-up/bomb",
                    json={
                        "room_id": room_id
                    }
                )
                
                return response.json()
            except Exception as e:
                return {"success": False, "message": f"Error: {str(e)}"}
    
    elif power_up_id == "column_block":
        # Block a column for 1 turn
        column = target_data.get("column")
        
        if column is None:
            return {"success": False, "message": "Column index is required for Column Block"}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column])}/power-up/block",
                    json={
                        "room_id": room_id,
                        "turns": 1
                    }
                )
                
                return response.json()
            except Exception as e:
                return {"success": False, "message": f"Error: {str(e)}"}
    
    elif power_up_id == "gravity_flip":
        # Flip gravity in a column
        column = target_data.get("column")
        
        if column is None:
            return {"success": False, "message": "Column index is required for Gravity Flip"}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column])}/power-up/flip",
                    json={
                        "room_id": room_id
                    }
                )
                
                return response.json()
            except Exception as e:
                return {"success": False, "message": f"Error: {str(e)}"}
    
    elif power_up_id == "undo_move":
        # Undo the last move (implementation would require a move history to be maintained)
        # TODO: Implement a proper undo mechanism
        return {"success": False, "message": "Undo Move is not implemented yet"}
    
    elif power_up_id == "steal_column":
        # Steal a column for 1 turn (implementation would require column ownership tracking)
        # TODO: Implement column stealing mechanism
        return {"success": False, "message": "Steal Column is not implemented yet"}
    
    else:
        return {"success": False, "message": f"Unknown power-up: {power_up_id}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010) 
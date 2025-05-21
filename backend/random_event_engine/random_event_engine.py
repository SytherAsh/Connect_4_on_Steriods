import asyncio
import json
import random
import redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import httpx
import time

# Initialize Redis client for state persistence
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Initialize FastAPI app
app = FastAPI(title="Connect 4 on Steroids - Random Event Engine")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class RandomEvent(BaseModel):
    id: str
    name: str
    description: str
    effect: str
    duration: int  # in turns

class ActiveEvent(BaseModel):
    event: RandomEvent
    active_until: int  # turn number when it expires
    affected_columns: List[int] = []
    affected_players: List[str] = []

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

# Coordinator URL
COORDINATOR_URL = "http://localhost:8000"

# Random event definitions
RANDOM_EVENTS = {
    "earthquake": {
        "name": "Earthquake",
        "description": "Shuffles the discs in random columns",
        "effect": "shuffle_columns",
        "duration": 1,
        "probability": 0.15
    },
    "blackout": {
        "name": "Blackout",
        "description": "Hides the board UI for a limited time",
        "effect": "hide_ui",
        "duration": 2,
        "probability": 0.1
    },
    "speed_round": {
        "name": "Speed Round",
        "description": "Players have only 5 seconds to make a move",
        "effect": "speed_limit",
        "duration": 3,
        "probability": 0.2
    },
    "power_surge": {
        "name": "Power Surge",
        "description": "All players get a random power-up",
        "effect": "give_power_ups",
        "duration": 1,
        "probability": 0.1
    },
    "column_swap": {
        "name": "Column Swap",
        "description": "Two random columns swap positions",
        "effect": "swap_columns",
        "duration": 1,
        "probability": 0.15
    },
    "reverse_gravity": {
        "name": "Reverse Gravity",
        "description": "All columns have reversed gravity",
        "effect": "reverse_all_gravity",
        "duration": 2,
        "probability": 0.1
    }
}

# In-memory store for active events per room
active_room_events: Dict[str, List[ActiveEvent]] = {}
# Store for room turn counts
room_turn_counts: Dict[str, int] = {}

# Routes
@app.get("/")
async def root():
    return {"message": "Connect 4 on Steroids Random Event Engine"}

@app.post("/initialize")
async def initialize_room(data: dict):
    """Initialize random events for a room."""
    room_id = data.get("room_id")
    
    if not room_id:
        raise HTTPException(status_code=400, detail="Room ID is required")
    
    # Initialize room with no active events
    active_room_events[room_id] = []
    room_turn_counts[room_id] = 0
    
    # Store in Redis with TTL (24 hours)
    redis_key = f"room:{room_id}:random_events"
    redis_client.setex(redis_key, 86400, json.dumps([]))
    
    return {"status": "initialized", "room_id": room_id}

@app.post("/turn_completed")
async def turn_completed(data: dict):
    """Process a completed turn and potentially trigger a random event."""
    room_id = data.get("room_id")
    current_player_id = data.get("player_id")
    next_player_id = data.get("next_player_id")
    
    if not room_id or not current_player_id or not next_player_id:
        raise HTTPException(status_code=400, detail="Room ID, current player ID, and next player ID are required")
    
    # Increment turn count
    if room_id in room_turn_counts:
        room_turn_counts[room_id] += 1
    else:
        room_turn_counts[room_id] = 1
    
    current_turn = room_turn_counts[room_id]
    
    # Check and expire active events
    if room_id in active_room_events:
        active_room_events[room_id] = [
            event for event in active_room_events[room_id]
            if event.active_until > current_turn
        ]
    
    # Roll for a random event (only after a few turns have passed)
    event_triggered = None
    if current_turn > 3:  # Give players some time before chaos ensues
        event_triggered = await maybe_trigger_random_event(room_id, current_turn)
    
    # Store updated events in Redis
    if room_id in active_room_events:
        redis_key = f"room:{room_id}:random_events"
        redis_client.setex(
            redis_key, 
            86400, 
            json.dumps([ae.dict() for ae in active_room_events[room_id]])
        )
    
    return {
        "room_id": room_id,
        "current_turn": current_turn,
        "active_events": active_room_events.get(room_id, []),
        "event_triggered": event_triggered
    }

@app.get("/active/{room_id}")
async def get_active_events(room_id: str):
    """Get the active random events for a room."""
    # Try to get from memory first
    if room_id in active_room_events:
        return {"active_events": active_room_events[room_id]}
    
    # If not in memory, try to get from Redis
    redis_key = f"room:{room_id}:random_events"
    events_json = redis_client.get(redis_key)
    
    if events_json:
        events_list = json.loads(events_json)
        active_events = [ActiveEvent(**event_dict) for event_dict in events_list]
        active_room_events[room_id] = active_events
        return {"active_events": active_events}
    
    return {"active_events": []}

async def maybe_trigger_random_event(room_id: str, current_turn: int) -> Optional[dict]:
    """Randomly decide whether to trigger an event, and if so, which one."""
    # Simple probability check
    if random.random() > 0.3:  # 30% chance of an event on any turn
        return None
    
    # Choose a random event based on probabilities
    weighted_events = []
    for event_id, event_data in RANDOM_EVENTS.items():
        weighted_events.extend([event_id] * int(event_data["probability"] * 100))
    
    if not weighted_events:
        return None
    
    chosen_event_id = random.choice(weighted_events)
    event_data = RANDOM_EVENTS[chosen_event_id]
    
    # Create the random event
    random_event = RandomEvent(
        id=chosen_event_id,
        name=event_data["name"],
        description=event_data["description"],
        effect=event_data["effect"],
        duration=event_data["duration"]
    )
    
    # Apply the event effect
    effect_result = await apply_event_effect(room_id, random_event)
    
    if effect_result.get("success"):
        # Add to active events
        active_event = ActiveEvent(
            event=random_event,
            active_until=current_turn + random_event.duration,
            affected_columns=effect_result.get("affected_columns", []),
            affected_players=effect_result.get("affected_players", [])
        )
        
        if room_id not in active_room_events:
            active_room_events[room_id] = []
        
        active_room_events[room_id].append(active_event)
        
        # Notify game coordinator about the event
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{COORDINATOR_URL}/events/notify",
                    json={
                        "room_id": room_id,
                        "event": random_event.dict(),
                        "effect_result": effect_result
                    }
                )
        except Exception as e:
            print(f"Error notifying coordinator about event: {e}")
        
        return {
            "success": True,
            "event": random_event.dict(),
            "effect_result": effect_result
        }
    
    return None

async def apply_event_effect(room_id: str, event: RandomEvent) -> dict:
    """Apply the effect of a random event."""
    if event.effect == "shuffle_columns":
        # Shuffle the contents of 1-3 random columns
        num_columns = random.randint(1, 3)
        columns_to_shuffle = random.sample(list(COLUMN_NODE_PORTS.keys()), num_columns)
        
        results = []
        for column in columns_to_shuffle:
            try:
                # Get current column state
                async with httpx.AsyncClient() as client:
                    state_response = await client.get(
                        f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column])}/state/{room_id}"
                    )
                    column_state = state_response.json().get("column_state", {})
                    
                    # Shuffle non-empty cells
                    cells = column_state.get("cells", [])
                    non_empty_cells = [cell for cell in cells if cell is not None]
                    random.shuffle(non_empty_cells)
                    
                    # Reassign in the original order (maintain gravity)
                    new_cells = [None] * len(cells)
                    non_empty_index = 0
                    
                    if column_state.get("is_flipped", False):
                        # Flipped gravity: non-empty cells go from top to bottom
                        for i in range(len(cells)):
                            if cells[i] is not None and non_empty_index < len(non_empty_cells):
                                new_cells[i] = non_empty_cells[non_empty_index]
                                non_empty_index += 1
                    else:
                        # Normal gravity: non-empty cells go from bottom to top
                        for i in range(len(cells) - 1, -1, -1):
                            if cells[i] is not None and non_empty_index < len(non_empty_cells):
                                new_cells[i] = non_empty_cells[non_empty_index]
                                non_empty_index += 1
                    
                    # Update column state
                    column_state["cells"] = new_cells
                    
                    # Save back to the column node
                    update_response = await client.post(
                        f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column])}/update_state",
                        json={
                            "room_id": room_id,
                            "column_state": column_state
                        }
                    )
                    
                    results.append(update_response.json())
            except Exception as e:
                print(f"Error shuffling column {column}: {e}")
        
        return {
            "success": True,
            "affected_columns": columns_to_shuffle,
            "results": results
        }
    
    elif event.effect == "reverse_all_gravity":
        # Flip gravity in all columns
        results = []
        for column, port in COLUMN_NODE_PORTS.items():
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{COLUMN_NODE_BASE_URL.format(port)}/power-up/flip",
                        json={
                            "room_id": room_id
                        }
                    )
                    results.append(response.json())
            except Exception as e:
                print(f"Error flipping gravity in column {column}: {e}")
        
        return {
            "success": True,
            "affected_columns": list(COLUMN_NODE_PORTS.keys()),
            "results": results
        }
    
    elif event.effect == "swap_columns":
        # Swap the contents of two random columns
        available_columns = list(COLUMN_NODE_PORTS.keys())
        if len(available_columns) < 2:
            return {"success": False, "message": "Not enough columns to swap"}
        
        column1, column2 = random.sample(available_columns, 2)
        
        try:
            # Get current states
            async with httpx.AsyncClient() as client:
                state1_response = await client.get(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column1])}/state/{room_id}"
                )
                state2_response = await client.get(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column2])}/state/{room_id}"
                )
                
                column1_state = state1_response.json().get("column_state", {})
                column2_state = state2_response.json().get("column_state", {})
                
                # Swap cells
                column1_cells = column1_state.get("cells", [])
                column1_state["cells"] = column2_state.get("cells", [])
                column2_state["cells"] = column1_cells
                
                # Update both columns
                update1_response = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column1])}/update_state",
                    json={
                        "room_id": room_id,
                        "column_state": column1_state
                    }
                )
                
                update2_response = await client.post(
                    f"{COLUMN_NODE_BASE_URL.format(COLUMN_NODE_PORTS[column2])}/update_state",
                    json={
                        "room_id": room_id,
                        "column_state": column2_state
                    }
                )
                
                return {
                    "success": True,
                    "affected_columns": [column1, column2],
                    "results": [update1_response.json(), update2_response.json()]
                }
        except Exception as e:
            print(f"Error swapping columns {column1} and {column2}: {e}")
            return {"success": False, "message": str(e)}
    
    # Other event effects (hide_ui, speed_limit, give_power_ups) are mostly handled client-side
    # Just return success and let the coordinator notify clients
    return {
        "success": True,
        "message": f"Event {event.name} triggered",
        "affected_columns": [],
        "affected_players": []
    }

# Additional endpoints for testing and debugging
@app.post("/trigger")
async def trigger_specific_event(data: dict):
    """Manually trigger a specific random event (for testing)."""
    room_id = data.get("room_id")
    event_id = data.get("event_id")
    
    if not room_id or not event_id:
        raise HTTPException(status_code=400, detail="Room ID and event ID are required")
    
    if event_id not in RANDOM_EVENTS:
        raise HTTPException(status_code=400, detail=f"Unknown event: {event_id}")
    
    event_data = RANDOM_EVENTS[event_id]
    
    # Create the random event
    random_event = RandomEvent(
        id=event_id,
        name=event_data["name"],
        description=event_data["description"],
        effect=event_data["effect"],
        duration=event_data["duration"]
    )
    
    # Apply the event effect
    effect_result = await apply_event_effect(room_id, random_event)
    
    if effect_result.get("success"):
        # Get current turn
        current_turn = room_turn_counts.get(room_id, 0)
        
        # Add to active events
        active_event = ActiveEvent(
            event=random_event,
            active_until=current_turn + random_event.duration,
            affected_columns=effect_result.get("affected_columns", []),
            affected_players=effect_result.get("affected_players", [])
        )
        
        if room_id not in active_room_events:
            active_room_events[room_id] = []
        
        active_room_events[room_id].append(active_event)
        
        # Store in Redis
        redis_key = f"room:{room_id}:random_events"
        redis_client.setex(
            redis_key, 
            86400, 
            json.dumps([ae.dict() for ae in active_room_events[room_id]])
        )
        
        # Notify game coordinator about the event
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{COORDINATOR_URL}/events/notify",
                    json={
                        "room_id": room_id,
                        "event": random_event.dict(),
                        "effect_result": effect_result
                    }
                )
        except Exception as e:
            print(f"Error notifying coordinator about event: {e}")
        
        return {
            "success": True,
            "event": random_event.dict(),
            "effect_result": effect_result
        }
    
    return {"success": False, "message": "Failed to apply event effect"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8020) 
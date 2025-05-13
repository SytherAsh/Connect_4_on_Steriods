import asyncio
import sys
import json
import redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import Dict, List, Optional, Any

# Initialize Redis client for state persistence
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Parse column ID from command line arguments
if len(sys.argv) > 1:
    COLUMN_ID = int(sys.argv[1])
else:
    COLUMN_ID = 0  # Default to column 0 if not specified

# Determine port based on column ID
PORT = 8001 + COLUMN_ID

# Initialize FastAPI app
app = FastAPI(title=f"Connect 4 on Steroids - Column Node {COLUMN_ID}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ColumnState(BaseModel):
    column_id: int
    cells: List[Optional[str]] = []  # List of player IDs, None for empty cells
    is_blocked: bool = False
    block_turns_remaining: int = 0
    is_flipped: bool = False  # For gravity flip power-up

# In-memory store for active column states per room
room_columns: Dict[str, ColumnState] = {}

# Column constants
COLUMN_HEIGHT = 6  # Standard Connect 4 height

# Routes
@app.get("/")
async def root():
    return {"message": f"Connect 4 on Steroids - Column Node {COLUMN_ID}"}

@app.post("/init")
async def initialize_column(data: dict):
    """Initialize a column for a game room."""
    room_id = data.get("room_id")
    if not room_id:
        raise HTTPException(status_code=400, detail="Room ID is required")
    
    # Create new column state
    column_state = ColumnState(
        column_id=COLUMN_ID,
        cells=[None] * COLUMN_HEIGHT
    )
    
    # Store in Redis with TTL (24 hours)
    redis_key = f"room:{room_id}:column:{COLUMN_ID}"
    redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
    
    # Store in memory
    room_columns[room_id] = column_state
    
    return {"status": "initialized", "column_id": COLUMN_ID, "room_id": room_id}

@app.get("/state/{room_id}")
async def get_column_state(room_id: str):
    """Get the current state of this column for a specific room."""
    # Try to get from memory first
    if room_id in room_columns:
        return {"column_state": room_columns[room_id]}
    
    # If not in memory, try to get from Redis
    redis_key = f"room:{room_id}:column:{COLUMN_ID}"
    state_json = redis_client.get(redis_key)
    
    if state_json:
        state_dict = json.loads(state_json)
        column_state = ColumnState(**state_dict)
        room_columns[room_id] = column_state  # Cache in memory
        return {"column_state": column_state}
    
    raise HTTPException(status_code=404, detail="Column state not found for this room")

@app.post("/update_state")
async def update_column_state(data: dict):
    """Update the state of this column for a specific room."""
    room_id = data.get("room_id")
    column_state_data = data.get("column_state")
    
    if not room_id or not column_state_data:
        raise HTTPException(status_code=400, detail="Room ID and column state are required")
    
    # Validate column ID
    if column_state_data.get("column_id") != COLUMN_ID:
        raise HTTPException(status_code=400, detail="Column ID mismatch")
    
    # Create column state from data
    try:
        column_state = ColumnState(**column_state_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid column state: {str(e)}")
    
    # Store in memory
    room_columns[room_id] = column_state
    
    # Store in Redis with TTL (24 hours)
    redis_key = f"room:{room_id}:column:{COLUMN_ID}"
    redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
    
    return {"status": "updated", "column_id": COLUMN_ID, "room_id": room_id}

@app.post("/drop")
async def drop_disc(data: dict):
    """Handle a player dropping a disc in this column."""
    room_id = data.get("room_id")
    player_id = data.get("player_id")
    
    if not room_id or not player_id:
        raise HTTPException(status_code=400, detail="Room ID and player ID are required")
    
    # Ensure column state exists for this room
    if room_id not in room_columns:
        # Try to get from Redis
        redis_key = f"room:{room_id}:column:{COLUMN_ID}"
        state_json = redis_client.get(redis_key)
        
        if state_json:
            state_dict = json.loads(state_json)
            room_columns[room_id] = ColumnState(**state_dict)
        else:
            raise HTTPException(status_code=404, detail="Column state not found for this room")
    
    column_state = room_columns[room_id]
    
    # Check if column is blocked
    if column_state.is_blocked:
        if column_state.block_turns_remaining > 0:
            column_state.block_turns_remaining -= 1
            if column_state.block_turns_remaining == 0:
                column_state.is_blocked = False
            
            # Update state in Redis
            redis_key = f"room:{room_id}:column:{COLUMN_ID}"
            redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
            
            return {"success": False, "message": "Column is blocked"}
    
    # Ensure cells list is initialized properly
    if not hasattr(column_state, 'cells') or column_state.cells is None:
        column_state.cells = [None] * COLUMN_HEIGHT
    
    # Make sure cells list has correct length
    if len(column_state.cells) < COLUMN_HEIGHT:
        # Extend the list to correct length
        column_state.cells.extend([None] * (COLUMN_HEIGHT - len(column_state.cells)))
    elif len(column_state.cells) > COLUMN_HEIGHT:
        # Trim the list to correct length
        column_state.cells = column_state.cells[:COLUMN_HEIGHT]
    
    # Check if column is full
    if None not in column_state.cells:
        return {"success": False, "message": "Column is full"}
    
    drop_row = None
    
    # Debug current state
    print(f"Current state before drop: Column {COLUMN_ID}, is_flipped={column_state.is_flipped}, cells={column_state.cells}")
    
    # Determine position to place the disc based on gravity
    if column_state.is_flipped:
        # In flipped gravity, discs "fall" upward
        for i in range(COLUMN_HEIGHT):
            if column_state.cells[i] is None:
                column_state.cells[i] = player_id
                drop_row = i
                print(f"Placing disc at row {i} (flipped gravity)")
                break
    else:
        # Normal gravity, discs fall to the bottom (highest index)
        # First compact all non-None elements to the bottom
        non_empty_cells = [cell for cell in column_state.cells if cell is not None]
        empty_count = COLUMN_HEIGHT - len(non_empty_cells)
        column_state.cells = [None] * empty_count + non_empty_cells
        
        # Then add the new disc at the highest available position
        for i in range(COLUMN_HEIGHT - 1, -1, -1):
            if column_state.cells[i] is None:
                column_state.cells[i] = player_id
                drop_row = i
                print(f"Placing disc at row {i} (normal gravity)")
                break
    
    # Debug updated state
    print(f"Updated state after drop: Column {COLUMN_ID}, is_flipped={column_state.is_flipped}, cells={column_state.cells}")
    
    # Update state in Redis with proper error handling
    try:
        redis_key = f"room:{room_id}:column:{COLUMN_ID}"
        redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
    except Exception as e:
        print(f"Error updating Redis state: {e}")
        # Continue anyway - the in-memory state is still updated
    
    return {
        "success": True,
        "column": COLUMN_ID,
        "row": drop_row,
        "player_id": player_id
    }

@app.post("/power-up/block")
async def block_column(data: dict):
    """Block a column for a number of turns."""
    room_id = data.get("room_id")
    turns = data.get("turns", 1)
    
    if not room_id:
        raise HTTPException(status_code=400, detail="Room ID is required")
    
    # Ensure column state exists for this room
    if room_id not in room_columns:
        # Try to get from Redis
        redis_key = f"room:{room_id}:column:{COLUMN_ID}"
        state_json = redis_client.get(redis_key)
        
        if state_json:
            state_dict = json.loads(state_json)
            room_columns[room_id] = ColumnState(**state_dict)
        else:
            raise HTTPException(status_code=404, detail="Column state not found for this room")
    
    column_state = room_columns[room_id]
    
    # Apply the block power-up
    column_state.is_blocked = True
    column_state.block_turns_remaining = turns
    
    # Update state in Redis
    redis_key = f"room:{room_id}:column:{COLUMN_ID}"
    redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
    
    return {
        "success": True,
        "column": COLUMN_ID,
        "blocked": True,
        "turns": turns
    }

@app.post("/power-up/flip")
async def flip_gravity(data: dict):
    """Flip gravity in this column."""
    room_id = data.get("room_id")
    
    if not room_id:
        raise HTTPException(status_code=400, detail="Room ID is required")
    
    # Ensure column state exists for this room
    if room_id not in room_columns:
        # Try to get from Redis
        redis_key = f"room:{room_id}:column:{COLUMN_ID}"
        state_json = redis_client.get(redis_key)
        
        if state_json:
            state_dict = json.loads(state_json)
            room_columns[room_id] = ColumnState(**state_dict)
        else:
            raise HTTPException(status_code=404, detail="Column state not found for this room")
    
    column_state = room_columns[room_id]
    
    # Ensure cells list is initialized properly
    if not hasattr(column_state, 'cells') or column_state.cells is None:
        column_state.cells = [None] * COLUMN_HEIGHT
    
    # Make sure cells list has correct length
    if len(column_state.cells) < COLUMN_HEIGHT:
        # Extend the list to correct length
        column_state.cells.extend([None] * (COLUMN_HEIGHT - len(column_state.cells)))
    elif len(column_state.cells) > COLUMN_HEIGHT:
        # Trim the list to correct length
        column_state.cells = column_state.cells[:COLUMN_HEIGHT]
    
    # Apply the gravity flip power-up
    column_state.is_flipped = not column_state.is_flipped
    
    # If gravity flips, we need to rearrange the discs
    # Get only the non-empty cells (discs)
    non_empty_cells = [cell for cell in column_state.cells if cell is not None]
    # Count of empty spaces
    empty_count = COLUMN_HEIGHT - len(non_empty_cells)
    
    if column_state.is_flipped:
        # Move all discs to the top - empty spaces at bottom
        column_state.cells = [None] * empty_count + non_empty_cells
    else:
        # Move all discs to the bottom - empty spaces at top
        column_state.cells = non_empty_cells + [None] * empty_count
    
    # Update state in Redis with proper error handling
    try:
        redis_key = f"room:{room_id}:column:{COLUMN_ID}"
        redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
    except Exception as e:
        print(f"Error updating Redis state: {e}")
        # Continue anyway - the in-memory state is still updated
    
    return {
        "success": True,
        "column": COLUMN_ID,
        "flipped": column_state.is_flipped
    }

@app.post("/power-up/bomb")
async def bomb_column(data: dict):
    """Remove all discs from this column."""
    room_id = data.get("room_id")
    
    if not room_id:
        raise HTTPException(status_code=400, detail="Room ID is required")
    
    # Ensure column state exists for this room
    if room_id not in room_columns:
        # Try to get from Redis
        redis_key = f"room:{room_id}:column:{COLUMN_ID}"
        state_json = redis_client.get(redis_key)
        
        if state_json:
            state_dict = json.loads(state_json)
            room_columns[room_id] = ColumnState(**state_dict)
        else:
            raise HTTPException(status_code=404, detail="Column state not found for this room")
    
    column_state = room_columns[room_id]
    
    # Apply the bomb power-up
    column_state.cells = [None] * COLUMN_HEIGHT
    
    # Update state in Redis
    redis_key = f"room:{room_id}:column:{COLUMN_ID}"
    redis_client.setex(redis_key, 86400, json.dumps(column_state.dict()))
    
    return {
        "success": True,
        "column": COLUMN_ID,
        "bombed": True
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT) 
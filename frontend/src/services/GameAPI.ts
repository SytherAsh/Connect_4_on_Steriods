/**
 * API service for Connect 4 on Steroids game
 */
// Use environment variable for API base URL with fallback to localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;

// Custom error types for better error handling
export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Types
export interface Room {
  id: string;
  name: string;
  players: Player[];
  max_players: number;
  is_active: boolean;
  current_turn: string | null;
  random_events_enabled: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface PowerUp {
  id: string;
  name: string;
  description: string;
  remaining_uses: number;
}

// API configuration
const API_TIMEOUT = 10000; // 10 seconds timeout for API calls

/**
 * Helper function to handle API requests with error handling and timeouts
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeout: number = API_TIMEOUT
): Promise<Response> {
  // Create an abort controller to handle timeouts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    // Clear the timeout since the request has completed
    clearTimeout(timeoutId);
    
    // Handle HTTP errors
    if (!response.ok) {
      let errorMessage = `API error ${response.status}: ${response.statusText}`;
      
      // Try to parse error details from response
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          errorMessage = `API error ${response.status}: ${errorData.detail}`;
        }
      } catch (e) {
        // If we can't parse the error JSON, just use the original message
      }
      
      throw new ApiError(errorMessage, response.status);
    }
    
    return response;
  } catch (error: unknown) {
    // Clear the timeout if it was triggered by something else
    clearTimeout(timeoutId);
    
    // Handle specific errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError();
    } else if (error instanceof ApiError) {
      throw error;
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new NetworkError(`Network error: ${errorMessage}`);
    }
  }
}

/**
 * Get all available game rooms
 */
export async function getRooms(): Promise<Room[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/rooms`);
    const data = await response.json();
    return data.rooms;
  } catch (error: unknown) {
    console.error('Error fetching rooms:', error);
    
    // Create a user-friendly error message based on the error type
    if (error instanceof TimeoutError) {
      throw new Error('Failed to load rooms: Server is taking too long to respond. Please try again later.');
    } else if (error instanceof ApiError && error.status === 404) {
      throw new Error('Game rooms not found. The server may be misconfigured.');
    } else if (error instanceof NetworkError) {
      throw new Error('Network issue: Please check your internet connection and try again.');
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load rooms: ${errorMessage}`);
    }
  }
}

/**
 * Create a new game room
 */
export async function createRoom(roomData: { 
  name: string; 
  max_players?: number;
  random_events_enabled?: boolean;
}): Promise<Room> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roomData),
    });
    
    const data = await response.json();
    return data.room;
  } catch (error: unknown) {
    console.error('Error creating room:', error);
    
    if (error instanceof TimeoutError) {
      throw new Error('Failed to create room: Server is taking too long to respond. Please try again later.');
    } else if (error instanceof ApiError) {
      // Provide specific messages for common error codes
      if (error.status === 400) {
        throw new Error('Invalid room data: Please check the name and player limits.');
      } else if (error.status === 403) {
        throw new Error('You do not have permission to create a room.');
      } else {
        throw new Error(`Server error (${error.status}): ${error.message}`);
      }
    } else if (error instanceof NetworkError) {
      throw new Error('Network issue: Please check your internet connection and try again.');
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create room: ${errorMessage}`);
    }
  }
}

/**
 * Join an existing game room
 */
export async function joinRoom(roomId: string, playerData: {
  name: string;
  color?: string;
}): Promise<{ player: Player; room: Room }> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(playerData),
    });
    
    return await response.json();
  } catch (error: unknown) {
    console.error('Error joining room:', error);
    
    if (error instanceof TimeoutError) {
      throw new Error('Failed to join room: Server is taking too long to respond. Please try again later.');
    } else if (error instanceof ApiError) {
      // Specific error messages based on status codes
      if (error.status === 400) {
        throw new Error('Failed to join room: Invalid player data or room is full.');
      } else if (error.status === 404) {
        throw new Error('Room not found: This game room no longer exists.');
      } else if (error.status === 409) {
        throw new Error('Cannot join room: The game has already started.');
      } else {
        throw new Error(`Server error (${error.status}): ${error.message}`);
      }
    } else if (error instanceof NetworkError) {
      throw new Error('Network issue: Please check your internet connection and try again.');
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to join room: ${errorMessage}`);
    }
  }
}

/**
 * Start a game in a room
 */
export async function startGame(roomId: string): Promise<{ status: string; room: Room }> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/rooms/${roomId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return await response.json();
  } catch (error: unknown) {
    console.error('Error starting game:', error);
    
    if (error instanceof TimeoutError) {
      throw new Error('Failed to start game: Server is taking too long to respond. Please try again later.');
    } else if (error instanceof ApiError) {
      if (error.status === 400) {
        throw new Error('Cannot start game: Not enough players have joined.');
      } else if (error.status === 404) {
        throw new Error('Room not found: This game room no longer exists.');
      } else if (error.status === 403) {
        throw new Error('You do not have permission to start this game.');
      } else {
        throw new Error(`Server error (${error.status}): ${error.message}`);
      }
    } else if (error instanceof NetworkError) {
      throw new Error('Network issue: Please check your internet connection and try again.');
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start game: ${errorMessage}`);
    }
  }
}

/**
 * Get player power-ups
 */
export async function getPlayerPowerUps(roomId: string, playerId: string): Promise<{ [key: string]: PowerUp }> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/power-ups/player/${roomId}/${playerId}`);
    
    const data = await response.json();
    return data.power_ups || {};
  } catch (error) {
    console.error('Error fetching power-ups:', error);
    
    // For power-ups, we can return an empty object instead of throwing an error
    // since this is not a critical feature that should prevent gameplay
    console.warn('Returning default power-ups due to error');
    
    // Return default power-ups
    return {
      double_drop: {
        id: 'double_drop',
        name: 'Double Drop',
        description: 'Drop two discs in a single turn',
        remaining_uses: 1
      },
      undo_move: {
        id: 'undo_move',
        name: 'Undo Move',
        description: 'Remove the last disc placed',
        remaining_uses: 1
      },
      column_bomb: {
        id: 'column_bomb',
        name: 'Column Bomb',
        description: 'Clear all discs from a column',
        remaining_uses: 1
      },
      column_block: {
        id: 'column_block',
        name: 'Column Block',
        description: 'Block a column for 1 turn',
        remaining_uses: 1
      },
      gravity_flip: {
        id: 'gravity_flip',
        name: 'Gravity Flip',
        description: 'Flip gravity in a column',
        remaining_uses: 1
      }
    };
  }
}

// Export all functions as a default object
const GameAPI = {
  getRooms,
  createRoom,
  joinRoom,
  startGame,
  getPlayerPowerUps,
};

export default GameAPI; 
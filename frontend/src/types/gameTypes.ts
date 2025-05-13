/**
 * Common game types
 */

// Room information
export interface Room {
  id: string;
  name: string;
  players: Player[];
  max_players: number;
  is_active: boolean;
  current_turn: string | null;
  random_events_enabled: boolean;
}

// Player information
export interface Player {
  id: string;
  name: string;
  color: string;
}

// API Power-up representation
export interface ApiPowerUp {
  id: string;
  name: string;
  description: string;
  remaining_uses: number;
}

// Frontend Power-up representation
export interface PlayerPowerUp {
  id: string;
  name: string;
  description: string;
  remainingUses: number;
}

// Game board cell representation
export interface BoardCell {
  playerId: string | null;
  row: number;
  column: number;
}

// Random event currently active
export interface RandomEvent {
  id: string;
  name: string;
  description: string;
  effect: string;
  duration: number;
  activeUntil: number; // turn number
}

// Helper function to convert API power-ups to frontend format
export function convertApiPowerUp(powerUp: ApiPowerUp): PlayerPowerUp {
  return {
    id: powerUp.id,
    name: powerUp.name,
    description: powerUp.description,
    remainingUses: powerUp.remaining_uses
  };
}

// Convert a map of API power-ups to frontend power-ups
export function convertApiPowerUps(apiPowerUps: { [key: string]: ApiPowerUp }): { [key: string]: PlayerPowerUp } {
  const result: { [key: string]: PlayerPowerUp } = {};
  
  Object.entries(apiPowerUps).forEach(([key, powerUp]) => {
    result[key] = convertApiPowerUp(powerUp);
  });
  
  return result;
} 
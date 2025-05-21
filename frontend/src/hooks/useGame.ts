import { useState, useEffect, useCallback } from 'react';
import { Room, Player, ApiError, NetworkError, TimeoutError } from '../services/GameAPI';
import webSocketService, { WebSocketConnectionError, WebSocketMessageError } from '../services/WebSocketService';

// Game board cell representation
export interface BoardCell {
  playerId: string | null;
  row: number;
  column: number;
}

// Power-up in player's inventory
export interface PlayerPowerUp {
  id: string;
  name: string;
  description: string;
  remainingUses: number;
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

// WebSocket message types
interface PlayerJoinedMessage {
  player: Player;
}

interface PlayerLeftMessage {
  player_id: string;
  current_turn: string;
  turn_start_time?: number;
}

interface GameStartedMessage {
  room: Room;
  current_turn: string;
  turn_time_limit?: number;
  turn_start_time?: number;
}

interface MoveMadeMessage {
  player_id: string;
  column: number | string;
  row: number;
  next_turn: string;
  turn_time_limit?: number;
  turn_start_time?: number;
}

interface TurnTimeoutMessage {
  player_id: string;
  next_turn: string;
  remaining_time?: number;
}

interface TimeUpdateMessage {
  current_turn: string;
  turn_time_limit?: number;
  turn_start_time?: number;
  remaining_time?: number;
}

interface PowerUpUsedMessage {
  player_id: string;
  power_up_id: string;
  remaining_uses: number;
  effect?: any;
}

interface RandomEventMessage {
  event: RandomEvent;
  effect_result: any;
}

interface GameOverMessage {
  winner: string;
  win_type: string;
  positions?: [number, number][];
}

interface ChatMessage {
  player_id: string;
  message: string;
  timestamp?: number;
}

interface ErrorMessage {
  message: string;
}

// Game state
interface GameState {
  room: Room | null;
  player: Player | null;
  isConnected: boolean;
  isMyTurn: boolean;
  board: { [key: string]: BoardCell[] }; // column -> cells
  powerUps: { [key: string]: PlayerPowerUp };
  activeEvents: RandomEvent[];
  isGravityFlipped: boolean; // Whether gravity is currently flipped (discs move upward)
  winState: {
    winner: string | null;
    winType: string | null;
    positions: [number, number][] | null;
  };
  messages: {
    id: string;
    playerId: string;
    message: string;
    timestamp: number;
  }[];
  error: string | null;
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'failed';
  turnTimeLimit: number; // Time limit for each turn in seconds
  turnStartTime: number; // When the current turn started (timestamp)
  remainingTime: number; // Remaining time in seconds for the current turn
}

export function useGame(roomId: string, playerId: string | null) {
  const [gameState, setGameState] = useState<GameState>({
    room: null,
    player: null,
    isConnected: false,
    isMyTurn: false,
    board: {},
    powerUps: {
      // Default power-ups to ensure they're always visible
      double_drop: {
        id: 'double_drop',
        name: 'Double Drop',
        description: 'Drop two discs in a single turn',
        remainingUses: 1
      },
      undo_move: {
        id: 'undo_move',
        name: 'Undo Move',
        description: 'Remove the last disc placed',
        remainingUses: 1
      },
      column_bomb: {
        id: 'column_bomb',
        name: 'Column Bomb',
        description: 'Clear all discs from a column',
        remainingUses: 1
      },
      column_block: {
        id: 'column_block',
        name: 'Column Block',
        description: 'Block a column for 1 turn',
        remainingUses: 1
      },
      gravity_flip: {
        id: 'gravity_flip',
        name: 'Gravity Flip',
        description: 'Flip gravity to normal (downward) for a column',
        remainingUses: 1
      }
    },
    activeEvents: [],
    isGravityFlipped: true, // Default to flipped gravity
    winState: {
      winner: null,
      winType: null,
      positions: null,
    },
    messages: [],
    error: null,
    connectionState: 'disconnected',
    turnTimeLimit: 30, // Default time limit
    turnStartTime: 0,
    remainingTime: 30
  });

  // Update game state utility function
  const updateGameState = useCallback((updater: ((state: GameState) => GameState) | Partial<GameState>) => {
    if (typeof updater === 'function') {
      setGameState(updater);
    } else {
      setGameState(state => ({
        ...state,
        ...updater
      }));
    }
  }, []);

  // Timer update interval
  useEffect(() => {
    if (!gameState.room?.is_active || !gameState.turnStartTime) return;

    const timerInterval = setInterval(() => {
      const now = Date.now() / 1000; // Convert to seconds
      const elapsed = now - gameState.turnStartTime;
      const remaining = Math.max(0, gameState.turnTimeLimit - elapsed);
      
      updateGameState({ remainingTime: remaining });
      
      // Request a time update from the server every 5 seconds to ensure sync
      if (Math.floor(elapsed) % 5 === 0) {
        webSocketService.send({
          type: 'request_time_update'
        });
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [gameState.room?.is_active, gameState.turnStartTime, gameState.turnTimeLimit, updateGameState]);

  // Initialize the game
  useEffect(() => {
    if (!playerId) return;

    updateGameState({ connectionState: 'connecting' });

    // Setup error handler for WebSocket
    const errorUnsubscribe = webSocketService.onError((error) => {
      console.error('WebSocket error:', error);
      
      let errorMessage = 'Connection error';
      
      if (error instanceof WebSocketConnectionError) {
        errorMessage = `Connection error: ${error.message}`;
      } else if (error instanceof WebSocketMessageError) {
        errorMessage = `Message error: ${error.message}`;
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      updateGameState(state => ({
        ...state,
        error: errorMessage,
        connectionState: webSocketService.isAttemptingReconnection() ? 'reconnecting' : 'disconnected'
      }));
    });

    // Connect to WebSocket
    webSocketService.connect(playerId);

    // Update connection status
    const checkConnection = setInterval(() => {
      const isConnected = webSocketService.isConnected();
      const isReconnecting = webSocketService.isAttemptingReconnection();
      
      updateGameState(state => {
        // Only update if there's a change to avoid unnecessary renders
        if (state.isConnected !== isConnected || 
           (state.connectionState === 'reconnecting') !== isReconnecting) {
          
          let connectionState = state.connectionState;
          if (isConnected) {
            connectionState = 'connected';
          } else if (isReconnecting) {
            connectionState = 'reconnecting';
          } else if (state.connectionState !== 'failed') {
            connectionState = 'disconnected';
          }
          
          return {
            ...state,
            isConnected,
            connectionState
          };
        }
        return state;
      });
    }, 1000);

    return () => {
      clearInterval(checkConnection);
      errorUnsubscribe();
      webSocketService.disconnect();
    };
  }, [playerId, updateGameState]);

  // Setup message handlers
  useEffect(() => {
    if (!playerId) return;

    // Define message handlers
    const handlers = {
      // Player joins
      player_joined: (message: PlayerJoinedMessage) => {
        updateGameState(state => {
          if (!state.room) return state;
          
          return {
            ...state,
            room: {
              ...state.room,
              players: [...state.room.players, message.player]
            }
          };
        });
      },

      // Player leaves
      player_left: (message: PlayerLeftMessage) => {
        updateGameState(state => {
          if (!state.room) return state;

          return {
            ...state,
            room: {
              ...state.room,
              players: state.room.players.filter(p => p.id !== message.player_id),
              current_turn: message.current_turn,
            },
            isMyTurn: message.current_turn === playerId,
            turnStartTime: message.turn_start_time || state.turnStartTime,
          };
        });
      },

      // Game start
      game_started: (message: GameStartedMessage) => {
        updateGameState(state => ({
          ...state,
          room: message.room,
          isMyTurn: message.current_turn === playerId,
          turnTimeLimit: message.turn_time_limit || 30,
          turnStartTime: message.turn_start_time || Date.now() / 1000,
          remainingTime: message.turn_time_limit || 30,
          error: null // Clear any previous errors on game start
        }));

        // Initialize board state
        initializeBoard();
      },

      // Move handling
      move_made: (message: MoveMadeMessage) => {
        updateGameState(state => {
          // Update board state
          const updatedBoard = { ...state.board };
          const column = message.column.toString();
          
          if (!updatedBoard[column]) {
            updatedBoard[column] = [];
          }
          
          updatedBoard[column] = [
            ...updatedBoard[column],
            {
              playerId: message.player_id,
              row: message.row,
              column: parseInt(column),
            },
          ];

          return {
            ...state,
            board: updatedBoard,
            isMyTurn: message.next_turn === playerId,
            turnTimeLimit: message.turn_time_limit || state.turnTimeLimit,
            turnStartTime: message.turn_start_time || Date.now() / 1000,
            remainingTime: message.turn_time_limit || state.turnTimeLimit,
            error: null // Clear any errors after successful move
          };
        });
      },

      // Turn timeout
      turn_timeout: (message: TurnTimeoutMessage) => {
        updateGameState(state => ({
          ...state,
          isMyTurn: message.next_turn === playerId,
          turnStartTime: Date.now() / 1000,
          remainingTime: message.remaining_time || state.turnTimeLimit,
          error: `${message.player_id === playerId ? 'Your' : 'Opponent\'s'} turn timed out!`
        }));
      },

      // Time update
      time_update: (message: TimeUpdateMessage) => {
        updateGameState(state => ({
          ...state,
          turnTimeLimit: message.turn_time_limit || state.turnTimeLimit,
          turnStartTime: message.turn_start_time || state.turnStartTime,
          remainingTime: message.remaining_time || 
            Math.max(0, (message.turn_time_limit || state.turnTimeLimit) - 
            ((Date.now() / 1000) - (message.turn_start_time || state.turnStartTime)))
        }));
      },

      // Power-up handling
      power_up_used: (message: PowerUpUsedMessage) => {
        updateGameState(state => {
          // Update power-up inventory if it's this player's power-up
          const updatedPowerUps = { ...state.powerUps };
          if (message.player_id === playerId && message.power_up_id in updatedPowerUps) {
            updatedPowerUps[message.power_up_id] = {
              ...updatedPowerUps[message.power_up_id],
              remainingUses: message.remaining_uses
            };
          }
          
          // Add a system message about the power-up
          const powerUpName = message.power_up_id.replace(/_/g, ' ');
          const playerName = state.room?.players.find(p => p.id === message.player_id)?.name || 'A player';
          
          const messages = [
            ...state.messages,
            {
              id: `system-${Date.now()}`,
              playerId: 'system',
              message: `${playerName} used ${powerUpName}!`,
              timestamp: Date.now(),
            },
          ];
          
          // Update board state based on power-up effect
          const effect = message.effect || {};
          let updatedBoard = { ...state.board };
          
          // Handle different power-up effects
          if (effect.drop1 && effect.drop2) {
            // Double drop
            const column1 = effect.drop1.column.toString();
            const column2 = effect.drop2.column.toString();
            
            if (!updatedBoard[column1]) updatedBoard[column1] = [];
            if (!updatedBoard[column2]) updatedBoard[column2] = [];
            
            updatedBoard[column1] = [
              ...updatedBoard[column1],
              {
                playerId: message.player_id,
                row: effect.drop1.row,
                column: parseInt(column1),
              },
            ];
            
            updatedBoard[column2] = [
              ...updatedBoard[column2],
              {
                playerId: message.player_id,
                row: effect.drop2.row,
                column: parseInt(column2),
              },
            ];
          } else if (effect.bombed) {
            // Column bomb
            const column = effect.column.toString();
            if (updatedBoard[column]) {
              updatedBoard[column] = [];
            }
          } else if (effect.flipped) {
            // Gravity flip - toggle the gravity for the entire board
            // In this implementation, we're toggling the global gravity state
            if (message.power_up_id === 'gravity_flip') {
              // Toggle the gravity state (since our default is flipped/upward gravity,
              // using the power-up makes it normal/downward gravity)
              return {
                ...state,
                board: updatedBoard,
                powerUps: updatedPowerUps,
                messages,
                isGravityFlipped: !state.isGravityFlipped,
                error: null // Clear any errors after power-up use
              };
            }
          }

          return {
            ...state,
            board: updatedBoard,
            powerUps: updatedPowerUps,
            messages,
            error: null // Clear any errors after power-up use
          };
        });
      },

      // Random events
      random_event: (message: RandomEventMessage) => {
        const event = message.event;
        const effect = message.effect_result;

        updateGameState(state => {
          // Add event to active events list
          const updatedEvents = [
            ...state.activeEvents,
            {
              ...event,
              activeUntil: state.activeEvents.length + event.duration,
            },
          ];

          // Update board state based on event effect
          let updatedBoard = { ...state.board };

          // Apply specific effects
          if (effect.affected_columns && effect.affected_columns.length > 0) {
            // For events that affect columns, we'll wait for the backend to send updated column states
            // Rather than trying to simulate the effect here
          }

          return {
            ...state,
            activeEvents: updatedEvents,
            board: updatedBoard,
          };
        });
      },

      // Game over
      game_over: (message: GameOverMessage) => {
        updateGameState(state => ({
          ...state,
          winState: {
            winner: message.winner,
            winType: message.win_type,
            positions: message.positions || null,
          },
        }));
      },

      // Chat messages
      chat: (message: ChatMessage) => {
        updateGameState(state => ({
          ...state,
          messages: [
            ...state.messages,
            {
              id: `msg-${Date.now()}`,
              playerId: message.player_id,
              message: message.message,
              timestamp: message.timestamp ? message.timestamp * 1000 : Date.now(),
            },
          ],
        }));
      },

      // Error handling
      error: (message: ErrorMessage) => {
        updateGameState(state => ({
          ...state,
          error: message.message,
        }));

        // Clear error after 5 seconds
        setTimeout(() => {
          updateGameState(state => {
            // Only clear if it's the same error (to avoid clearing new errors)
            if (state.error === message.message) {
              return {
                ...state,
                error: null,
              };
            }
            return state;
          });
        }, 5000);
      },
    };

    // Register all handlers
    const unsubscribers = Object.entries(handlers).map(([msgType, handler]) => {
      return webSocketService.on(msgType, handler);
    });

    return () => {
      // Clean up all handlers
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [playerId, updateGameState]);

  // Request time update periodically
  useEffect(() => {
    if (!gameState.isConnected || !gameState.room?.is_active) return;
    
    // Request initial time update
    webSocketService.send({
      type: 'request_time_update'
    });
    
    // Request time update every 5 seconds
    const timeUpdateInterval = setInterval(() => {
      if (gameState.isConnected) {
        webSocketService.send({
          type: 'request_time_update'
        });
      }
    }, 5000);
    
    return () => clearInterval(timeUpdateInterval);
  }, [gameState.isConnected, gameState.room?.is_active]);

  // Setup event listeners
  useEffect(() => {
    // Add event listener for clearing errors
    const clearErrorHandler = () => {
      updateGameState({ error: null });
    };
    
    window.addEventListener('clearGameError', clearErrorHandler);
    
    return () => {
      window.removeEventListener('clearGameError', clearErrorHandler);
    };
  }, [updateGameState]);

  // Initialize a blank board
  const initializeBoard = useCallback(() => {
    const board: { [key: string]: BoardCell[] } = {};
    // Create 7 empty columns
    for (let col = 0; col < 7; col++) {
      board[col.toString()] = [];
    }
    
    updateGameState({ board });
  }, [updateGameState]);

  // Update room state
  const updateRoom = useCallback((room: Room) => {
    updateGameState({
      room,
      player: room.players.find(p => p.id === playerId) || null,
      isMyTurn: room.current_turn === playerId,
    });
  }, [playerId, updateGameState]);

  // Update player state
  const updatePlayer = useCallback((player: Player) => {
    updateGameState({ player });
  }, [updateGameState]);

  // Update power-up state
  const updatePowerUps = useCallback((powerUps: { [key: string]: PlayerPowerUp }) => {
    updateGameState(state => ({
      ...state,
      powerUps: { ...state.powerUps, ...powerUps },
    }));
  }, [updateGameState]);

  // Make a move in a column
  const makeMove = useCallback((column: number) => {
    if (!gameState.isMyTurn) {
      updateGameState({
        error: "It's not your turn yet!"
      });
      return false;
    }
    
    if (!gameState.isConnected) {
      updateGameState({
        error: "You are disconnected from the game server. Please wait for reconnection."
      });
      return false;
    }
    
    const success = webSocketService.send({
      type: 'move',
      column,
    });
    
    if (!success) {
      updateGameState({
        error: "Failed to send move. Please try again."
      });
    }
    
    return success;
  }, [gameState.isMyTurn, gameState.isConnected, updateGameState]);

  // Use a power-up
  const usePowerUp = useCallback((powerUpId: string, targetData: any) => {
    if (!gameState.powerUps[powerUpId] || gameState.powerUps[powerUpId].remainingUses <= 0) {
      updateGameState({
        error: "You don't have any uses left for this power-up!"
      });
      return false;
    }
    
    if (!gameState.isMyTurn) {
      updateGameState({
        error: "You can only use power-ups during your turn!"
      });
      return false;
    }
    
    if (!gameState.isConnected) {
      updateGameState({
        error: "You are disconnected from the game server. Please wait for reconnection."
      });
      return false;
    }
    
    const success = webSocketService.send({
      type: 'power_up',
      power_up_id: powerUpId,
      target_data: targetData,
    });
    
    if (!success) {
      updateGameState({
        error: "Failed to use power-up. Please try again."
      });
    }
    
    return success;
  }, [gameState.powerUps, gameState.isMyTurn, gameState.isConnected, updateGameState]);

  // Send a chat message
  const sendMessage = useCallback((message: string) => {
    if (!message.trim()) {
      return false;
    }
    
    if (!gameState.isConnected) {
      updateGameState({
        error: "You are disconnected from the game server. Please wait for reconnection."
      });
      return false;
    }
    
    const success = webSocketService.send({
      type: 'chat',
      message,
    });
    
    if (!success) {
      updateGameState({
        error: "Failed to send message. Please try again."
      });
    }
    
    return success;
  }, [gameState.isConnected, updateGameState]);

  // Force reconnection
  const reconnect = useCallback(() => {
    webSocketService.resetConnection();
    updateGameState({
      connectionState: 'connecting',
      error: 'Attempting to reconnect...'
    });
  }, [updateGameState]);

  return {
    ...gameState,
    updateRoom,
    updatePlayer,
    updatePowerUps,
    makeMove,
    usePowerUp,
    sendMessage,
    reconnect,
    updateGameState,
  };
} 
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
    connectionState: 'disconnected'
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

  // Setup WebSocket message handlers
  useEffect(() => {
    if (!playerId) return;

    // Handle game state updates
    const handlers: { [key: string]: (message: any) => void } = {
      // Connection status updates
      connection_established: () => {
        updateGameState({
          connectionState: 'connected',
          error: null // Clear any connection errors
        });
      },
      
      connection_closed: (message) => {
        // Only show error for abnormal closure
        if (message.code !== 1000) {
          updateGameState({
            error: `Connection closed: ${message.message}`,
            connectionState: 'disconnected'
          });
        } else {
          updateGameState({
            connectionState: 'disconnected'
          });
        }
      },
      
      reconnecting: (message) => {
        updateGameState({
          connectionState: 'reconnecting',
          error: `Reconnecting (attempt ${message.attempt} of ${message.maxAttempts})...`
        });
      },
      
      reconnect_failed: () => {
        updateGameState({
          connectionState: 'failed',
          error: 'Connection failed: Unable to reconnect to the game server. Please reload the page to try again.'
        });
      },
      
      // Room updates
      player_joined: (message) => {
        updateGameState(state => ({
          ...state,
          room: state.room ? {
            ...state.room,
            players: [...state.room.players, message.player],
          } : null,
        }));
      },

      player_left: (message) => {
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
          };
        });
      },

      // Game start
      game_started: (message) => {
        updateGameState(state => ({
          ...state,
          room: message.room,
          isMyTurn: message.current_turn === playerId,
          error: null // Clear any previous errors on game start
        }));

        // Initialize board state
        initializeBoard();
      },

      // Move handling
      move_made: (message) => {
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
            error: null // Clear any errors after successful move
          };
        });
      },

      // Power-up events
      power_up_used: (message) => {
        updateGameState(state => {
          // Update power-up inventory if it's this player's power-up
          const updatedPowerUps = { ...state.powerUps };
          
          if (message.player_id === playerId && updatedPowerUps[message.power_up_id]) {
            updatedPowerUps[message.power_up_id] = {
              ...updatedPowerUps[message.power_up_id],
              remainingUses: message.remaining_uses,
            };
          }

          // Add chat message to notify about power-up usage
          const playerName = message.player_id === playerId ? 
            "You" : 
            state.room?.players.find(p => p.id === message.player_id)?.name || "A player";
          
          const powerUpName = updatedPowerUps[message.power_up_id]?.name || message.power_up_id;
          
          const messages = [
            ...state.messages,
            {
              id: `msg-${Date.now()}`,
              playerId: 'system',
              message: `${playerName} used the ${powerUpName} power-up!`,
              timestamp: Date.now(),
            }
          ];

          // Update board state based on power-up effect
          let updatedBoard = { ...state.board };
          const effect = message.effect;

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
      random_event: (message) => {
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
      game_over: (message) => {
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
      chat: (message) => {
        updateGameState(state => ({
          ...state,
          messages: [
            ...state.messages,
            {
              id: `msg-${Date.now()}`,
              playerId: message.player_id,
              message: message.message,
              timestamp: Date.now(),
            },
          ],
        }));
      },

      // Error handling
      error: (message) => {
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
/**
 * Connect 4 on Steroids - RabbitMQ Demo Simulation
 * 
 * This file runs a slower simulation of game events through RabbitMQ
 * specifically designed for demonstration purposes.
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

// RabbitMQ connection settings
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

// Exchange and queue names
const EXCHANGES = {
  GAME_EVENTS: 'connect4.events',
  PLAYER_NOTIFICATIONS: 'connect4.notifications',
  COLUMN_UPDATES: 'connect4.column_updates',
  POWER_UPS: 'connect4.power_ups',
  RANDOM_EVENTS: 'connect4.random_events'
};

// Active game rooms for demo simulation
const activeGames = {};

// Player colors
const PLAYER_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange'];

// Power-up types
const POWER_UP_TYPES = ['double_drop', 'column_bomb', 'gravity_flip', 'undo_move', 'column_block'];

// Random event types
const RANDOM_EVENTS = [
  {
    id: 'gravity_reversal',
    name: 'Gravity Reversal',
    description: 'Gravity has been reversed for all columns!',
    effect: 'All columns now have upward gravity',
    duration: 3
  },
  {
    id: 'column_shuffle',
    name: 'Column Shuffle',
    description: 'All columns have been shuffled!',
    effect: 'Columns are now in random order',
    duration: 2
  },
  {
    id: 'power_surge',
    name: 'Power Surge',
    description: 'Everyone gets an extra power-up!',
    effect: 'All players receive a random power-up',
    duration: 1
  }
];

/**
 * Connect to RabbitMQ
 */
async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    console.log('Connected to RabbitMQ server');
    
    const channel = await connection.createChannel();
    
    // Set up exchanges
    await Promise.all(Object.values(EXCHANGES).map(exchange => 
      channel.assertExchange(exchange, 'topic', { durable: true })
    ));
    
    return { connection, channel };
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
    throw error;
  }
}

/**
 * Create a new game room
 */
function createGameRoom(numPlayers = 2) {
  const roomId = 'room_' + uuidv4().substring(0, 8);
  const players = [];
  
  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: `player${i+1}_${uuidv4().substring(0, 4)}`,
      name: `Player ${i+1}`,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length]
    });
  }
  
  const gameRoom = {
    roomId,
    players,
    currentTurn: players[0].id,
    turnTimeLimit: 30,
    isActive: true,
    board: Array(7).fill().map(() => []),
    startTime: Date.now(),
    lastEventTime: Date.now(),
    eventCount: 0,
    gameOver: false
  };
  
  activeGames[roomId] = gameRoom;
  return gameRoom;
}

/**
 * Get next player's turn
 */
function getNextPlayer(game) {
  const currentIndex = game.players.findIndex(p => p.id === game.currentTurn);
  const nextIndex = (currentIndex + 1) % game.players.length;
  return game.players[nextIndex].id;
}

/**
 * Make a move in a game
 */
function makeMove(game, playerId, column) {
  if (!game.board[column]) {
    game.board[column] = [];
  }
  
  const row = game.board[column].length;
  if (row >= 6) {
    return null; // Column is full
  }
  
  game.board[column].push(playerId);
  game.currentTurn = getNextPlayer(game);
  game.lastEventTime = Date.now();
  game.eventCount++;
  
  return { column, row };
}

/**
 * Use a power-up in a game
 */
function usePowerUp(game, playerId) {
  const powerUpId = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
  let effect = {};
  let targetColumn = Math.floor(Math.random() * 7);
  
  switch (powerUpId) {
    case 'double_drop':
      const col1 = Math.floor(Math.random() * 7);
      const col2 = Math.floor(Math.random() * 7);
      const drop1 = makeMove(game, playerId, col1);
      const drop2 = makeMove(game, playerId, col2);
      effect = { drop1, drop2 };
      break;
    case 'column_bomb':
      game.board[targetColumn] = [];
      effect = { bombed: true, column: targetColumn };
      break;
    case 'gravity_flip':
      effect = { flipped: true };
      break;
    case 'undo_move':
      const randomCol = Math.floor(Math.random() * 7);
      if (game.board[randomCol] && game.board[randomCol].length > 0) {
        game.board[randomCol].pop();
        effect = { undone: true, column: randomCol };
      }
      break;
    case 'column_block':
      effect = { blocked: true, column: targetColumn };
      break;
  }
  
  game.lastEventTime = Date.now();
  game.eventCount++;
  
  return { powerUpId, effect };
}

/**
 * Run the demo simulation with a single game and slower events
 */
async function runDemoSimulation() {
  let connection, channel;
  
  try {
    // Connect to RabbitMQ
    ({ connection, channel } = await connectToRabbitMQ());
    
    console.log('Starting demo simulation with slower event generation...');
    
    // Create a single game room for the demo
    const game = createGameRoom(2); // Just 2 players for simplicity
    
    // Publish game start event
    await channel.publish(
      EXCHANGES.GAME_EVENTS, 
      'game.start', 
      Buffer.from(JSON.stringify({
        event: 'game_started',
        timestamp: Date.now(),
        room: {
          id: game.roomId,
          name: 'Demo Game Room',
          players: game.players,
          max_players: 4,
          is_active: true,
          current_turn: game.currentTurn,
          turn_time_limit: game.turnTimeLimit
        }
      }))
    );
    console.log(`Created and started demo game room ${game.roomId} with ${game.players.length} players`);
    
    // Statistics
    let totalEvents = 1; // Count the game start event
    let startTime = Date.now();
    
    // Print stats periodically
    setInterval(() => {
      const runningTime = (Date.now() - startTime) / 1000;
      const eventsPerSecond = totalEvents / runningTime;
      
      console.log(`\n--- RabbitMQ Demo Stats (${new Date().toLocaleTimeString()}) ---`);
      console.log(`Active games: 1`);
      console.log(`Total events processed: ${totalEvents}`);
      console.log(`Events per second: ${eventsPerSecond.toFixed(2)}`);
      console.log(`Uptime: ${Math.floor(runningTime / 60)} minutes ${Math.floor(runningTime % 60)} seconds`);
      console.log('------------------------------------------\n');
    }, 30000); // Every 30 seconds
    
    // Generate events with longer delays for demo purposes
    let eventCounter = 0;
    
    const generateEvent = async () => {
      try {
        // Get current player
        const currentPlayer = game.players.find(p => p.id === game.currentTurn);
        
        // Decide what type of event to generate based on a pattern for demo
        const eventType = eventCounter % 10; // Cycle through different event types
        
        if (eventType < 7) {
          // Player move (most common)
          const column = Math.floor(Math.random() * 7);
          const moveResult = makeMove(game, currentPlayer.id, column);
          
          if (moveResult) {
            await channel.publish(
              EXCHANGES.GAME_EVENTS,
              'game.move',
              Buffer.from(JSON.stringify({
                event: 'move_made',
                timestamp: Date.now(),
                room_id: game.roomId,
                player_id: currentPlayer.id,
                column: column,
                row: moveResult.row,
                next_turn: game.currentTurn
              }))
            );
            
            console.log(`Player ${currentPlayer.id} made a move in column ${column}, row ${moveResult.row}`);
            totalEvents++;
            
            // Wait a bit before sending column update
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            await channel.publish(
              EXCHANGES.COLUMN_UPDATES,
              'column.update',
              Buffer.from(JSON.stringify({
                event: 'column_updated',
                timestamp: Date.now(),
                room_id: game.roomId,
                column_id: column,
                cells: game.board[column].map((playerId, idx) => ({ player_id: playerId, row: idx }))
              }))
            );
            
            console.log(`Column ${column} updated with new cell`);
            totalEvents++;
          }
        } else if (eventType < 9) {
          // Power-up use (less frequent)
          const { powerUpId, effect } = usePowerUp(game, currentPlayer.id);
          
          await channel.publish(
            EXCHANGES.POWER_UPS,
            'power_up.used',
            Buffer.from(JSON.stringify({
              event: 'power_up_used',
              timestamp: Date.now(),
              room_id: game.roomId,
              player_id: currentPlayer.id,
              power_up_id: powerUpId,
              target_data: { column: effect.column || 0 },
              effect: effect
            }))
          );
          
          console.log(`Player ${currentPlayer.id} used power-up ${powerUpId}`);
          totalEvents++;
          
          // If it affected columns, update them after a delay
          if (effect.bombed || effect.undone) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const column = effect.column;
            await channel.publish(
              EXCHANGES.COLUMN_UPDATES,
              'column.update',
              Buffer.from(JSON.stringify({
                event: 'column_updated',
                timestamp: Date.now(),
                room_id: game.roomId,
                column_id: column,
                cells: game.board[column].map((playerId, idx) => ({ player_id: playerId, row: idx }))
              }))
            );
            
            console.log(`Column ${column} updated after power-up effect`);
            totalEvents++;
          }
        } else {
          // Random event (rare)
          const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
          const affectedColumns = [0, 2, 4, 6]; // Just some columns for demo
          
          await channel.publish(
            EXCHANGES.RANDOM_EVENTS,
            'event.triggered',
            Buffer.from(JSON.stringify({
              event: 'random_event',
              timestamp: Date.now(),
              room_id: game.roomId,
              event_data: event,
              effect_result: { affected_columns: affectedColumns }
            }))
          );
          
          console.log(`Random event "${event.name}" triggered`);
          totalEvents++;
          
          // Send notifications to players with delay
          for (const player of game.players) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await channel.publish(
              EXCHANGES.PLAYER_NOTIFICATIONS,
              `notification.player.${player.id}`,
              Buffer.from(JSON.stringify({
                event: 'notification',
                timestamp: Date.now(),
                player_id: player.id,
                message: `A random event has occurred: ${event.name}!`
              }))
            );
            
            console.log(`Notification sent to ${player.name}`);
            totalEvents++;
          }
        }
        
        eventCounter++;
        
        // Schedule the next event with a longer delay (5-10 seconds)
        setTimeout(generateEvent, 5000 + Math.random() * 5000);
        
      } catch (error) {
        console.error('Error in demo simulation:', error);
        // Continue generating events even if there's an error
        setTimeout(generateEvent, 5000);
      }
    };
    
    // Start generating events
    setTimeout(generateEvent, 2000);
    
    // Keep the process running
    process.stdin.resume();
    
    console.log('\nDemo simulation is now running. Press Ctrl+C to stop.');
    console.log('Events will be generated every 5-10 seconds for demonstration purposes.\n');
    
  } catch (error) {
    console.error('Fatal error in demo simulation:', error);
    
    // Clean up on error
    if (channel) await channel.close();
    if (connection) await connection.close();
    process.exit(1);
  }
}

// Run the demo simulation
console.log('Connect 4 on Steroids - RabbitMQ Demo Simulation');
console.log('===============================================\n');
console.log('Starting RabbitMQ demo with slower event generation...');
runDemoSimulation().catch(err => {
  console.error('Failed to start demo simulation:', err);
  process.exit(1);
}); 
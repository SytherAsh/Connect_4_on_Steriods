/**
 * Connect 4 on Steroids - RabbitMQ Integration Demo
 * 
 * This file demonstrates how RabbitMQ could be integrated with the Connect 4 game
 * for handling game events, notifications, and distributed processing.
 * 
 * Note: This is a demonstration file only and is not actually integrated with the game.
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

const QUEUES = {
  GAME_EVENTS: 'game_events_queue',
  PLAYER_MOVES: 'player_moves_queue',
  COLUMN_UPDATES: 'column_updates_queue',
  POWER_UP_PROCESSING: 'power_up_processing_queue',
  RANDOM_EVENT_GENERATION: 'random_event_generation_queue',
  PLAYER_NOTIFICATIONS: 'player_notifications_queue'
};

// Active game rooms for continuous simulation
const activeGames = {};

// Player colors
const PLAYER_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'cyan', 'magenta'];

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
  },
  {
    id: 'time_warp',
    name: 'Time Warp',
    description: 'Turn time has been reduced!',
    effect: 'Players have less time to make moves',
    duration: 4
  }
];

/**
 * Connect to RabbitMQ and set up exchanges and queues
 */
async function setupRabbitMQ() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(RABBITMQ_URL);
    console.log('Connected to RabbitMQ server');
    
    // Create a channel
    const channel = await connection.createChannel();
    
    // Set up exchanges
    await Promise.all(Object.values(EXCHANGES).map(exchange => 
      channel.assertExchange(exchange, 'topic', { durable: true })
    ));
    
    // Set up queues and bind them to exchanges
    await channel.assertQueue(QUEUES.GAME_EVENTS, { durable: true });
    await channel.bindQueue(QUEUES.GAME_EVENTS, EXCHANGES.GAME_EVENTS, 'game.#');
    
    await channel.assertQueue(QUEUES.PLAYER_MOVES, { durable: true });
    await channel.bindQueue(QUEUES.PLAYER_MOVES, EXCHANGES.GAME_EVENTS, 'game.move');
    
    await channel.assertQueue(QUEUES.COLUMN_UPDATES, { durable: true });
    await channel.bindQueue(QUEUES.COLUMN_UPDATES, EXCHANGES.COLUMN_UPDATES, 'column.#');
    
    await channel.assertQueue(QUEUES.POWER_UP_PROCESSING, { durable: true });
    await channel.bindQueue(QUEUES.POWER_UP_PROCESSING, EXCHANGES.POWER_UPS, 'power_up.#');
    
    await channel.assertQueue(QUEUES.RANDOM_EVENT_GENERATION, { durable: true });
    await channel.bindQueue(QUEUES.RANDOM_EVENT_GENERATION, EXCHANGES.RANDOM_EVENTS, 'event.#');
    
    await channel.assertQueue(QUEUES.PLAYER_NOTIFICATIONS, { durable: true });
    await channel.bindQueue(QUEUES.PLAYER_NOTIFICATIONS, EXCHANGES.PLAYER_NOTIFICATIONS, 'notification.#');
    
    console.log('Exchanges and queues set up successfully');
    
    return { connection, channel };
  } catch (error) {
    console.error('Error setting up RabbitMQ:', error);
    throw error;
  }
}

/**
 * Create a new game room
 */
function createGameRoom(numPlayers = 4) {
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
 * Get a random active game room
 */
function getRandomActiveGame() {
  const roomIds = Object.keys(activeGames).filter(id => !activeGames[id].gameOver);
  if (roomIds.length === 0) {
    return createGameRoom(Math.floor(Math.random() * 3) + 2); // 2-4 players
  }
  return activeGames[roomIds[Math.floor(Math.random() * roomIds.length)]];
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
 * Trigger a random event
 */
function triggerRandomEvent(game) {
  const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
  const affectedColumns = [];
  
  for (let i = 0; i < 7; i++) {
    if (Math.random() > 0.3) {
      affectedColumns.push(i);
    }
  }
  
  game.lastEventTime = Date.now();
  game.eventCount++;
  
  return {
    event,
    effectResult: { affected_columns: affectedColumns }
  };
}

/**
 * Check if a game is over (for simulation purposes)
 */
function checkGameOver(game) {
  // Simulate game over after a certain number of events
  if (game.eventCount > 30 || (Date.now() - game.startTime) > 5 * 60 * 1000) {
    const winner = game.players[Math.floor(Math.random() * game.players.length)];
    const winTypes = ['horizontal', 'vertical', 'diagonal_rising', 'diagonal_falling'];
    const winType = winTypes[Math.floor(Math.random() * winTypes.length)];
    
    // Generate some plausible winning positions
    const positions = [];
    const startCol = Math.floor(Math.random() * 4); // 0-3 for horizontal
    const startRow = Math.floor(Math.random() * 3); // 0-2 for vertical
    
    for (let i = 0; i < 4; i++) {
      if (winType === 'horizontal') {
        positions.push([startCol + i, startRow]);
      } else if (winType === 'vertical') {
        positions.push([startCol, startRow + i]);
      } else if (winType === 'diagonal_rising') {
        positions.push([startCol + i, startRow + 3 - i]);
      } else {
        positions.push([startCol + i, startRow + i]);
      }
    }
    
    game.gameOver = true;
    return {
      winner: winner.id,
      winType,
      positions
    };
  }
  
  return null;
}

/**
 * Simulate game events and publish them to RabbitMQ continuously
 */
async function simulateGameEvents(channel) {
  console.log('Starting continuous game event simulation...');
  
  // Create initial game rooms
  for (let i = 0; i < 3; i++) {
    const numPlayers = Math.floor(Math.random() * 3) + 2; // 2-4 players
    const game = createGameRoom(numPlayers);
    
    // Publish game start event
    await channel.publish(
      EXCHANGES.GAME_EVENTS, 
      'game.start', 
      Buffer.from(JSON.stringify({
        event: 'game_started',
        timestamp: Date.now(),
        room: {
          id: game.roomId,
          name: `Game Room ${i+1}`,
          players: game.players,
          max_players: 4,
          is_active: true,
          current_turn: game.currentTurn,
          turn_time_limit: game.turnTimeLimit
        }
      }))
    );
    console.log(`Created and started game room ${game.roomId} with ${numPlayers} players`);
  }
  
  // Continuously generate events
  while (true) {
    try {
      // Get a random active game
      const game = getRandomActiveGame();
      
      // Check if the game should end
      const gameOver = checkGameOver(game);
      if (gameOver) {
        await channel.publish(
          EXCHANGES.GAME_EVENTS,
          'game.over',
          Buffer.from(JSON.stringify({
            event: 'game_over',
            timestamp: Date.now(),
            room_id: game.roomId,
            winner: gameOver.winner,
            win_type: gameOver.winType,
            positions: gameOver.positions
          }))
        );
        console.log(`Game ${game.roomId} ended with winner ${gameOver.winner}`);
        
        // Create a new game to replace it
        setTimeout(() => {
          const newGame = createGameRoom(Math.floor(Math.random() * 3) + 2);
          channel.publish(
            EXCHANGES.GAME_EVENTS, 
            'game.start', 
            Buffer.from(JSON.stringify({
              event: 'game_started',
              timestamp: Date.now(),
              room: {
                id: newGame.roomId,
                name: `Game Room ${Object.keys(activeGames).length}`,
                players: newGame.players,
                max_players: 4,
                is_active: true,
                current_turn: newGame.currentTurn,
                turn_time_limit: newGame.turnTimeLimit
              }
            }))
          );
          console.log(`Created and started new game room ${newGame.roomId} with ${newGame.players.length} players`);
        }, 5000);
        
        continue;
      }
      
      // Decide what type of event to generate
      const eventType = Math.random();
      const currentPlayer = game.players.find(p => p.id === game.currentTurn);
      
      if (eventType < 0.6) {
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
          
          console.log(`Player ${currentPlayer.id} made a move in game ${game.roomId}, column ${column}, row ${moveResult.row}`);
        }
      } else if (eventType < 0.8) {
        // Power-up use
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
        
        console.log(`Player ${currentPlayer.id} used power-up ${powerUpId} in game ${game.roomId}`);
        
        // If it affected columns, update them
        if (effect.bombed || effect.undone) {
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
        }
      } else {
        // Random event
        const { event, effectResult } = triggerRandomEvent(game);
        
        await channel.publish(
          EXCHANGES.RANDOM_EVENTS,
          'event.triggered',
          Buffer.from(JSON.stringify({
            event: 'random_event',
            timestamp: Date.now(),
            room_id: game.roomId,
            event_data: event,
            effect_result: effectResult
          }))
        );
        
        // Notify all players
        for (const player of game.players) {
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
        }
        
        console.log(`Random event ${event.name} triggered in game ${game.roomId}`);
      }
      
      // Random delay between events (0.5 - 2 seconds)
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
      
    } catch (error) {
      console.error('Error in continuous simulation:', error);
      // Continue the loop even if there's an error
    }
  }
}

/**
 * Consume messages from queues for demonstration
 */
async function setupConsumers(channel) {
  console.log('Setting up message consumers...');
  
  // Game events consumer
  await channel.consume(
    QUEUES.GAME_EVENTS,
    (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`[GAME_EVENTS] Received: ${content.event}`);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  
  // Player moves consumer
  await channel.consume(
    QUEUES.PLAYER_MOVES,
    (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`[PLAYER_MOVES] Received move from ${content.player_id} to column ${content.column}`);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  
  // Column updates consumer
  await channel.consume(
    QUEUES.COLUMN_UPDATES,
    (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`[COLUMN_UPDATES] Column ${content.column_id} updated`);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  
  // Power-up processing consumer
  await channel.consume(
    QUEUES.POWER_UP_PROCESSING,
    (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`[POWER_UP] ${content.player_id} used ${content.power_up_id}`);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  
  // Random event generation consumer
  await channel.consume(
    QUEUES.RANDOM_EVENT_GENERATION,
    (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`[RANDOM_EVENT] Event triggered: ${content.event_data?.name || 'Unknown event'}`);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  
  // Player notifications consumer
  await channel.consume(
    QUEUES.PLAYER_NOTIFICATIONS,
    (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        console.log(`[NOTIFICATION] To ${content.player_id}: ${content.message}`);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
  
  console.log('All consumers set up successfully');
}

/**
 * Main function to run the RabbitMQ demonstration
 */
async function runDemo() {
  let connection, channel;
  
  try {
    // Set up RabbitMQ
    ({ connection, channel } = await setupRabbitMQ());
    
    // Set up consumers
    await setupConsumers(channel);
    
    // Print status message
    console.log('\nConnect 4 on Steroids - RabbitMQ Integration');
    console.log('===========================================');
    console.log('RabbitMQ integration is now LIVE and processing game events');
    console.log('Press Ctrl+C to stop the service\n');
    
    // Start continuous simulation
    await simulateGameEvents(channel);
    
  } catch (error) {
    console.error('Error in RabbitMQ integration:', error);
    
    // Clean up on error
    if (channel) await channel.close();
    if (connection) await connection.close();
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  console.log('Connect 4 on Steroids - RabbitMQ Integration');
  console.log('===========================================\n');
  console.log('Starting RabbitMQ integration service...');
  runDemo();
}

module.exports = {
  setupRabbitMQ,
  simulateGameEvents,
  setupConsumers,
  runDemo,
  EXCHANGES,
  QUEUES
};
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack,
  HStack,
  useColorModeValue,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
} from '@chakra-ui/react';
import confetti from 'canvas-confetti';
import GameBoard from '../components/GameBoard';
import PlayersList from '../components/PlayersList';
import PowerUpItem from '../components/PowerUpItem';
import GameChat from '../components/GameChat';
import RandomEventAlert from '../components/RandomEventAlert';
import { useGame, PlayerPowerUp, RandomEvent } from '../hooks/useGame';
import GameAPI, { PowerUp } from '../services/GameAPI';

// Use the correct type for React Router v6 params
const GamePage: React.FC = () => {
  const params = useParams();
  const roomId = params.roomId || '';
  const navigate = useNavigate();
  const toast = useToast();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  
  // Ref for confetti canvas
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Local state
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [powerUpSelectionData, setPowerUpSelectionData] = useState<{
    id: string;
    requiresTarget: boolean;
  } | null>(null);

  // Random event display
  const [displayedEvent, setDisplayedEvent] = useState<RandomEvent | null>(null);
  
  // Game over modal
  const { 
    isOpen: isGameOverModalOpen, 
    onOpen: openGameOverModal, 
    onClose: closeGameOverModal 
  } = useDisclosure();
  
  // Initialize game hook
  const game = useGame(roomId, playerId);
  
  // Load player ID from local storage
  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId');
    const storedRoomId = localStorage.getItem('roomId');
    
    if (storedPlayerId && storedRoomId === roomId) {
      setPlayerId(storedPlayerId);
    } else {
      // Redirect to lobby if no valid player ID
      navigate('/lobby');
    }
    
    setIsLoading(false);
  }, [roomId, navigate]);
  
  // Watch for errors and show toast notifications
  useEffect(() => {
    if (game.error) {
      toast({
        title: "Game Error",
        description: game.error,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [game.error, toast]);
  
  // Handle power-up used notification
  useEffect(() => {
    // Monitor all power-up usage events
    const lastMessage = game.messages[game.messages.length - 1];
    if (lastMessage && lastMessage.message.includes('power-up')) {
      toast({
        title: 'Power-Up Used',
        description: lastMessage.message,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [game.messages, toast]);
  
  // Load initial room data
  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) return;
      
      try {
        const rooms = await GameAPI.getRooms();
        const room = rooms.find(r => r.id === roomId);
        
        if (room) {
          game.updateRoom(room);
        } else {
          toast({
            title: 'Room not found',
            description: 'This game room no longer exists',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          navigate('/lobby');
        }
      } catch (error) {
        console.error('Error loading room:', error);
      }
    };
    
    loadRoom();
  }, [roomId, game, navigate, toast]);
  
  // Celebration effect
  const startCelebration = useCallback(() => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#bb0000', '#ffffff', '#ffbb00', '#00bb00', '#0000bb'];
    
    const firework = () => {
      confetti({
        particleCount: 100,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: Math.random(),
          y: Math.random() - 0.2
        },
        colors: colors,
        ticks: 200,
        disableForReducedMotion: true
      });
      
      // Continue animation loop
      if (Date.now() < animationEnd) {
        requestAnimationFrame(firework);
      }
    };
    
    // Fire confetti in different patterns
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.6 }
    });
    
    // Start firework animation
    firework();
    
    // Fire star-shaped confetti
    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 100,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 500);
  }, []);
  
  // Watch for game end
  useEffect(() => {
    if (game.winState.winner) {
      if (game.winState.winner === playerId) {
        startCelebration();
      }
      openGameOverModal();
    }
  }, [game.winState.winner, playerId, openGameOverModal, startCelebration]);
  
  // Show random events
  useEffect(() => {
    // When a new event is added, display it
    const events = game.activeEvents;
    if (events.length > 0 && !displayedEvent) {
      setDisplayedEvent(events[events.length - 1]);
    }
  }, [game.activeEvents, displayedEvent]);
  
  // Load initial power-ups
  useEffect(() => {
    const loadPowerUps = async () => {
      if (!roomId || !playerId) return;
      
      try {
        // Set default power-ups in case API call fails
        const defaultPowerUps: { [key: string]: PlayerPowerUp } = {
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
            description: 'Flip gravity to normal (downward) for the whole board',
            remainingUses: 1
          }
        };
        
        // Set default power-ups
        game.updateGameState({
          powerUps: defaultPowerUps
        });
        
        // Attempt to load from API
        const powerUps = await GameAPI.getPlayerPowerUps(roomId, playerId);
        if (powerUps && Object.keys(powerUps).length > 0) {
          // Convert API PowerUp format to PlayerPowerUp format
          const playerPowerUps: { [key: string]: PlayerPowerUp } = {};
          Object.entries(powerUps).forEach(([key, apiPowerUp]) => {
            playerPowerUps[key] = {
              id: apiPowerUp.id,
              name: apiPowerUp.name,
              description: apiPowerUp.description,
              remainingUses: apiPowerUp.remaining_uses
            };
          });
          
          game.updateGameState({
            powerUps: playerPowerUps
          });
        }
      } catch (error) {
        console.error('Error loading power-ups:', error);
      }
    };
    
    loadPowerUps();
  }, [roomId, playerId, game]);

  // Handle column click
  const handleColumnClick = (columnId: number) => {
    if (powerUpSelectionData) {
      // This is for a power-up target
      handlePowerUpTarget(columnId);
    } else {
      // This is a regular move
      game.makeMove(columnId);
    }
  };
  
  // Start using a power-up
  const handlePowerUpUse = (powerUpId: string) => {
    const powerUp = game.powerUps[powerUpId];
    if (!powerUp || powerUp.remainingUses <= 0 || !game.isMyTurn) return;
    
    // Different power-ups need different handling
    switch (powerUpId) {
      case 'double_drop':
        setPowerUpSelectionData({
          id: powerUpId,
          requiresTarget: true,
        });
        
        toast({
          title: 'Select first column',
          description: 'Click on a column to drop your first disc',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        break;
        
      case 'column_bomb':
      case 'column_block':
        setPowerUpSelectionData({
          id: powerUpId,
          requiresTarget: true,
        });
        
        toast({
          title: 'Select target column',
          description: 'Click on a column to use this power-up',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        break;
        
      case 'gravity_flip':
        setPowerUpSelectionData({
          id: powerUpId,
          requiresTarget: true,
        });
        
        toast({
          title: 'Flip Gravity Direction',
          description: 'Click on the board to toggle gravity to normal (downward) direction',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        break;
        
      case 'undo_move':
        // Directly use power-up that doesn't need column selection
        game.usePowerUp(powerUpId, {});
        break;
        
      default:
        console.warn('Unknown power-up:', powerUpId);
    }
  };
  
  // Track power-up selection state
  const [powerUpSelection, setPowerUpSelection] = useState<{
    powerUpId: string;
    targetData: any;
  } | null>(null);
  
  // Handle power-up target selection
  const handlePowerUpTarget = (columnId: number) => {
    if (!powerUpSelectionData) return;
    
    const { id: powerUpId } = powerUpSelectionData;
    
    if (powerUpId === 'double_drop') {
      if (!powerUpSelection) {
        // First column selection
        setPowerUpSelection({
          powerUpId,
          targetData: { column1: columnId },
        });
        
        toast({
          title: 'Select second column',
          description: 'Click on a column to drop your second disc',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Second column selection, complete the power-up
        const targetData = {
          ...powerUpSelection.targetData,
          column2: columnId,
        };
        
        game.usePowerUp(powerUpId, targetData);
        
        // Reset selection state
        setPowerUpSelectionData(null);
        setPowerUpSelection(null);
      }
    } else {
      // Single column power-ups
      game.usePowerUp(powerUpId, { column: columnId });
      
      // Reset selection state
      setPowerUpSelectionData(null);
    }
  };
  
  // Cancel power-up selection
  const cancelPowerUpSelection = () => {
    setPowerUpSelectionData(null);
    setPowerUpSelection(null);
  };
  
  // Prepare player colors for the board
  const getPlayerColors = () => {
    const colors: { [key: string]: string } = {};
    
    if (game.room) {
      game.room.players.forEach(player => {
        colors[player.id] = player.color;
      });
    }
    
    // Add current player's color for preview
    if (game.player) {
      colors['current'] = game.player.color;
    }
    
    return colors;
  };
  
  // Handle game over and return to lobby
  const handleReturnToLobby = () => {
    closeGameOverModal();
    navigate('/lobby');
  };
  
  // Add a connection status indicator at the top of the page
  const ConnectionStatus = ({ connectionState }: { connectionState: string }) => {
    let statusColor = 'gray';
    let statusText = 'Disconnected';

    switch (connectionState) {
      case 'connected':
        statusColor = 'green';
        statusText = 'Connected';
        break;
      case 'connecting':
        statusColor = 'blue';
        statusText = 'Connecting...';
        break;
      case 'reconnecting':
        statusColor = 'orange';
        statusText = 'Reconnecting...';
        break;
      case 'failed':
        statusColor = 'red';
        statusText = 'Connection Failed';
        break;
      default:
        statusColor = 'gray';
        statusText = 'Disconnected';
    }

    return (
      <Flex 
        alignItems="center" 
        px={2} 
        py={1} 
        bg={`${statusColor}.50`} 
        color={`${statusColor}.800`}
        borderRadius="md"
        width="auto"
        _dark={{
          bg: `${statusColor}.900`,
          color: `${statusColor}.200`
        }}
      >
        <Box 
          h="8px" 
          w="8px" 
          borderRadius="full" 
          bg={`${statusColor}.500`} 
          mr={2} 
        />
        <Text fontSize="sm" fontWeight="medium">{statusText}</Text>
        
        {(connectionState === 'disconnected' || connectionState === 'failed') && (
          <Button 
            size="xs" 
            colorScheme="blue" 
            ml={2} 
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        )}
      </Flex>
    );
  };
  
  if (isLoading) {
    return (
      <Box minH="100vh" bg={bgColor} display="flex" alignItems="center" justifyContent="center">
        <Text>Loading game...</Text>
      </Box>
    );
  }
  
  return (
    <Box minH="100vh" bg={bgColor} py={4}>
      {/* Invisible canvas for confetti */}
      <canvas 
        ref={confettiCanvasRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 100
        }}
      />
      <Container maxW="container.xl">
        <VStack spacing={4} align="stretch">
          {/* Header */}
          <Flex justifyContent="space-between" alignItems="center">
            <Heading 
              as="h1" 
              size="xl" 
              bgGradient="linear(to-r, brand.500, purple.600)"
              bgClip="text"
            >
              {game.room?.name || 'Connect 4 on Steroids'}
            </Heading>
            <Flex alignItems="center" gap={4}>
              <ConnectionStatus connectionState={game.connectionState} />
              <Button 
                variant="outline" 
                colorScheme="purple" 
                onClick={() => navigate('/lobby')}
              >
                Leave Game
              </Button>
            </Flex>
          </Flex>
          
          {/* Game Status */}
          {!game.room?.is_active && (
            <Alert status="info">
              <AlertIcon />
              <AlertTitle>Waiting for players</AlertTitle>
              <AlertDescription>
                {game.room?.players?.length || 0} / {game.room?.max_players || 4} players have joined.
                {game.room?.players && game.room.players.length >= 2 && ' The game can now be started.'}
              </AlertDescription>
              {game.room?.players && game.room.players.length >= 2 && game.player?.id === game.room?.players[0].id && (
                <Button 
                  ml="auto" 
                  colorScheme="purple" 
                  size="sm"
                  onClick={() => GameAPI.startGame(roomId || '')}
                >
                  Start Game
                </Button>
              )}
            </Alert>
          )}
          
          {/* Game Error with improved display */}
          {game.error && (
            <Alert status="error" mb={4}>
              <AlertIcon />
              <Box flex="1">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription display="block">
                  {game.error}
                  {(game.connectionState === 'disconnected' || game.connectionState === 'failed') && (
                    <Text mt={2} fontWeight="bold">
                      Connection to the game server is lost. Please try reconnecting.
                    </Text>
                  )}
                </AlertDescription>
              </Box>
              <Flex direction="column" ml={2}>
                <CloseButton
                  size="sm"
                  onClick={() => {
                    // Clear error message manually
                    const customEvent = new CustomEvent('clearGameError');
                    window.dispatchEvent(customEvent);
                  }}
                  mb={2}
                />
                {(game.connectionState === 'disconnected' || game.connectionState === 'failed') && (
                  <Button 
                    size="sm" 
                    colorScheme="blue"
                    onClick={() => game.reconnect()}
                  >
                    Reconnect
                  </Button>
                )}
              </Flex>
            </Alert>
          )}
          
          {/* Main Game Content */}
          <Grid 
            templateColumns={{ base: "1fr", lg: "260px 1fr 260px" }}
            gap={4}
          >
            {/* Left Sidebar - Players */}
            <GridItem>
              <VStack spacing={4} align="stretch">
                <Box 
                  p={4} 
                  bg="white" 
                  borderRadius="md" 
                  shadow="sm"
                  _dark={{ bg: 'gray.800' }}
                >
                  <Heading size="md" mb={4}>Players</Heading>
                  <PlayersList 
                    players={game.room?.players || []}
                    currentPlayerId={playerId}
                    currentTurnPlayerId={game.room?.current_turn || null}
                    turnTimeLimit={game.turnTimeLimit}
                    remainingTime={game.remainingTime}
                  />
                </Box>
                
                {/* Power-ups */}
                {game.room?.is_active && (
                  <Box 
                    p={4} 
                    bg="white" 
                    borderRadius="md" 
                    shadow="sm"
                    _dark={{ bg: 'gray.800' }}
                  >
                    <Flex justify="space-between" align="center" mb={4}>
                      <Heading size="md">Power-ups</Heading>
                      {powerUpSelectionData && (
                        <Button 
                          size="xs" 
                          colorScheme="red" 
                          onClick={cancelPowerUpSelection}
                        >
                          Cancel
                        </Button>
                      )}
                    </Flex>
                    
                    {/* Show default power-ups if none are available */}
                    {Object.keys(game.powerUps).length === 0 ? (
                      <Alert status="info" mb={2}>
                        <AlertIcon />
                        <Text fontSize="sm">Loading power-ups...</Text>
                      </Alert>
                    ) : (
                      <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                        {Object.values(game.powerUps).map(powerUp => (
                          <PowerUpItem 
                            key={powerUp.id}
                            powerUp={powerUp}
                            isMyTurn={game.isMyTurn && !powerUpSelectionData}
                            onUse={() => handlePowerUpUse(powerUp.id)}
                            isActive={powerUpSelectionData?.id === powerUp.id}
                          />
                        ))}
                      </Grid>
                    )}
                  </Box>
                )}
              </VStack>
            </GridItem>
            
            {/* Game Board */}
            <GridItem>
              <Box 
                p={4} 
                bg="white" 
                borderRadius="md" 
                shadow="sm"
                _dark={{ bg: 'gray.800' }}
                position="relative"
              >
                <VStack spacing={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Heading size="md">Game Board</Heading>
                    {game.room?.is_active && (
                      <Text 
                        fontWeight="bold" 
                        color={game.isMyTurn ? 'green.500' : 'gray.500'}
                      >
                        {game.isMyTurn ? 'Your turn!' : 'Waiting for opponent...'}
                      </Text>
                    )}
                  </Flex>
                  
                  <Box>
                    <GameBoard 
                      board={game.board}
                      onColumnClick={handleColumnClick}
                      isMyTurn={game.isMyTurn}
                      isGameActive={!!game.room?.is_active && !game.winState.winner}
                      playerColors={getPlayerColors()}
                      winPositions={game.winState.positions}
                      isGravityFlipped={game.isGravityFlipped}
                      turnTimeLimit={game.turnTimeLimit}
                      remainingTime={game.remainingTime}
                    />
                  </Box>
                </VStack>
              </Box>
            </GridItem>
            
            {/* Right Sidebar - Chat */}
            <GridItem>
              <Box height="100%">
                <GameChat 
                  messages={game.messages}
                  players={game.room?.players || []}
                  currentPlayerId={playerId}
                  onSendMessage={game.sendMessage}
                />
              </Box>
            </GridItem>
          </Grid>
          
          {/* Active Events List */}
          {game.activeEvents.length > 0 && (
            <Box 
              p={4} 
              bg="white" 
              borderRadius="md" 
              shadow="sm"
              _dark={{ bg: 'gray.800' }}
            >
              <Heading size="md" mb={3}>Active Events</Heading>
              <HStack spacing={4} overflow="auto" pb={2}>
                {game.activeEvents.map(event => (
                  <Box 
                    key={event.id}
                    p={3}
                    borderWidth="1px"
                    borderRadius="md"
                    borderColor="red.300"
                    bg="red.50"
                    _dark={{ bg: 'red.900', borderColor: 'red.700' }}
                    minW="200px"
                  >
                    <Text fontWeight="bold">{event.name}</Text>
                    <Text fontSize="sm">{event.description}</Text>
                  </Box>
                ))}
              </HStack>
            </Box>
          )}
        </VStack>
      </Container>
      
      {/* Random Event Alert Popup */}
      {displayedEvent && (
        <RandomEventAlert 
          event={displayedEvent}
          onAnimationComplete={() => setDisplayedEvent(null)}
        />
      )}
      
      {/* Game Over Modal */}
      <Modal isOpen={isGameOverModalOpen} onClose={closeGameOverModal} closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Game Over!</ModalHeader>
          <ModalBody>
            {game.winState.winner === 'draw' ? (
              <Text>The game ended in a draw! Nobody wins.</Text>
            ) : (
              <>
                <Text mb={2}>
                  {game.winState.winner === playerId
                    ? '🎉 Congratulations! You won the game!'
                    : `Player ${game.room?.players.find(p => p.id === game.winState.winner)?.name || 'Unknown'} has won the game!`}
                </Text>
                <Text>
                  Win type: {game.winState.winType?.replace('_', ' ')}
                </Text>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="purple" onClick={handleReturnToLobby}>
              Return to Lobby
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default GamePage; 
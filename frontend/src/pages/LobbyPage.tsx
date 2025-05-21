import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Stack,
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import GameAPI, { Room } from '../services/GameAPI';

const MotionBox = motion(Box);

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const highlightColor = useColorModeValue('purple.50', 'purple.900');
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [savedPlayerName, setSavedPlayerName] = useState('');

  // Create Room Modal
  const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onClose: onCreateModalClose } = useDisclosure();
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [randomEventsEnabled, setRandomEventsEnabled] = useState(true);

  // Join Room Modal
  const { isOpen: isJoinModalOpen, onOpen: onJoinModalOpen, onClose: onJoinModalClose } = useDisclosure();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedColor, setSelectedColor] = useState('');

  // Load rooms
  useEffect(() => {
    // Load saved player name from localStorage
    const saved = localStorage.getItem('playerName');
    if (saved) {
      setPlayerName(saved);
      setSavedPlayerName(saved);
    }
    
    loadRooms();
    
    // Refresh rooms every 5 seconds
    const interval = setInterval(loadRooms, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadRooms = async () => {
    try {
      const roomList = await GameAPI.getRooms();
      setRooms(roomList);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast({
        title: 'Error loading game rooms',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCreateRoom = async () => {
    if (!playerName) {
      toast({
        title: 'Player name required',
        description: 'Please enter your name before creating a room',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create the room
      const room = await GameAPI.createRoom({
        name: newRoomName || `${playerName}'s Room`,
        max_players: maxPlayers,
        random_events_enabled: randomEventsEnabled,
      });
      
      // Join the room
      const result = await GameAPI.joinRoom(room.id, {
        name: playerName,
      });
      
      // Save player info
      localStorage.setItem('playerName', playerName);
      localStorage.setItem('playerId', result.player.id);
      localStorage.setItem('roomId', room.id);
      
      // Navigate to game
      navigate(`/game/${room.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: 'Error creating room',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      onCreateModalClose();
    }
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    onJoinModalOpen();
  };

  const handleJoinRoom = async () => {
    if (!playerName || !selectedRoom) {
      toast({
        title: 'Player name required',
        description: 'Please enter your name before joining a room',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Join the room
      const result = await GameAPI.joinRoom(selectedRoom.id, {
        name: playerName,
        color: selectedColor || undefined,
      });
      
      // Save player info
      localStorage.setItem('playerName', playerName);
      localStorage.setItem('playerId', result.player.id);
      localStorage.setItem('roomId', selectedRoom.id);
      
      // Navigate to game
      navigate(`/game/${selectedRoom.id}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: 'Error joining room',
        description: 'The room might be full or the game already started',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      onJoinModalClose();
    }
  };

  const getAvailableColors = () => {
    if (!selectedRoom) return ['red', 'yellow', 'green', 'blue'];
    
    const usedColors = selectedRoom.players.map(p => p.color);
    return ['red', 'yellow', 'green', 'blue'].filter(color => !usedColors.includes(color));
  };

  return (
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={10}>
        <VStack spacing={8} align="stretch">
          <Flex justifyContent="space-between" alignItems="center">
            <Heading 
              as="h1" 
              size="2xl" 
              bgGradient="linear(to-r, brand.500, purple.600)"
              bgClip="text"
            >
              Game Lobby
            </Heading>
            <Button 
              variant="outline" 
              colorScheme="purple" 
              onClick={() => navigate('/')}
            >
              Back to Home
            </Button>
          </Flex>
          
          <Grid templateColumns={{ base: "1fr", md: "300px 1fr" }} gap={8}>
            {/* Player Info */}
            <MotionBox
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
              p={6}
              bg={cardBgColor}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={borderColor}
              shadow="md"
            >
              <VStack align="stretch" spacing={4}>
                <Heading size="md">Player Info</Heading>
                <FormControl>
                  <FormLabel>Your Name</FormLabel>
                  <Input 
                    value={playerName} 
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </FormControl>
                <Button 
                  colorScheme="purple" 
                  isDisabled={!playerName || playerName === savedPlayerName}
                  onClick={() => {
                    localStorage.setItem('playerName', playerName);
                    setSavedPlayerName(playerName);
                    toast({
                      title: 'Name saved',
                      status: 'success',
                      duration: 2000,
                    });
                  }}
                >
                  Save Name
                </Button>
                <Divider />
                <Button 
                  colorScheme="green" 
                  isDisabled={!playerName}
                  onClick={onCreateModalOpen}
                >
                  Create New Room
                </Button>
              </VStack>
            </MotionBox>
            
            {/* Rooms List */}
            <MotionBox
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              p={6}
              bg={cardBgColor}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={borderColor}
              shadow="md"
            >
              <VStack align="stretch" spacing={4}>
                <Flex justifyContent="space-between" alignItems="center">
                  <Heading size="md">Available Rooms</Heading>
                  <Button 
                    size="sm" 
                    colorScheme="blue" 
                    onClick={loadRooms}
                    isLoading={isLoading}
                  >
                    Refresh
                  </Button>
                </Flex>
                
                {rooms.length === 0 ? (
                  <Box p={4} textAlign="center">
                    <Text>No active game rooms found. Create one to get started!</Text>
                  </Box>
                ) : (
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Room Name</Th>
                          <Th>Players</Th>
                          <Th>Status</Th>
                          <Th>Random Events</Th>
                          <Th>Action</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {rooms.map(room => (
                          <Tr 
                            key={room.id}
                            bg={room.is_active ? 'gray.100' : 'transparent'}
                            _dark={{ bg: room.is_active ? 'gray.700' : 'transparent' }}
                          >
                            <Td fontWeight="medium">{room.name}</Td>
                            <Td>{room.players.length} / {room.max_players}</Td>
                            <Td>{room.is_active ? 'In Progress' : 'Waiting'}</Td>
                            <Td>{room.random_events_enabled ? 'Enabled' : 'Disabled'}</Td>
                            <Td>
                              <Button
                                size="sm"
                                colorScheme="purple"
                                isDisabled={room.is_active || room.players.length >= room.max_players || !playerName}
                                onClick={() => handleSelectRoom(room)}
                              >
                                Join
                              </Button>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </VStack>
            </MotionBox>
          </Grid>
        </VStack>
      </Container>
      
      {/* Create Room Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Game Room</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Room Name</FormLabel>
                <Input 
                  value={newRoomName} 
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder={`${playerName}'s Room`}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Max Players</FormLabel>
                <NumberInput 
                  min={2} 
                  max={4} 
                  value={maxPlayers}
                  onChange={(valueString) => setMaxPlayers(Number(valueString))}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
              
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="random-events" mb="0">
                  Enable Random Events
                </FormLabel>
                <Switch 
                  id="random-events" 
                  isChecked={randomEventsEnabled}
                  onChange={(e) => setRandomEventsEnabled(e.target.checked)}
                  colorScheme="purple"
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="purple" 
              onClick={handleCreateRoom}
              isLoading={isLoading}
            >
              Create & Join
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Join Room Modal */}
      <Modal isOpen={isJoinModalOpen} onClose={onJoinModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Join Game Room</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontWeight="bold">{selectedRoom?.name}</Text>
              <Text>
                Players: {selectedRoom?.players.length} / {selectedRoom?.max_players}
              </Text>
              
              <Box>
                <Text fontWeight="medium" mb={2}>Current Players:</Text>
                {selectedRoom?.players.map(player => (
                  <Flex key={player.id} alignItems="center" mb={1}>
                    <Box 
                      w="12px" 
                      h="12px" 
                      borderRadius="full" 
                      bg={player.color} 
                      mr={2} 
                    />
                    <Text>{player.name}</Text>
                  </Flex>
                ))}
              </Box>
              
              <FormControl>
                <FormLabel>Choose Color</FormLabel>
                <Select 
                  value={selectedColor} 
                  onChange={(e) => setSelectedColor(e.target.value)}
                  placeholder="Select color"
                >
                  {getAvailableColors().map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onJoinModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="purple" 
              onClick={handleJoinRoom}
              isLoading={isLoading}
            >
              Join Game
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default LobbyPage; 
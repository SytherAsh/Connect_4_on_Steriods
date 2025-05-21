import React from 'react';
import {
  Box,
  VStack,
  Flex,
  Text,
  Avatar,
  Badge,
  useColorModeValue,
  Progress,
  Tooltip,
} from '@chakra-ui/react';
import { Player } from '../services/GameAPI';

interface PlayersListProps {
  players: Player[];
  currentPlayerId: string | null;
  currentTurnPlayerId: string | null;
  turnTimeLimit?: number;
  remainingTime?: number;
}

const PlayersList: React.FC<PlayersListProps> = ({
  players,
  currentPlayerId,
  currentTurnPlayerId,
  turnTimeLimit = 30,
  remainingTime = 30,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const highlightColor = useColorModeValue('purple.50', 'purple.900');
  const highlightBorderColor = useColorModeValue('purple.200', 'purple.700');
  
  // Calculate timer percentage
  const timerPercentage = (remainingTime / turnTimeLimit) * 100;
  
  // Determine timer color based on remaining time
  const getTimerColor = (percentage: number) => {
    if (percentage > 60) return 'green';
    if (percentage > 30) return 'yellow';
    return 'red';
  };
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <VStack spacing={2} align="stretch">
      {players.map((player) => {
        const isCurrentPlayer = player.id === currentPlayerId;
        const isCurrentTurn = player.id === currentTurnPlayerId;
        
        return (
          <Box
            key={player.id}
            p={3}
            borderRadius="md"
            border="1px solid"
            borderColor={isCurrentPlayer ? highlightBorderColor : borderColor}
            bg={isCurrentPlayer ? highlightColor : bgColor}
            position="relative"
          >
            <Flex align="center">
              <Avatar 
                size="sm" 
                name={player.name} 
                bg={player.color} 
                color="white"
                mr={3}
              />
              <Box flex="1">
                <Text fontWeight="bold">
                  {player.name}
                  {isCurrentPlayer && (
                    <Badge ml={2} colorScheme="purple" fontSize="xs">
                      You
                    </Badge>
                  )}
                </Text>
              </Box>
              {isCurrentTurn && (
                <Badge colorScheme="green" variant="solid">
                  Turn
                </Badge>
              )}
            </Flex>
            
            {/* Turn timer - only show for current turn */}
            {isCurrentTurn && (
              <Tooltip label={`Time remaining: ${formatTime(remainingTime)}`}>
                <Box mt={2}>
                  <Flex justify="space-between" mb={1}>
                    <Text fontSize="xs" fontWeight="bold">
                      Time remaining
                    </Text>
                    <Text fontSize="xs" fontWeight="bold">
                      {formatTime(remainingTime)}
                    </Text>
                  </Flex>
                  <Progress 
                    value={timerPercentage} 
                    size="xs" 
                    colorScheme={getTimerColor(timerPercentage)}
                    borderRadius="full"
                    hasStripe={remainingTime < 10}
                    isAnimated={remainingTime < 10}
                  />
                </Box>
              </Tooltip>
            )}
          </Box>
        );
      })}
      
      {players.length === 0 && (
        <Box p={4} textAlign="center">
          <Text color="gray.500">No players have joined yet</Text>
        </Box>
      )}
    </VStack>
  );
};

export default PlayersList; 
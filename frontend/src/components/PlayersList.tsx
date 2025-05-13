import React from 'react';
import {
  Box,
  VStack,
  Flex,
  Text,
  Avatar,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { Player } from '../services/GameAPI';

interface PlayersListProps {
  players: Player[];
  currentPlayerId: string | null;
  currentTurnPlayerId: string | null;
}

const PlayersList: React.FC<PlayersListProps> = ({
  players,
  currentPlayerId,
  currentTurnPlayerId,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  return (
    <VStack spacing={2} align="stretch" width="100%">
      {players.map(player => {
        const isCurrentPlayer = player.id === currentPlayerId;
        const isCurrentTurn = player.id === currentTurnPlayerId;
        
        return (
          <Box
            key={player.id}
            p={3}
            borderWidth="1px"
            borderRadius="md"
            borderColor={isCurrentTurn ? 'purple.500' : borderColor}
            bg={isCurrentTurn ? 'purple.50' : bgColor}
            _dark={{ bg: isCurrentTurn ? 'purple.900' : bgColor }}
            transition="all 0.2s"
            boxShadow={isCurrentTurn ? 'md' : 'none'}
          >
            <Flex align="center">
              <Box 
                width="24px"
                height="24px"
                borderRadius="full"
                bg={player.color}
                mr={3}
              />
              <Avatar 
                size="sm" 
                name={player.name} 
                mr={3} 
                bg={`${player.color}.400`}
                color="white"
              />
              <Text fontWeight={isCurrentPlayer ? 'bold' : 'normal'} flex="1">
                {player.name} {isCurrentPlayer && "(You)"}
              </Text>
              {isCurrentTurn && (
                <Badge colorScheme="purple" fontSize="sm">
                  Current Turn
                </Badge>
              )}
            </Flex>
          </Box>
        );
      })}
      
      {players.length === 0 && (
        <Box p={4} textAlign="center">
          <Text>No players have joined yet.</Text>
        </Box>
      )}
    </VStack>
  );
};

export default PlayersList; 
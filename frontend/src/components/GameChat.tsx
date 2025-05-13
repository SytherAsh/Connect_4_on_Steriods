import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Input,
  Button,
  VStack,
  Heading,
  useColorModeValue,
  Avatar,
} from '@chakra-ui/react';
import { Player } from '../services/GameAPI';

interface Message {
  id: string;
  playerId: string;
  message: string;
  timestamp: number;
}

interface GameChatProps {
  messages: Message[];
  players: Player[];
  currentPlayerId: string | null;
  onSendMessage: (message: string) => void;
}

const GameChat: React.FC<GameChatProps> = ({
  messages,
  players,
  currentPlayerId,
  onSendMessage,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };
  
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSendMessage();
    }
  };
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getPlayerById = (playerId: string) => {
    return players.find(p => p.id === playerId);
  };
  
  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      borderColor={borderColor}
      bg={bgColor}
      height="100%"
      display="flex"
      flexDirection="column"
    >
      <Box p={3} borderBottomWidth="1px" borderColor={borderColor}>
        <Heading size="sm">Game Chat</Heading>
      </Box>
      
      <VStack
        flex="1"
        p={3}
        spacing={2}
        align="stretch"
        overflowY="auto"
        maxHeight="300px"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'gray',
            borderRadius: '24px',
          },
        }}
      >
        {messages.length === 0 ? (
          <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
            No messages yet. Start the conversation!
          </Text>
        ) : (
          messages.map(msg => {
            const player = getPlayerById(msg.playerId);
            const isCurrentUser = msg.playerId === currentPlayerId;
            
            return (
              <Box
                key={msg.id}
                alignSelf={isCurrentUser ? 'flex-end' : 'flex-start'}
                maxWidth="80%"
              >
                <Flex direction="column">
                  <Flex mb={1} align="center">
                    {!isCurrentUser && (
                      <Avatar 
                        size="xs" 
                        name={player?.name} 
                        bg={`${player?.color || 'gray'}.400`}
                        mr={1}
                      />
                    )}
                    <Text fontSize="xs" color="gray.500">
                      {isCurrentUser ? 'You' : player?.name || 'Unknown'}{' '}
                      <span>• {formatTime(msg.timestamp)}</span>
                    </Text>
                  </Flex>
                  <Box
                    p={2}
                    bg={isCurrentUser ? 'purple.500' : 'gray.100'}
                    color={isCurrentUser ? 'white' : 'gray.800'}
                    _dark={{
                      bg: isCurrentUser ? 'purple.500' : 'gray.700',
                      color: 'white',
                    }}
                    borderRadius="md"
                  >
                    <Text fontSize="sm">{msg.message}</Text>
                  </Box>
                </Flex>
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </VStack>
      
      <Flex p={3} borderTopWidth="1px" borderColor={borderColor}>
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          mr={2}
          size="sm"
        />
        <Button 
          onClick={handleSendMessage} 
          colorScheme="purple" 
          size="sm"
          isDisabled={!newMessage.trim()}
        >
          Send
        </Button>
      </Flex>
    </Box>
  );
};

export default GameChat; 
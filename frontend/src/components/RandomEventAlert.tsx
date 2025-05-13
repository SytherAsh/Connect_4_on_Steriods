import React, { useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Icon,
  useColorModeValue,
  Button,
  CloseButton,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RandomEvent } from '../hooks/useGame';
import { 
  FaExclamationTriangle, 
  FaBolt, 
  FaRandom, 
  FaLightbulb, 
  FaSync,
  FaExchangeAlt
} from 'react-icons/fa';

const MotionBox = motion(Box);

interface RandomEventAlertProps {
  event: RandomEvent;
  onAnimationComplete?: () => void;
}

// Map of event types to icons
const EVENT_ICONS: { [key: string]: any } = {
  earthquake: FaExclamationTriangle,
  blackout: FaLightbulb,
  speed_round: FaBolt,
  power_surge: FaRandom,
  reverse_gravity: FaSync,
  column_swap: FaExchangeAlt,
};

const RandomEventAlert: React.FC<RandomEventAlertProps> = ({
  event,
  onAnimationComplete,
}) => {
  const bgColor = useColorModeValue('red.500', 'red.600');
  const textColor = 'white';
  
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onAnimationComplete]);
  
  return (
    <AnimatePresence>
      <MotionBox
        className="random-event-animation"
        position="fixed"
        top="50%"
        left="50%"
        zIndex={1000}
        initial={{ opacity: 0, scale: 0.5, x: '-50%', y: '-50%' }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
        exit={{ opacity: 0, scale: 0.5, x: '-50%', y: '-50%' }}
        transition={{ duration: 0.3 }}
        p={6}
        bg={bgColor}
        color={textColor}
        borderRadius="lg"
        shadow="2xl"
        maxW="400px"
        width="90%"
        textAlign="center"
        position="relative"
      >
        <CloseButton 
          position="absolute" 
          top="8px" 
          right="8px" 
          color="white" 
          onClick={onAnimationComplete} 
        />
        <Flex direction="column" align="center" justify="center">
          <Icon
            as={EVENT_ICONS[event.id] || FaExclamationTriangle}
            boxSize={10}
            mb={3}
          />
          <Heading size="lg" mb={2}>{event.name}</Heading>
          <Text fontSize="md">{event.description}</Text>
          {event.duration > 1 && (
            <Text fontSize="sm" mt={3} opacity={0.8}>
              Lasts for {event.duration} turns
            </Text>
          )}
          <Button 
            mt={4}
            colorScheme="whiteAlpha"
            size="sm"
            onClick={onAnimationComplete}
          >
            Close
          </Button>
        </Flex>
      </MotionBox>
    </AnimatePresence>
  );
};

export default RandomEventAlert; 
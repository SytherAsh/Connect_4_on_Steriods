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
        className="random-event-notification"
        position="fixed"
        bottom="20px"
        left="50%"
        zIndex={1000}
        initial={{ opacity: 0, y: 100, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: 100, x: '-50%' }}
        transition={{ duration: 0.3 }}
        p={4}
        bg={bgColor}
        color={textColor}
        borderRadius="lg"
        shadow="lg"
        maxW="400px"
        width="90%"
        textAlign="center"
      >
        <CloseButton 
          position="absolute" 
          top="8px" 
          right="8px" 
          color="white" 
          onClick={onAnimationComplete} 
        />
        <Flex alignItems="center" justifyContent="center">
          <Icon
            as={EVENT_ICONS[event.id] || FaExclamationTriangle}
            boxSize={8}
            mr={3}
          />
          <Box>
            <Heading size="md" mb={1}>{event.name}</Heading>
            <Text fontSize="sm" mb={2}>{event.description}</Text>
            {event.duration > 1 && (
              <Text fontSize="xs" fontStyle="italic">
                Lasts for {event.duration} turns
              </Text>
            )}
          </Box>
        </Flex>
      </MotionBox>
    </AnimatePresence>
  );
};

export default RandomEventAlert; 
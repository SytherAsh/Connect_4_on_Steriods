import React from 'react';
import {
  Box,
  Flex,
  Heading,
  Icon,
  Tooltip,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';
import { PlayerPowerUp } from '../hooks/useGame';
import { 
  FaBolt, 
  FaUndo, 
  FaBomb, 
  FaLock, 
  FaArrowDown, 
  FaExchangeAlt 
} from 'react-icons/fa';

interface PowerUpItemProps {
  powerUp: PlayerPowerUp;
  isMyTurn: boolean;
  onUse: () => void;
  isActive?: boolean;
}

// Map of power-up ID to icon
const POWER_UP_ICONS: { [key: string]: any } = {
  double_drop: FaBolt,
  undo_move: FaUndo,
  column_bomb: FaBomb,
  column_block: FaLock,
  gravity_flip: FaArrowDown,
  steal_column: FaExchangeAlt,
};

const PowerUpItem: React.FC<PowerUpItemProps> = ({
  powerUp,
  isMyTurn,
  onUse,
  isActive = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const activeBgColor = useColorModeValue('purple.50', 'purple.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const iconColor = useColorModeValue('brand.500', 'brand.300');
  
  const usesLeft = powerUp.remainingUses;
  const isDisabled = usesLeft <= 0 || !isMyTurn;
  
  return (
    <Tooltip
      label={`${powerUp.name}: ${powerUp.description}`}
      placement="top"
      hasArrow
    >
      <Box
        className={isActive ? 'power-up-active' : ''}
        p={3}
        bg={isActive ? activeBgColor : bgColor}
        borderRadius="md"
        borderWidth="1px"
        borderColor={borderColor}
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
        onClick={() => !isDisabled && onUse()}
        opacity={isDisabled ? 0.6 : 1}
        transition="all 0.2s"
        _hover={!isDisabled ? { transform: 'translateY(-2px)', shadow: 'md' } : {}}
        textAlign="center"
      >
        <Flex direction="column" align="center" justify="center">
          <Icon as={POWER_UP_ICONS[powerUp.id] || FaBolt} boxSize={6} color={iconColor} mb={2} />
          <Heading size="xs" mb={1} noOfLines={1}>{powerUp.name}</Heading>
          <Badge colorScheme={usesLeft > 0 ? 'green' : 'red'}>
            {usesLeft} {usesLeft === 1 ? 'use' : 'uses'} left
          </Badge>
        </Flex>
      </Box>
    </Tooltip>
  );
};

export default PowerUpItem; 
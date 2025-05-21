import React, { useState } from 'react';
import {
  Box,
  Flex,
  Grid,
  GridItem,
  useColorModeValue,
  Badge,
  Icon,
  Tooltip,
  Text,
  Progress,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { BoardCell } from '../hooks/useGame';
import { FaArrowUp, FaArrowDown, FaClock } from 'react-icons/fa';

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

interface GameBoardProps {
  board: { [key: string]: BoardCell[] };
  onColumnClick: (columnId: number) => void;
  isMyTurn: boolean;
  isGameActive: boolean;
  playerColors: { [key: string]: string };
  winPositions?: [number, number][] | null;
  isGravityFlipped?: boolean;
  turnTimeLimit?: number;
  remainingTime?: number;
}

const GameBoard: React.FC<GameBoardProps> = ({
  board,
  onColumnClick,
  isMyTurn,
  isGameActive,
  playerColors,
  winPositions,
  isGravityFlipped = true,
  turnTimeLimit = 30,
  remainingTime = 30,
}) => {
  const [hoverColumn, setHoverColumn] = useState<number | null>(null);
  
  const boardBgColor = useColorModeValue('blue.500', 'blue.800');
  const cellBgColor = useColorModeValue('white', 'gray.700');
  const hoverBgColor = useColorModeValue('blue.400', 'blue.700');
  
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
  
  // Generate the board grid
  const renderGrid = () => {
    const columns = [];
    
    for (let col = 0; col < 7; col++) {
      const colCells = board[col.toString()] || [];
      const cells = [];
      
      // Determine cell content based on board state
      for (let row = 0; row < 6; row++) {
        const cell = colCells.find(c => c.row === row);
        const isWinningCell = winPositions?.some(([c, r]) => c === col && r === row) || false;
        
        cells.push(
          <GridItem key={`cell-${col}-${row}`}>
            <Box
              className="game-board-cell"
              w="60px"
              h="60px"
              borderRadius="full"
              bg={cellBgColor}
              display="flex"
              alignItems="center"
              justifyContent="center"
              m={1}
              position="relative"
              overflow="hidden"
              boxShadow="inset 0 0 5px rgba(0,0,0,0.3)"
            >
              {cell && (
                <MotionBox
                  className={isGravityFlipped ? "game-disc-flipped" : "game-disc"}
                  position="absolute"
                  w="52px"
                  h="52px"
                  borderRadius="full"
                  bg={cell.playerId !== null ? playerColors[cell.playerId] : 'gray.400'}
                  initial={{ y: isGravityFlipped ? 300 : -300 }}
                  animate={{ y: 0 }}
                  transition={{ 
                    type: 'spring', 
                    bounce: 0.3,
                    duration: 0.5,
                  }}
                  boxShadow={isWinningCell ? '0 0 12px 2px yellow' : 'none'}
                  border={isWinningCell ? '2px solid yellow' : 'none'}
                  zIndex={1}
                />
              )}
            </Box>
          </GridItem>
        );
      }
      
      // Stack cells in a column
      columns.push(
        <Flex
          key={`col-${col}`}
          direction={isGravityFlipped ? "column" : "column-reverse"}
          alignItems="center"
          cursor={isMyTurn && isGameActive ? 'pointer' : 'default'}
          onClick={() => isMyTurn && isGameActive && onColumnClick(col)}
          onMouseEnter={() => setHoverColumn(col)}
          onMouseLeave={() => setHoverColumn(null)}
          opacity={isMyTurn && isGameActive ? 1 : 0.9}
          position="relative"
          bg={hoverColumn === col && isMyTurn && isGameActive ? hoverBgColor : 'transparent'}
          borderRadius="md"
          transition="background 0.2s"
        >
          {/* Preview disc for current player's turn */}
          {hoverColumn === col && isMyTurn && isGameActive && (
            <MotionFlex
              position="absolute"
              top={isGravityFlipped ? "auto" : "-30px"}
              bottom={isGravityFlipped ? "-30px" : "auto"}
              left="0"
              right="0"
              justify="center"
              initial={{ opacity: 0, y: isGravityFlipped ? 10 : -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Box
                w="40px"
                h="40px"
                borderRadius="full"
                bg={playerColors['current'] || 'gray.400'}
                opacity={0.8}
              />
            </MotionFlex>
          )}
          {cells}
        </Flex>
      );
    }
    
    return columns;
  };
  
  return (
    <Box
      p={4}
      bg={boardBgColor}
      borderRadius="xl"
      shadow="lg"
      mb={4}
      position="relative"
    >
      {/* Turn timer - removed as requested */}
      
      {/* Gravity direction indicator */}
      <Tooltip 
        label={isGravityFlipped ? "Gravity is reversed (pieces go upward)" : "Normal gravity (pieces fall down)"} 
        placement="top"
      >
        <Badge 
          position="absolute" 
          top="8px" 
          right="8px" 
          colorScheme={isGravityFlipped ? "purple" : "blue"} 
          display="flex" 
          alignItems="center"
          px={2}
          py={1}
          borderRadius="md"
        >
          Gravity <Icon as={isGravityFlipped ? FaArrowUp : FaArrowDown} ml={1} />
        </Badge>
      </Tooltip>
      <Flex justify="center" align="center">
        {renderGrid()}
      </Flex>
    </Box>
  );
};

export default GameBoard; 
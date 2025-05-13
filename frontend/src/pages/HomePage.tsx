import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  Image,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);
const MotionHeading = motion(Heading);
const MotionText = motion(Text);

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  return (
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={10}>
        <VStack spacing={10} align="center">
          {/* Hero Section */}
          <Flex 
            direction="column" 
            alignItems="center" 
            justifyContent="center" 
            textAlign="center"
            py={16}
          >
            <MotionBox
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Heading 
                as="h1" 
                size="4xl" 
                bgGradient="linear(to-r, brand.500, purple.600)"
                bgClip="text"
                mb={4}
              >
                Connect 4 on Steroids
              </Heading>
            </MotionBox>
            
            <MotionText
              fontSize="xl"
              maxW="700px"
              mb={8}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              A distributed systems-enhanced multiplayer game with power-ups, 
              real-time action, and chaotic random events!
            </MotionText>
            
            <MotionBox
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button 
                colorScheme="purple" 
                size="lg" 
                px={8} 
                fontSize="lg"
                onClick={() => navigate('/lobby')}
              >
                Play Now
              </Button>
            </MotionBox>
          </Flex>
          
          {/* Features Section */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={8} width="100%">
            <FeatureCard
              title="Multiplayer Mayhem"
              description="2-4 players compete in real-time with unique power-ups and strategies."
              delay={0.1}
            />
            <FeatureCard
              title="Power-Ups Galore"
              description="Double drops, column bombs, gravity flips and more exciting abilities!"
              delay={0.2}
            />
            <FeatureCard
              title="Random Events"
              description="Chaotic events like earthquakes, blackouts, and speed rounds keep players on their toes."
              delay={0.3}
            />
          </Grid>
          
          {/* About Section */}
          <Box 
            mt={16} 
            p={8} 
            bg={cardBgColor} 
            borderRadius="lg" 
            borderWidth="1px" 
            borderColor={borderColor}
            shadow="md"
            width="100%"
          >
            <Heading as="h2" size="lg" mb={4}>About this Project</Heading>
            <Text mb={4}>
              Connect 4 on Steroids is not just a game — it's a demonstration of distributed systems principles in action. 
              The game showcases concepts like:
            </Text>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
              <TechFeature text="Event-driven architecture" />
              <TechFeature text="Sharded state management" />
              <TechFeature text="Eventual consistency" />
              <TechFeature text="Distributed coordination" />
              <TechFeature text="WebSocket real-time communication" />
              <TechFeature text="Microservice architecture" />
            </Grid>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, delay }) => {
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  return (
    <MotionBox
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay }}
      p={6}
      bg={cardBgColor}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      shadow="md"
      height="100%"
    >
      <Heading as="h3" size="md" mb={3}>{title}</Heading>
      <Text>{description}</Text>
    </MotionBox>
  );
};

interface TechFeatureProps {
  text: string;
}

const TechFeature: React.FC<TechFeatureProps> = ({ text }) => {
  return (
    <GridItem>
      <Flex align="center">
        <Box
          w={3}
          h={3}
          borderRadius="full"
          bg="brand.500"
          mr={3}
        />
        <Text>{text}</Text>
      </Flex>
    </GridItem>
  );
};

export default HomePage;
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, useToast } from '@chakra-ui/react';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  const toast = useToast();

  // Global error handler for uncaught errors
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      event.preventDefault();
      console.error('Uncaught error:', event.error);
      
      toast({
        title: 'Unexpected Error',
        description: 'An unexpected error occurred. Please try refreshing the page.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      // You could log to a service here
      // logErrorToService(event.error);
    };

    // Add the global error handler
    window.addEventListener('error', handleGlobalError);
    
    // Also handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      console.error('Unhandled promise rejection:', event.reason);
      
      toast({
        title: 'Network Error',
        description: 'A network or server error occurred. Please check your connection.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      // You could log to a service here
      // logErrorToService(event.reason);
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [toast]);

  return (
    <ErrorBoundary>
      <Box minH="100vh" bg="gray.50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </ErrorBoundary>
  );
};

export default App; 
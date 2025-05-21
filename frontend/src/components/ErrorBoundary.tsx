import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  Button, 
  Alert, 
  AlertIcon, 
  AlertTitle, 
  AlertDescription,
  Stack,
  Code,
  useColorModeValue
} from '@chakra-ui/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // You could also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // You can render a custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <Box p={5} maxW="800px" mx="auto" mt={10}>
          <Alert 
            status="error" 
            variant="solid" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            textAlign="center" 
            borderRadius="md"
            mb={5}
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              Something went wrong
            </AlertTitle>
            <AlertDescription maxW="lg">
              Connect 4 on Steroids has encountered an error and cannot continue.
            </AlertDescription>
          </Alert>
          
          <Stack spacing={5}>
            <Box>
              <Heading size="md" mb={2}>Error Details</Heading>
              <Text fontWeight="bold">
                {this.state.error?.name}: {this.state.error?.message}
              </Text>
            </Box>
            
            {this.state.errorInfo && (
              <Box>
                <Heading size="md" mb={2}>Component Stack</Heading>
                <Code
                  display="block"
                  whiteSpace="pre"
                  p={3}
                  overflowX="auto"
                  bg="gray.50"
                  color="red.600"
                  borderRadius="md"
                  fontSize="sm"
                  _dark={{ bg: 'gray.800', color: 'red.300' }}
                >
                  {this.state.errorInfo.componentStack}
                </Code>
              </Box>
            )}
            
            <Stack direction="row" spacing={4} justifyContent="center" mt={4}>
              <Button colorScheme="blue" onClick={this.handleReload}>
                Reload Page
              </Button>
              <Button variant="outline" onClick={this.handleReset}>
                Try Again
              </Button>
            </Stack>
            
            <Text fontSize="sm" textAlign="center" color="gray.500">
              If this error persists, please contact support or try again later.
            </Text>
          </Stack>
        </Box>
      );
    }

    // If there's no error, render the children normally
    return this.props.children;
  }
}

export default ErrorBoundary; 
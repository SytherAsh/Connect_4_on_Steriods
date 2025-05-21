import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme, createStandaloneToast } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Configure error logging for the application
const configureErrorLogging = () => {
  // Store the original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Override console.error
  console.error = (...args) => {
    // Call the original method
    originalConsoleError.apply(console, args);
    
    // Here you could log to a service
    // logErrorToService({
    //   level: 'error',
    //   message: args.map(arg => String(arg)).join(' ')
    // });
  };
  
  // Override console.warn
  console.warn = (...args) => {
    // Call the original method
    originalConsoleWarn.apply(console, args);
    
    // Here you could log to a service
    // logWarningToService({
    //   level: 'warning',
    //   message: args.map(arg => String(arg)).join(' ')
    // });
  };
};

// Setup global error handlers
configureErrorLogging();

// Create standalone toast for use outside of React components
const { ToastContainer, toast } = createStandaloneToast();

// Handle fatal errors that occur during rendering
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.stack) {
    // Display a user-friendly error message
    toast({
      title: 'Application Error',
      description: 'An unexpected error occurred. Please refresh the page.',
      status: 'error',
      duration: 10000,
      isClosable: true,
    });

    // Log detailed error info to console
    console.error('Fatal application error:', {
      message: event.error.message,
      stack: event.error.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }
});

// Extend the theme to include custom colors, fonts, etc
const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0e4ff',
      100: '#cbb2ff',
      200: '#a480ff',
      300: '#7a4dff',
      400: '#541bfe',
      500: '#3a01e5',
      600: '#2d00b3',
      700: '#200082',
      800: '#130052',
      900: '#070025',
    },
  },
  fonts: {
    heading: "'Poppins', sans-serif",
    body: "'Roboto', sans-serif",
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'bold',
        borderRadius: 'md',
      },
      variants: {
        primary: {
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600',
          },
        },
      },
    },
  },
});

// Function to safely initialize the app
const initializeApp = () => {
  try {
    const rootElement = document.getElementById('root');
    
    if (!rootElement) {
      throw new Error('Root element not found');
    }
    
    const root = ReactDOM.createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <ChakraProvider theme={theme}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <ToastContainer />
        </ChakraProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Show an error message directly in the DOM if React fails to mount
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="color: #e53e3e; margin: 20px; font-family: sans-serif; text-align: center;">
          <h1>Application Error</h1>
          <p>We're sorry, but the application couldn't be loaded.</p>
          <p>Please try refreshing the page or contact support if the problem persists.</p>
          <button onclick="window.location.reload()" style="background: #3182ce; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">
            Refresh Page
          </button>
        </div>
      `;
    }
  }
};

// Start the application
initializeApp(); 
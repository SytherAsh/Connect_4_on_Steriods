type MessageHandler = (message: any) => void;
type ErrorHandler = (error: Error) => void;

// Custom error types for better error handling
export class WebSocketConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketConnectionError';
  }
}

export class WebSocketMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketMessageError';
  }
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private reconnectInterval: number = 5000; // 5 seconds
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private playerId: string | null = null;
  private autoReconnect: boolean = true;
  private isReconnecting: boolean = false;
  private connectionUrl: string = '';

  /**
   * Connect to WebSocket server
   */
  connect(playerId: string) {
    this.playerId = playerId;
    
    // Use environment variable for WebSocket URL with fallback to current hostname
    const wsHost = process.env.REACT_APP_WS_URL || `ws://${window.location.hostname}:8000`;
    this.connectionUrl = `${wsHost}/ws/${playerId}`;
    
    try {
      this.socket = new WebSocket(this.connectionUrl);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      const connectionError = new WebSocketConnectionError(`Failed to create WebSocket connection: ${error}`);
      this.notifyErrorHandlers(connectionError);
      this.attemptReconnect();
    }
  }

  private handleOpen() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    // Notify any handlers waiting for connections
    this.notifyHandlers('connection_established', { connected: true });
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      const messageType = message.type;
      
      // Dispatch message to all handlers for this type
      if (this.messageHandlers.has(messageType)) {
        const handlers = this.messageHandlers.get(messageType);
        if (handlers) {
          handlers.forEach(handler => handler(message));
        }
      }
      
      // Also dispatch to '*' handlers which receive all messages
      if (this.messageHandlers.has('*')) {
        const handlers = this.messageHandlers.get('*');
        if (handlers) {
          handlers.forEach(handler => handler(message));
        }
      }
    } catch (error) {
      const messageError = new WebSocketMessageError(`Error parsing WebSocket message: ${error}`);
      console.error(messageError);
      this.notifyErrorHandlers(messageError);
    }
  }

  private handleClose(event: CloseEvent) {
    // Generate an appropriate error message
    let errorMessage = 'WebSocket connection closed';
    
    // Add more specific information based on the close code
    switch (event.code) {
      case 1000:
        errorMessage = 'Normal closure, connection ended normally';
        break;
      case 1001:
        errorMessage = 'Server going down or browser navigated away';
        break;
      case 1002:
        errorMessage = 'Protocol error';
        break;
      case 1003:
        errorMessage = 'Invalid data received';
        break;
      case 1006:
        errorMessage = 'Connection closed abnormally';
        break;
      case 1007:
        errorMessage = 'Invalid frame payload data';
        break;
      case 1008:
        errorMessage = 'Policy violation';
        break;
      case 1009:
        errorMessage = 'Message too big';
        break;
      case 1010:
        errorMessage = 'Missing extension';
        break;
      case 1011:
        errorMessage = 'Internal server error';
        break;
      case 1012:
        errorMessage = 'Service restart';
        break;
      case 1013:
        errorMessage = 'Try again later';
        break;
      case 1015:
        errorMessage = 'TLS handshake failure';
        break;
    }
    
    const closeError = new WebSocketConnectionError(`${errorMessage} (code: ${event.code}, reason: ${event.reason || 'none'})`);
    console.log('WebSocket connection closed:', closeError.message);
    
    // Notify error handlers of closure (unless it was a normal closure)
    if (event.code !== 1000) {
      this.notifyErrorHandlers(closeError);
    }
    
    // Notify message handlers the connection is closed
    this.notifyHandlers('connection_closed', { 
      code: event.code,
      reason: event.reason,
      message: errorMessage
    });
    
    // Attempt to reconnect
    this.attemptReconnect();
  }

  private handleError(event: Event) {
    const error = new WebSocketConnectionError('WebSocket error occurred');
    console.error('WebSocket error:', error);
    this.notifyErrorHandlers(error);
  }
  
  private attemptReconnect() {
    // Prevent multiple simultaneous reconnect attempts
    if (this.isReconnecting) return;
    
    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.isReconnecting = true;
      console.log(`Attempting to reconnect in ${this.reconnectInterval / 1000}s... (Attempt ${this.reconnectAttempts + 1} of ${this.maxReconnectAttempts})`);
      
      // Notify that we're attempting to reconnect
      this.notifyHandlers('reconnecting', { 
        attempt: this.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts,
        timeout: this.reconnectInterval
      });
      
      setTimeout(() => {
        this.reconnectAttempts++;
        if (this.playerId) {
          this.connect(this.playerId);
        }
      }, this.reconnectInterval);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Notify that max reconnect attempts have been reached
      const maxAttemptsError = new WebSocketConnectionError('Maximum reconnection attempts reached');
      this.notifyErrorHandlers(maxAttemptsError);
      this.notifyHandlers('reconnect_failed', { 
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
    }
  }

  private notifyHandlers(messageType: string, data: any) {
    const message = { type: messageType, ...data };
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
    }
    
    // Also notify '*' handlers
    if (this.messageHandlers.has('*')) {
      const handlers = this.messageHandlers.get('*');
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
    }
  }

  private notifyErrorHandlers(error: Error) {
    this.errorHandlers.forEach(handler => handler(error));
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.autoReconnect = false;
    this.isReconnecting = false;
    if (this.socket) {
      this.socket.close(1000, 'Client initiated disconnect');
      this.socket = null;
    }
  }

  /**
   * Send a message to the server
   */
  send(message: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        const sendError = new WebSocketMessageError(`Failed to send message: ${error}`);
        console.error(sendError);
        this.notifyErrorHandlers(sendError);
        return false;
      }
    } else {
      const notConnectedError = new WebSocketConnectionError('Cannot send message - WebSocket is not connected');
      console.error(notConnectedError);
      this.notifyErrorHandlers(notConnectedError);
      
      // Try to reconnect if we're not already doing so
      if (!this.isReconnecting && this.autoReconnect) {
        this.attemptReconnect();
      }
      
      return false;
    }
  }

  /**
   * Register a handler for a specific message type
   */
  on(messageType: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.add(handler);
    }
    
    // Return a function to unsubscribe this handler
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler) {
    this.errorHandlers.add(handler);
    
    // Return a function to unsubscribe this handler
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Unregister all handlers for a specific message type
   */
  off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get the reconnection status
   */
  isAttemptingReconnection(): boolean {
    return this.isReconnecting;
  }
  
  /**
   * Reset the connection (force disconnect and reconnect)
   */
  resetConnection() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    if (this.playerId) {
      this.connect(this.playerId);
    }
  }
}

// Singleton instance
const webSocketService = new WebSocketService();
export default webSocketService; 
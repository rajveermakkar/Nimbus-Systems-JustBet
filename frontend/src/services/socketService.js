import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventListeners = new Map();
    this.connectionInProgress = false;
    this.connectionPromise = null;
  }

  // Connect to Socket.IO server
  connect(token) {
    // If already connected, return the socket
    if (this.socket && this.isConnected) {
      return Promise.resolve(this.socket);
    }

    // If connection is in progress, wait for it
    if (this.connectionInProgress && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionInProgress = true;

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(BACKEND_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        this.isConnected = true;
        this.connectionInProgress = false;
        resolve(this.socket);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
        this.isConnected = false;
        this.connectionInProgress = false;
        this.connectionPromise = null;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.isConnected = false;
        this.connectionInProgress = false;
        this.connectionPromise = null;
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          this.connectionInProgress = false;
          this.connectionPromise = null;
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });

    return this.connectionPromise;
  }

  // Wait for connection to be established
  async waitForConnection() {
    if (this.isConnected) {
      return this.socket;
    }
    
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    throw new Error('No connection in progress');
  }

  // Disconnect from Socket.IO server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionInProgress = false;
      this.connectionPromise = null;
    }
  }

  // Join a live auction room
  async joinLiveAuction(auctionId, callback) {
    try {
      const socket = await this.waitForConnection();
      
      socket.emit('join_auction', { auctionId });
      
      // Listen for join errors
      socket.on('join_error', (error) => {
        if (callback) {
          callback({
            type: 'join-error',
            error: error
          });
        }
      });
      
      // Listen for auction state updates
      socket.on('auction_state', (data) => {
        if (callback) {
          callback({
            type: 'auction_state',
            ...data
          });
        }
      });

      // Listen for bid updates
      socket.on('bid_update', (data) => {
        if (callback) {
          callback({
            type: 'bid-update',
            ...data
          });
        }
      });

      // Listen for user joined events (for participant count)
      socket.on('user_joined', (data) => {
        if (callback) {
          callback({
            type: 'participant-update',
            participantCount: data.participantCount || 1
          });
        }
      });

      // Listen for auction end
      socket.on('auction_end', (data) => {
        if (callback) {
          callback({
            type: 'auction-end',
            result: data
          });
        }
      });
    } catch (error) {
      console.error('Failed to join auction:', error);
      if (callback) {
        callback({
          type: 'join-error',
          error: 'Failed to connect to auction'
        });
      }
    }
  }

  // Leave a live auction room
  async leaveLiveAuction(auctionId) {
    try {
      const socket = await this.waitForConnection();
      
      // Emit leave event to server
      socket.emit('leave_auction', { auctionId });

      // Remove listeners for this auction
      socket.off('auction_state');
      socket.off('bid_update');
      socket.off('user_joined');
      socket.off('auction_end');
    } catch (error) {
      console.error('Failed to leave auction:', error);
    }
  }

  // Place a bid in live auction
  async placeLiveBid(auctionId, amount, callback) {
    try {
      const socket = await this.waitForConnection();
      
      socket.emit('place_bid', { auctionId, amount });
      
      let hasResponded = false;
      
      // Listen for bid response
      socket.on('bid_error', (error) => {
        if (!hasResponded && callback) {
          hasResponded = true;
          callback({ success: false, message: error });
        }
      });

      // Use timeout to assume success if no error received
      setTimeout(() => {
        if (!hasResponded && callback) {
          hasResponded = true;
          callback({ success: true, message: 'Bid placed successfully' });
        }
      }, 2000); // 2 second timeout
    } catch (error) {
      console.error('Failed to place bid:', error);
      if (callback) {
        callback({ success: false, message: 'Failed to connect to auction' });
      }
    }
  }

  // Get current connection status
  getConnectionStatus() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  // Check if socket is actually connected
  isSocketConnected() {
    return this.socket && this.socket.connected;
  }

  // Add custom event listener
  async on(event, callback) {
    try {
      const socket = await this.waitForConnection();
      socket.on(event, callback);
      
      // Store listener for cleanup
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event).push(callback);
    } catch (error) {
      console.error('Failed to add event listener:', error);
    }
  }

  // Remove custom event listener
  async off(event, callback) {
    try {
      const socket = await this.waitForConnection();
      socket.off(event, callback);
      
      // Remove from stored listeners
      if (this.eventListeners.has(event)) {
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } catch (error) {
      console.error('Failed to remove event listener:', error);
    }
  }

  // Clean up all listeners
  cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
    this.eventListeners.clear();
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService; 
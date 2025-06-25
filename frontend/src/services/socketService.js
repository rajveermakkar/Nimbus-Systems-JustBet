import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventListeners = new Map();
  }

  // Connect to Socket.IO server
  connect(token) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.socket = io(BACKEND_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.isConnected = false;
    });

    return this.socket;
  }

  // Disconnect from Socket.IO server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join a live auction room
  joinLiveAuction(auctionId, callback) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit('join_auction', { auctionId });
    
    // Listen for join errors
    this.socket.on('join_error', (error) => {
      if (callback) {
        callback({
          type: 'join-error',
          error: error
        });
      }
    });
    
    // Listen for auction state updates
    this.socket.on('auction_state', (data) => {
      if (callback) {
        callback({
          type: 'auction-update',
          auction: data
        });
      }
    });

    // Listen for bid updates
    this.socket.on('bid_update', (data) => {
      if (callback) {
        callback({
          type: 'bid-update',
          bid: {
            id: Date.now(),
            user_id: data.currentBidder,
            amount: data.currentBid,
            created_at: new Date().toISOString()
          },
          auction: {
            current_highest_bid: data.currentBid,
            current_highest_bidder_id: data.currentBidder
          }
        });
      }
    });

    // Listen for user joined events (for participant count)
    this.socket.on('user_joined', (data) => {
      if (callback) {
        callback({
          type: 'participant-update',
          participantCount: data.participantCount || 1
        });
      }
    });

    // Listen for auction end
    this.socket.on('auction_end', (data) => {
      if (callback) {
        callback({
          type: 'auction-end',
          result: data
        });
      }
    });
  }

  // Leave a live auction room
  leaveLiveAuction(auctionId) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    // Remove listeners for this auction
    this.socket.off('auction_state');
    this.socket.off('bid_update');
    this.socket.off('user_joined');
    this.socket.off('auction_end');
  }

  // Place a bid in live auction
  placeLiveBid(auctionId, amount, callback) {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit('place_bid', { auctionId, amount });
    
    let hasResponded = false;
    
    // Listen for bid response
    this.socket.on('bid_error', (error) => {
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
  }

  // Get current connection status
  getConnectionStatus() {
    return this.isConnected;
  }

  // Add custom event listener
  on(event, callback) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    this.socket.on(event, callback);
    
    // Store listener for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  // Remove custom event listener
  off(event, callback) {
    if (!this.socket) {
      return;
    }

    this.socket.off(event, callback);
    
    // Remove from stored listeners
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
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
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Create axios instance with credentials
const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true
});

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
  // Always get the latest token from localStorage at request time
  const latestToken = localStorage.getItem('justbetToken');
  if (latestToken) {
    config.headers.Authorization = `Bearer ${latestToken}`;
  } else {
    // Remove the header if no token is present
    delete config.headers.Authorization;
  }
  return config;
});

const auctionService = {
  // Get all approved settled auctions (public)
  async getSettledAuctions() {
    try {
      const response = await api.get('/auctions/settled');
      return response.data.auctions;
    } catch (error) {
      console.error('Error fetching settled auctions:', error);
      throw error;
    }
  },

  // Get all approved live auctions (public)
  async getLiveAuctions() {
    try {
      const response = await api.get('/auctions/live');
      return response.data.auctions;
    } catch (error) {
      console.error('Error fetching live auctions:', error);
      throw error;
    }
  },

  // Get specific settled auction with bids
  async getSettledAuction(id) {
    try {
      const response = await api.get(`/auctions/settled/${id}`);
      return response.data.auction;
    } catch (error) {
      console.error('Error fetching settled auction:', error);
      throw error;
    }
  },

  // Get specific live auction
  async getLiveAuction(id) {
    try {
      const response = await api.get(`/auctions/live/${id}`);
      return response.data.auction;
    } catch (error) {
      console.error('Error fetching live auction:', error);
      throw error;
    }
  },

  // Place bid on settled auction
  async placeSettledBid(auctionId, amount) {
    try {
      const response = await api.post(`/auctions/settled/${auctionId}/bid`, { amount });
      return response.data;
    } catch (error) {
      console.error('Error placing bid:', error);
      throw error;
    }
  },

  // Get bids for settled auction
  async getSettledBids(auctionId) {
    try {
      const response = await api.get(`/auctions/settled/${auctionId}/bids`);
      return response.data.bids;
    } catch (error) {
      console.error('Error fetching bids:', error);
      throw error;
    }
  },

  // Get bids for live auction
  async getLiveAuctionBids(auctionId) {
    try {
      const response = await api.get(`/auctions/live/${auctionId}/bids`);
      return response.data.bids;
    } catch (error) {
      console.error('Error fetching live auction bids:', error);
      throw error;
    }
  },

  // Get result for settled auction
  async getSettledAuctionResult(auctionId) {
    try {
      const response = await api.get(`/auctions/settled/${auctionId}/result`);
      return response.data.result;
    } catch (error) {
      console.error('Error fetching settled auction result:', error);
      throw error;
    }
  },

  // Get result for live auction
  async getLiveAuctionResult(auctionId) {
    try {
      const response = await api.get(`/auctions/live/${auctionId}/result`);
      return response.data.result;
    } catch (error) {
      console.error('Error fetching live auction result:', error);
      throw error;
    }
  },

  // Get all closed auctions (public)
  async getClosedAuctions() {
    try {
      const response = await api.get('/auctions/closed');
      return response.data.auctions;
    } catch (error) {
      console.error('Error fetching closed auctions:', error);
      throw error;
    }
  },

  // Polling function for settled auctions
  startPolling(callback, interval = 15000) {
    const poll = async () => {
      try {
        const auctions = await this.getSettledAuctions();
        callback(auctions);
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    poll();
    const intervalId = setInterval(poll, interval);
    return () => clearInterval(intervalId);
  },

  // Polling function for specific auction
  startAuctionPolling(auctionId, callback, interval = 10000) {
    const poll = async () => {
      try {
        const response = await api.get(`/auctions/settled/${auctionId}`);
        callback(response.data); // Return the full response structure {auction: {...}, bids: [...], totalBids: number}
      } catch (error) {
        console.error('Auction polling error:', error);
      }
    };
    const intervalId = setInterval(poll, interval);
    return () => clearInterval(intervalId);
  },

  // Get countdown for any auction (settled or live)
  async getAuctionCountdown(type, id) {
    try {
      const response = await api.get(`/auctions/countdown/${type}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching auction countdown:', error);
      throw error;
    }
  }
};

export default auctionService; 
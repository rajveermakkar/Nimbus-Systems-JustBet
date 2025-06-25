import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Create axios instance with credentials
const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true
});

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('justbetToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const auctionService = {
  // Get all approved settled auctions
  async getSettledAuctions() {
    try {
      const response = await api.get('/auctions/approved');
      return response.data;
    } catch (error) {
      console.error('Error fetching settled auctions:', error);
      throw error;
    }
  },

  // Get all approved live auctions
  async getLiveAuctions() {
    try {
      const response = await api.get('/live-auction?status=approved');
      return response.data;
    } catch (error) {
      console.error('Error fetching live auctions:', error);
      throw error;
    }
  },

  // Get specific settled auction with bids
  async getSettledAuction(id) {
    try {
      const response = await api.get(`/auctions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching settled auction:', error);
      throw error;
    }
  },

  // Get specific live auction
  async getLiveAuction(id) {
    try {
      const response = await api.get(`/live-auction/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching live auction:', error);
      throw error;
    }
  },

  // Place bid on settled auction
  async placeSettledBid(auctionId, amount) {
    try {
      const response = await api.post(`/auctions/${auctionId}/bid`, { amount });
      return response.data;
    } catch (error) {
      console.error('Error placing bid:', error);
      throw error;
    }
  },

  // Get bids for settled auction
  async getSettledBids(auctionId) {
    try {
      const response = await api.get(`/auctions/${auctionId}/bids`);
      return response.data;
    } catch (error) {
      console.error('Error fetching bids:', error);
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

    // Initial call
    poll();
    
    // Set up interval
    const intervalId = setInterval(poll, interval);
    
    // Return function to stop polling
    return () => clearInterval(intervalId);
  },

  // Polling function for specific auction
  startAuctionPolling(auctionId, callback, interval = 10000) {
    const poll = async () => {
      try {
        const auction = await this.getSettledAuction(auctionId);
        callback(auction);
      } catch (error) {
        console.error('Auction polling error:', error);
      }
    };

    // Initial call
    poll();
    
    // Set up interval
    const intervalId = setInterval(poll, interval);
    
    // Return function to stop polling
    return () => clearInterval(intervalId);
  }
};

export default auctionService; 
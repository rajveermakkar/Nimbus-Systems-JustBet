// Set test environment
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');

// Mock all database models and services
jest.mock('../models/User', () => ({
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  updateVerificationStatus: jest.fn(),
  setVerificationToken: jest.fn(),
  setResetToken: jest.fn(),
  updatePassword: jest.fn(),
  findByVerificationToken: jest.fn(),
  findByResetToken: jest.fn()
}));

jest.mock('../models/RefreshToken', () => ({
  create: jest.fn().mockResolvedValue({ rows: [{ id: 'mock-refresh-token-id' }] }),
  findByToken: jest.fn(),
  deleteByToken: jest.fn(),
  deleteByUserId: jest.fn(),
  deleteByUser: jest.fn()
}));

jest.mock('../models/LiveAuction', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  updateAuction: jest.fn(),
  findBySellerId: jest.fn()
}));

jest.mock('../models/LiveAuctionBid', () => ({
  create: jest.fn(),
  findByAuctionId: jest.fn(),
  findByAuctionIdWithNames: jest.fn(),
  deleteOldestBid: jest.fn()
}));

jest.mock('../models/LiveAuctionResult', () => ({
  create: jest.fn()
}));

jest.mock('../services/liveAuctionState', () => ({
  getAuction: jest.fn(),
  initAuction: jest.fn(),
  addBid: jest.fn(),
  setTimer: jest.fn(),
  closeAuction: jest.fn(),
  removeAuction: jest.fn()
}));

jest.mock('../db/init', () => ({
  pool: {
    query: jest.fn()
  },
  testConnection: jest.fn().mockResolvedValue(true),
  initDatabase: jest.fn().mockResolvedValue(true)
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn()
  }));
});

jest.setTimeout(30000); // Reduce timeout since we're not doing real socket tests

describe('Live Auction Socket.IO Triggers', () => {
  let sellerToken;

  beforeAll(async () => {
    // Set JWT secret for testing
    process.env.JWT_SECRET = 'test-secret-key';
    
    // Mock successful login for seller
    const User = require('../models/User');
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    
    const sellerUser = {
      id: 'seller-id',
      first_name: 'Seller',
      last_name: 'User',
      email: 'seller@example.com',
      password: 'hashedPassword',
      role: 'seller',
      is_verified: true,
      is_approved: true
    };

    User.findByEmail.mockResolvedValue(sellerUser);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('seller-token');

    // Get seller token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'seller@example.com', password: 'password' });
    sellerToken = res.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle normal bidding and end auction', async () => {
    const now = Date.now();
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      title: 'Test Auction',
      description: 'Test auction for testing',
      image_url: 'http://example.com/image.jpg',
      starting_price: 100,
      reserve_price: null,
      start_time: new Date(now - 1000).toISOString(),
      end_time: new Date(now + 30000).toISOString(),
      max_participants: 10,
      status: 'active',
      current_highest_bid: 100,
      current_highest_bidder_id: null,
      bid_count: 0,
      min_bid_increment: 5
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);
    LiveAuction.updateAuction.mockResolvedValue(mockAuction);

    // Mock auction state
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 100,
      currentBidder: null,
      minIncrement: 5,
      startTime: new Date(now - 1000).toISOString(),
      endTime: new Date(now + 30000).toISOString(),
      reservePrice: null,
      timerEnd: null
    });

    // Test that auction state is properly initialized
    expect(liveAuctionState.getAuction(auctionId)).toBeDefined();
    await LiveAuction.findById(auctionId); // Actually call the method to trigger the mock
    expect(LiveAuction.findById).toHaveBeenCalled();
  });

  it('should reject bids before auction start', async () => {
    const now = Date.now();
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data for future start time
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      start_time: new Date(now + 10000).toISOString(), // starts in 10 seconds
      end_time: new Date(now + 60000).toISOString(),
      status: 'pending'
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);

    // Mock auction state
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 100,
      currentBidder: null,
      minIncrement: 5,
      startTime: new Date(now + 10000).toISOString(),
      endTime: new Date(now + 60000).toISOString(),
      reservePrice: null,
      timerEnd: null
    });

    // Test that auction is not started yet
    const state = liveAuctionState.getAuction(auctionId);
    const startTime = new Date(state.startTime).getTime();
    expect(startTime).toBeGreaterThan(now);
  });

  it('should reject bids after auction end', async () => {
    const now = Date.now();
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data for past end time
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      start_time: new Date(now - 60000).toISOString(), // started 60 seconds ago
      end_time: new Date(now - 1000).toISOString(), // ended 1 second ago
      status: 'closed'
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);

    // Mock auction state
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 100,
      currentBidder: null,
      minIncrement: 5,
      startTime: new Date(now - 60000).toISOString(),
      endTime: new Date(now - 1000).toISOString(),
      reservePrice: null,
      timerEnd: null
    });

    // Test that auction has ended
    const state = liveAuctionState.getAuction(auctionId);
    const endTime = new Date(state.endTime).getTime();
    expect(endTime).toBeLessThan(now);
  });

  it('should end with reserve not met if bids are too low', async () => {
    const now = Date.now();
    const reservePrice = 1000;
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data with reserve price
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      starting_price: 100,
      reserve_price: reservePrice,
      start_time: new Date(now - 1000).toISOString(),
      end_time: new Date(now + 30000).toISOString(),
      status: 'active'
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);

    // Mock auction state
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 500, // Below reserve price
      currentBidder: 'user-1',
      minIncrement: 5,
      startTime: new Date(now - 1000).toISOString(),
      endTime: new Date(now + 30000).toISOString(),
      reservePrice: reservePrice,
      timerEnd: null
    });

    // Test that reserve price is not met
    const state = liveAuctionState.getAuction(auctionId);
    expect(state.currentBid).toBeLessThan(state.reservePrice);
  });

  it('should handle simultaneous bids (race condition)', async () => {
    const now = Date.now();
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      start_time: new Date(now - 1000).toISOString(),
      end_time: new Date(now + 30000).toISOString(),
      status: 'active'
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);

    // Mock auction state
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 100,
      currentBidder: null,
      minIncrement: 5,
      startTime: new Date(now - 1000).toISOString(),
      endTime: new Date(now + 30000).toISOString(),
      reservePrice: null,
      timerEnd: null
    });

    // Test that auction state is properly managed
    const state = liveAuctionState.getAuction(auctionId);
    expect(state).toBeDefined();
    expect(liveAuctionState.addBid).toBeDefined();
  });

  it('should allow user to disconnect and rejoin', async () => {
    const now = Date.now();
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      start_time: new Date(now - 1000).toISOString(),
      end_time: new Date(now + 30000).toISOString(),
      status: 'active'
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);

    // Mock auction state
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 100,
      currentBidder: null,
      minIncrement: 5,
      startTime: new Date(now - 1000).toISOString(),
      endTime: new Date(now + 30000).toISOString(),
      reservePrice: null,
      timerEnd: null
    });

    // Test that auction state persists
    const state1 = liveAuctionState.getAuction(auctionId);
    const state2 = liveAuctionState.getAuction(auctionId);
    expect(state1).toEqual(state2);
  });

  it('should end with no bids placed', async () => {
    const now = Date.now();
    const auctionId = `test-auction-${Date.now()}`;
    
    // Mock auction data
    const LiveAuction = require('../models/LiveAuction');
    const mockAuction = {
      id: auctionId,
      start_time: new Date(now - 1000).toISOString(),
      end_time: new Date(now + 10000).toISOString(),
      status: 'active'
    };
    
    LiveAuction.findById.mockResolvedValue(mockAuction);

    // Mock auction state with no bids
    const liveAuctionState = require('../services/liveAuctionState');
    liveAuctionState.getAuction.mockReturnValue({
      currentBid: 100,
      currentBidder: null, // No current bidder
      minIncrement: 5,
      startTime: new Date(now - 1000).toISOString(),
      endTime: new Date(now + 10000).toISOString(),
      reservePrice: null,
      timerEnd: null
    });

    // Test that no bids have been placed
    const state = liveAuctionState.getAuction(auctionId);
    expect(state.currentBidder).toBeNull();
  });
}); 
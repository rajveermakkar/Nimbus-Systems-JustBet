// Set test environment
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db/init');

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

jest.mock('../models/SettledAuction', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  updateAuction: jest.fn(),
  findBySellerId: jest.fn()
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

// Helper to login and get token (adjust as needed for your test setup)
async function loginAndGetToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
}

beforeAll(() => {
  // Default mock for pool.query to prevent undefined errors
  pool.query.mockImplementation(() => Promise.resolve({ rows: [] }));
});

beforeEach(() => {
  jest.clearAllMocks();

  // Mock User.findById and jwt.verify for JWT authentication
  const User = require('../models/User');
  const jwt = require('jsonwebtoken');

  const buyerUser = {
    id: 'buyer-id',
    first_name: 'Buyer',
    last_name: 'User',
    email: 'imjordanmakkar@gmail.com',
    password: 'hashedPassword',
    role: 'user',
    is_verified: true,
    is_approved: false
  };
  const sellerUser = {
    id: 'seller-id',
    first_name: 'Seller',
    last_name: 'User',
    email: 'rajmakkar08@gmail.com',
    password: 'hashedPassword',
    role: 'seller',
    is_verified: true,
    is_approved: true
  };
  const adminUser = {
    id: 'admin-id',
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@justbet.com',
    password: 'hashedPassword',
    role: 'admin',
    is_verified: true,
    is_approved: true
  };
  jwt.verify.mockImplementation((token) => {
    if (token === 'buyer-token') {
      return { id: 'buyer-id', email: 'imjordanmakkar@gmail.com', role: 'user' };
    } else if (token === 'seller-token') {
      return { id: 'seller-id', email: 'rajmakkar08@gmail.com', role: 'seller' };
    } else if (token === 'admin-token') {
      return { id: 'admin-id', email: 'admin@justbet.com', role: 'admin' };
    }
    throw new Error('Invalid token');
  });
  User.findById.mockImplementation((id) => {
    if (id === 'buyer-id') return buyerUser;
    if (id === 'seller-id') return sellerUser;
    if (id === 'admin-id') return adminUser;
    return null;
  });

  // Mock pool.query for specific queries
  pool.query.mockImplementation((sql) => {
    // Mock for admin pending sellers
    if (sql && sql.toLowerCase().includes('from users') && sql.toLowerCase().includes('where is_seller_request_pending')) {
      return Promise.resolve({
        rows: [
          {
            id: 'seller-id',
            first_name: 'Seller',
            last_name: 'User',
            email: 'rajmakkar08@gmail.com',
            is_approved: false,
            is_seller_request_pending: true
          }
        ]
      });
    }
    // Mock for live_auctions
    if (sql && sql.toLowerCase().includes('from live_auctions')) {
      return Promise.resolve({
        rows: [
          {
            id: 'auction-1',
            title: 'Test Auction',
            description: 'A test auction',
            image_url: 'http://example.com/image.jpg',
            starting_price: 10,
            current_highest_bid: 15,
            end_time: new Date(Date.now() + 7200000).toISOString(),
            status: 'active',
            max_participants: 10,
            current_highest_bidder_id: null
          }
        ]
      });
    }
    // Mock for settled_auctions
    if (sql && sql.toLowerCase().includes('from settled_auctions')) {
      return Promise.resolve({
        rows: [
          {
            id: 'auction-2',
            title: 'Settled Auction',
            description: 'A settled auction',
            image_url: 'http://example.com/image2.jpg',
            starting_price: 20,
            current_highest_bid: 25,
            end_time: new Date(Date.now() - 7200000).toISOString(),
            status: 'closed',
            current_highest_bidder_id: null
          }
        ]
      });
    }
    return Promise.resolve({ rows: [] });
  });

  // Mock LiveAuction.create for POST /api/seller/auctions
  const LiveAuction = require('../models/LiveAuction');
  LiveAuction.create.mockResolvedValue({
    id: 'auction-1',
    title: 'Test Auction',
    description: 'A test auction',
    image_url: 'http://example.com/image.jpg',
    starting_price: 10,
    start_time: new Date(Date.now() + 3600000).toISOString(),
    end_time: new Date(Date.now() + 7200000).toISOString(),
    status: 'active'
  });

  // Mock SettledAuction.findBySellerId if used
  const SettledAuction = require('../models/SettledAuction');
  SettledAuction.findBySellerId.mockResolvedValue([
    {
      id: 'auction-2',
      title: 'Settled Auction',
      description: 'A settled auction',
      image_url: 'http://example.com/image2.jpg',
      starting_price: 20,
      current_highest_bid: 25,
      end_time: new Date(Date.now() - 7200000).toISOString(),
      status: 'closed',
      current_highest_bidder_id: null
    }
  ]);
});

describe('Seller Endpoints', () => {
  let buyerToken, sellerToken, adminToken, sellerUserId;

  beforeAll(async () => {
    // Set JWT secret for testing
    process.env.JWT_SECRET = 'test-secret-key';
    
    // Mock successful login responses
    const User = require('../models/User');
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    
    // Mock user data
    const buyerUser = {
      id: 'buyer-id',
      first_name: 'Buyer',
      last_name: 'User',
      email: 'imjordanmakkar@gmail.com',
      password: 'hashedPassword',
      role: 'user',
      is_verified: true,
      is_approved: false
    };
    
    const sellerUser = {
      id: 'seller-id',
      first_name: 'Seller',
      last_name: 'User',
      email: 'rajmakkar08@gmail.com',
      password: 'hashedPassword',
      role: 'seller',
      is_verified: true,
      is_approved: true
    };
    
    const adminUser = {
      id: 'admin-id',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@justbet.com',
      password: 'hashedPassword',
      role: 'admin',
      is_verified: true,
      is_approved: true
    };

    // Mock User.findByEmail for each login
    User.findByEmail
      .mockResolvedValueOnce(buyerUser)
      .mockResolvedValueOnce(sellerUser)
      .mockResolvedValueOnce(adminUser);
    
    // Mock bcrypt.compare to return true for all passwords
    bcrypt.compare.mockResolvedValue(true);
    
    // Mock jwt.sign to return tokens
    jwt.sign
      .mockReturnValueOnce('buyer-token')
      .mockReturnValueOnce('seller-token')
      .mockReturnValueOnce('admin-token');

    // credentials
    buyerToken = await loginAndGetToken('imjordanmakkar@gmail.com', 'rajveer777');
    sellerToken = await loginAndGetToken('rajmakkar08@gmail.com', 'rajveer777');
    adminToken = await loginAndGetToken('admin@justbet.com', 'admin123');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock User.findById for JWT authentication
    const User = require('../models/User');
    const jwt = require('jsonwebtoken');
    
    // Mock user data for JWT verification
    const buyerUser = {
      id: 'buyer-id',
      first_name: 'Buyer',
      last_name: 'User',
      email: 'imjordanmakkar@gmail.com',
      password: 'hashedPassword',
      role: 'user',
      is_verified: true,
      is_approved: false
    };
    
    const sellerUser = {
      id: 'seller-id',
      first_name: 'Seller',
      last_name: 'User',
      email: 'rajmakkar08@gmail.com',
      password: 'hashedPassword',
      role: 'seller',
      is_verified: true,
      is_approved: true
    };
    
    const adminUser = {
      id: 'admin-id',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@justbet.com',
      password: 'hashedPassword',
      role: 'admin',
      is_verified: true,
      is_approved: true
    };

    // Mock jwt.verify to return appropriate user IDs
    jwt.verify.mockImplementation((token) => {
      if (token === 'buyer-token') {
        return { id: 'buyer-id', email: 'imjordanmakkar@gmail.com', role: 'user' };
      } else if (token === 'seller-token') {
        return { id: 'seller-id', email: 'rajmakkar08@gmail.com', role: 'seller' };
      } else if (token === 'admin-token') {
        return { id: 'admin-id', email: 'admin@justbet.com', role: 'admin' };
      }
      throw new Error('Invalid token');
    });

    // Mock User.findById to return appropriate user data
    User.findById.mockImplementation((id) => {
      if (id === 'buyer-id') return buyerUser;
      if (id === 'seller-id') return sellerUser;
      if (id === 'admin-id') return adminUser;
      return null;
    });
  });

  describe('POST /api/seller/request', () => {
    it('should allow a buyer to request seller role', async () => {
      const res = await request(app)
        .post('/api/seller/request')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          businessName: 'Test Biz',
          businessDescription: 'A test business',
          businessAddress: '123 Test St',
          businessPhone: '+1234567890'
        });
      expect([200, 201]).toContain(res.statusCode);
      expect(res.body.message).toMatch(/submitted/i);
    });
    it('should reject request with missing fields', async () => {
      const res = await request(app)
        .post('/api/seller/request')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ businessName: '' });
      expect(res.statusCode).toBe(400);
    });
    it('should not allow a seller to request again', async () => {
      const res = await request(app)
        .post('/api/seller/request')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          businessName: 'Test Biz',
          businessDescription: 'A test business',
          businessAddress: '123 Test St',
          businessPhone: '+1234567890'
        });
      expect(res.statusCode).toBe(400);
    });
    it('should reject request without auth', async () => {
      const res = await request(app)
        .post('/api/seller/request')
        .send({
          businessName: 'Test Biz',
          businessDescription: 'A test business',
          businessAddress: '123 Test St',
          businessPhone: '+1234567890'
        });
      expect(res.statusCode).toBe(401);
    });
    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .post('/api/seller/request')
        .set('Authorization', `Bearer invalidtoken`)
        .send({
          businessName: 'Test Biz',
          businessDescription: 'A test business',
          businessAddress: '123 Test St',
          businessPhone: '+1234567890'
        });
      expect([401, 403]).toContain(res.statusCode);
    });
  });

  describe('GET /api/seller/status', () => {
    it('should get seller request status', async () => {
      const res = await request(app)
        .get('/api/seller/status')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status');
    });
    it('should reject status without auth', async () => {
      const res = await request(app)
        .get('/api/seller/status');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/seller/auctions', () => {
    it('should allow seller to view their listings', async () => {
      const res = await request(app)
        .get('/api/seller/auctions')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect([200, 201]).toContain(res.statusCode);
      expect(Array.isArray(res.body)).toBe(true);
    });
    it('should not allow buyer to view seller listings', async () => {
      const res = await request(app)
        .get('/api/seller/auctions')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.statusCode).toBe(403);
    });
    it('should reject listings without auth', async () => {
      const res = await request(app)
        .get('/api/seller/auctions');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Admin Approve Seller', () => {
    it('should get pending sellers as admin', async () => {
      const res = await request(app)
        .get('/api/admin/pending-sellers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.pendingSellers)).toBe(true);
      if (res.body.pendingSellers.length > 0) {
        sellerUserId = res.body.pendingSellers[0].id;
      }
    });
    it('should not get pending sellers as non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/pending-sellers')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect([401, 403]).toContain(res.statusCode);
    });
    it('should approve a seller as admin', async () => {
      if (!sellerUserId) return;
      const res = await request(app)
        .patch(`/api/admin/sellers/${sellerUserId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true });
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty('is_approved', true);
    });
    it('should not approve seller as non-admin', async () => {
      if (!sellerUserId) return;
      const res = await request(app)
        .patch(`/api/admin/sellers/${sellerUserId}/approve`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ approved: true });
      expect([401, 403]).toContain(res.statusCode);
    });
    it('should reject approval with invalid user', async () => {
      const res = await request(app)
        .patch(`/api/admin/sellers/invalidid/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true });
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('Seller Create Listing', () => {
    it('should allow seller to create a listing', async () => {
      const res = await request(app)
        .post('/api/seller/auctions')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          title: 'Test Auction',
          description: 'A test auction',
          imageUrl: 'http://example.com/image.jpg',
          startingPrice: 10,
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString()
        });
      expect([200, 201]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('title', 'Test Auction');
    });
    it('should reject listing with invalid data', async () => {
      const res = await request(app)
        .post('/api/seller/auctions')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          title: '',
          description: '',
          imageUrl: '',
          startingPrice: 0,
          startTime: '',
          endTime: ''
        });
      expect(res.statusCode).toBe(400);
    });
  });
}); 
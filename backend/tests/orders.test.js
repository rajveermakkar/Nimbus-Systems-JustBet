// ALL MOCKS MUST BE AT THE TOP BEFORE ANY REQUIRE/IMPORT

// Mock Stripe to prevent real initialization errors
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: { create: jest.fn(), retrieve: jest.fn(), confirm: jest.fn() },
    customers: { create: jest.fn(), retrieve: jest.fn() },
    setupIntents: { create: jest.fn() },
    paymentMethods: { list: jest.fn(), detach: jest.fn() },
    accounts: { create: jest.fn(), retrieve: jest.fn(), update: jest.fn(), listPersons: jest.fn(), createPerson: jest.fn(), updatePerson: jest.fn() },
    accountLinks: { create: jest.fn() },
    payouts: { create: jest.fn() },
    transfers: { create: jest.fn() },
    refunds: { create: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
    testHelpers: { accounts: { verify: jest.fn() } }
  }));
});

// Mock database pool and queryWithRetry to prevent real DB connections
jest.mock('../db/init', () => {
  const mPool = {
    query: jest.fn((sql, params) => {
      // Mock order insertion
      if (sql && sql.includes('INSERT INTO orders')) {
        return Promise.resolve({ rows: [{ id: 'mock-order-id' }] });
      }
      // Mock order deletion
      if (sql && sql.includes('DELETE FROM orders')) {
        return Promise.resolve({ rows: [] });
      }
      // Default mock
      return Promise.resolve({ rows: [] });
    })
  };
  // Mock queryWithRetry to behave like pool.query
  const queryWithRetry = mPool.query;
  return { pool: mPool, queryWithRetry };
});

// Mock JWT to always verify successfully, with id matching winner_id
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(() => ({ id: 'test-winner-id', email: 'test@example.com', role: 'user' }))
}));

// Mock OrderDocument model
jest.mock('../models/orderDocument', () => ({
  __esModule: true,
  default: {},
  create: jest.fn(),
  findByOrderAndType: jest.fn((orderId, type) => {
    if (orderId === 'mock-order-id') {
      return Promise.resolve({
        id: 'doc-id',
        orderId: 'mock-order-id',
        type,
        url: `https://mocked-azure.blob.core.windows.net/order-documents/${type}_mock-order-id.pdf`
      });
    }
    return Promise.resolve(null);
  }),
  findAllByOrder: jest.fn(),
  updateUrl: jest.fn()
}));

// Mock getOrderPdfData
jest.mock('../services/pdfDataService', () => ({
  getOrderPdfData: jest.fn((orderId) => {
    if (orderId === 'mock-order-id') {
      return Promise.resolve({
        order: { id: 'mock-order-id', created_at: new Date(), shipping_address: '123 Test St', winner_id: 'test-winner-id', seller_id: 'test-seller-id', auction_id: 'test-auction-id' },
        auction: { id: 'test-auction-id', title: 'Test Auction', current_highest_bid: 100, seller_id: 'test-seller-id', seller: { company_name: 'Test Seller', email: 'seller@example.com' } },
        auctionType: 'settled',
        winner: { id: 'test-winner-id', first_name: 'Test', last_name: 'User', email: 'test@example.com' },
        seller: { id: 'test-seller-id', company_name: 'Test Seller', email: 'seller@example.com' },
        walletTxn: { id: 'txn-id' },
        walletTxnId: 'txn-id'
      });
    }
    return Promise.reject(new Error('Order not found'));
  })
}));

// Mock User model
jest.mock('../models/User', () => ({
  findById: jest.fn((id) => Promise.resolve({ id, first_name: 'Test', last_name: 'User', email: 'test@example.com' })),
  findByEmail: jest.fn((email) => Promise.resolve({ id: 'test-winner-id', email, first_name: 'Test', last_name: 'User' })),
  setVerificationToken: jest.fn(),
  setResetToken: jest.fn(),
  setStripeCustomerId: jest.fn()
}));

// Mock Wallet model
jest.mock('../models/Wallet', () => ({
  getWalletByUserId: jest.fn(() => Promise.resolve({ id: 'wallet-id', user_id: 'test-winner-id', balance: 1000 })),
  updateBalance: jest.fn(),
  createWallet: jest.fn()
}));

// Set test environment
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db/init');

// Use a static token for all requests (since JWT is mocked)
const STATIC_TOKEN = 'mocked-jwt-token';

describe('Order PDF Download Endpoints', () => {
  let testOrderId = 'mock-order-id';

  beforeAll(async () => {
    // Simulate order creation (mock returns mock-order-id)
    await pool.query(
      `INSERT INTO orders (auction_id, winner_id, seller_id, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        'test-auction-id',
        'test-winner-id',
        'test-seller-id',
        '123 Test St',
        'Testville',
        'TS',
        '12345',
        'Testland',
        'delivered'
      ]
    );
  });

  afterAll(async () => {
    // Simulate order deletion
    await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
  });

  it('should return a valid invoice PDF URL for a valid order', async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}/invoice`)
      .set('Authorization', `Bearer ${STATIC_TOKEN}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url.endsWith('.pdf')).toBe(true);
  });

  it('should return a valid certificate PDF URL for a valid order', async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}/certificate`)
      .set('Authorization', `Bearer ${STATIC_TOKEN}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url.endsWith('.pdf')).toBe(true);
  });

  it('should return 404 or 500 for an invalid order ID (invoice)', async () => {
    const res = await request(app)
      .get('/api/orders/invalid-order-id/invoice')
      .set('Authorization', `Bearer ${STATIC_TOKEN}`);
    expect([404, 500]).toContain(res.statusCode);
  });

  it('should return 404 or 500 for an invalid order ID (certificate)', async () => {
    const res = await request(app)
      .get('/api/orders/invalid-order-id/certificate')
      .set('Authorization', `Bearer ${STATIC_TOKEN}`);
    expect([404, 500]).toContain(res.statusCode);
  });
}); 
// Set test environment
process.env.NODE_ENV = 'test';

// ---- CREDENTIALS CONFIG ----
const ADMIN_EMAIL = 'admin@justbet.com';
const ADMIN_PASSWORD = 'admin123';
const SELLER_EMAIL = 'rajmakkar08@gmail.com';
const SELLER_PASSWORD = 'rajveer777';
const BUYER_EMAIL = 'btcminerv1@gmail.com';
const BUYER_PASSWORD = 'rajveer777';
// You must set this to the actual UUID of your seller in the users table:
const SELLER_ID = '9a65314f-c85b-4565-afff-483f12875875';
// ----------------------------

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db/init');
const bcrypt = require('bcrypt');

let testAuctionId = null;

// Helper to login and get token
async function loginAndGetToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
}

beforeAll(async () => {
  // Insert a pending auction for the seller and get its UUID
  const result = await pool.query(
    `INSERT INTO settled_auctions (seller_id, title, description, image_url, starting_price, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      SELLER_ID,
      'Pending Auction',
      'A pending auction for testing',
      'http://example.com/image.jpg',
      10,
      new Date(Date.now() + 3600000).toISOString(),
      new Date(Date.now() + 7200000).toISOString(),
      'pending'
    ]
  );
  testAuctionId = result.rows[0].id;
});

// No afterAll cleanup, user will revert changes manually

describe('Admin Endpoints', () => {
  let adminToken, sellerToken, buyerToken;

  beforeAll(async () => {
    adminToken = await loginAndGetToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    sellerToken = await loginAndGetToken(SELLER_EMAIL, SELLER_PASSWORD);
    buyerToken = await loginAndGetToken(BUYER_EMAIL, BUYER_PASSWORD);
  });

  describe('Seller Approval', () => {
    it('should get pending sellers as admin', async () => {
      const res = await request(app)
        .get('/api/admin/pending-sellers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.pendingSellers)).toBe(true);
    });
    it('should approve a seller as admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/sellers/${SELLER_ID}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true });
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty('is_approved', true);
    });
    it('should not approve seller as non-admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/sellers/${SELLER_ID}/approve`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ approved: true });
      expect([401, 403]).toContain(res.statusCode);
    });
    it('should reject approval with invalid user', async () => {
      const res = await request(app)
        .patch('/api/admin/sellers/invalidid/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true });
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('Auction Approval', () => {
    it('should get pending auctions as admin', async () => {
      const res = await request(app)
        .get('/api/admin/auctions/settled/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.auctions)).toBe(true);
    });
    it('should approve a pending auction as admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/auctions/settled/${testAuctionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();
      expect(res.statusCode).toBe(200);
      expect(res.body.auction).toHaveProperty('status', 'approved');
    });
    it('should not approve auction as non-admin', async () => {
      const res = await request(app)
        .patch(`/api/admin/auctions/settled/${testAuctionId}/approve`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send();
      expect([401, 403]).toContain(res.statusCode);
    });
    it('should reject approval with invalid auction id', async () => {
      const res = await request(app)
        .patch('/api/admin/auctions/settled/invalidid/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send();
      expect([400, 404, 500]).toContain(res.statusCode);
    });
  });
}); 
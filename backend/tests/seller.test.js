const request = require('supertest');
const app = require('../server');

// Helper to login and get token (adjust as needed for your test setup)
async function loginAndGetToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.token;
}

describe('Seller Endpoints', () => {
  let buyerToken, sellerToken, adminToken, sellerUserId;

  beforeAll(async () => {
    // credentials
    buyerToken = await loginAndGetToken('btcminerv1@gmail.com', 'rajveer777');
    sellerToken = await loginAndGetToken('rajmakkar08@gmail.com', 'rajveer777');
    adminToken = await loginAndGetToken('admin@justbet.com', 'admin123');
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
        .get('/api/seller/auctions/settled')
        .set('Authorization', `Bearer ${sellerToken}`);
      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(Array.isArray(res.body.auctions)).toBe(true);
      }
    });
    it('should not allow buyer to view seller listings', async () => {
      const res = await request(app)
        .get('/api/seller/auctions/settled')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(res.statusCode).toBe(403);
    });
    it('should reject listings without auth', async () => {
      const res = await request(app)
        .get('/api/seller/auctions/settled');
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
        .post('/api/seller/auctions/settled')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          title: 'Test Auction',
          description: 'A test auction',
          imageUrl: 'http://example.com/image.jpg',
          startingPrice: 10,
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString()
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.auction).toHaveProperty('title', 'Test Auction');
    });
    it('should reject listing with invalid data', async () => {
      const res = await request(app)
        .post('/api/seller/auctions/settled')
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
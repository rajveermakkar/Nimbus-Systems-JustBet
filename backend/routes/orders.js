const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const jwtauthMiddleware = require('../middleware/jwtauth');
const { getOrderPdfData } = require('../services/pdfDataService');
const { generateAndStoreOrderDocument } = require('../services/pdfService');
const OrderDocument = require('../models/orderDocument');

// Apply JWT auth to all order routes
router.use(jwtauthMiddleware);

// Middleware: require authentication (assume req.user.id is set)
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/orders - Winner submits shipping details
router.post('/', requireAuth, async (req, res) => {
  const { auction_id, auction_type, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country } = req.body;
  if (!auction_id || !auction_type || !shipping_address || !shipping_city || !shipping_state || !shipping_postal_code || !shipping_country) {
    return res.status(400).json({ error: 'All shipping fields are required' });
  }
  try {
    // Find auction and winner based on auction type
    let auctionResult;
    if (auction_type === 'live') {
      auctionResult = await pool.query('SELECT seller_id FROM live_auctions WHERE id = $1', [auction_id]);
    } else {
      auctionResult = await pool.query('SELECT seller_id FROM settled_auctions WHERE id = $1', [auction_id]);
    }
    
    if (auctionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    const seller_id = auctionResult.rows[0].seller_id;
    // Upsert order
    const orderResult = await pool.query(`
      INSERT INTO orders (auction_id, winner_id, seller_id, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (auction_id) DO UPDATE SET
        winner_id = EXCLUDED.winner_id,
        seller_id = EXCLUDED.seller_id,
        shipping_address = EXCLUDED.shipping_address,
        shipping_city = EXCLUDED.shipping_city,
        shipping_state = EXCLUDED.shipping_state,
        shipping_postal_code = EXCLUDED.shipping_postal_code,
        shipping_country = EXCLUDED.shipping_country,
        status = 'under_process',
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [auction_id, req.user.id, seller_id, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country]);
    res.json(orderResult.rows[0]);
  } catch (err) {
    console.error('Error creating/updating order:', err);
    res.status(500).json({ error: 'Failed to create/update order' });
  }
});

// GET /api/orders/winner - Winner fetches their orders
router.get('/winner', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE winner_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching winner orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/seller - Seller fetches their sold orders
router.get('/seller', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.*,
        COALESCE(sa.title, la.title) as title,
        COALESCE(sa.description, la.description) as description,
        COALESCE(sa.image_url, la.image_url) as image_url,
        COALESCE(sa.starting_price, la.starting_price) as starting_price,
        COALESCE(sa.current_highest_bid, la.current_highest_bid) as final_bid,
        u.first_name as winner_first_name,
        u.last_name as winner_last_name,
        u.email as winner_email
      FROM orders o
      LEFT JOIN settled_auctions sa ON o.auction_id = sa.id
      LEFT JOIN live_auctions la ON o.auction_id = la.id
      JOIN users u ON o.winner_id = u.id
      WHERE o.seller_id = $1 
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching seller orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:orderId/invoice - Download invoice PDF
router.get('/:orderId/invoice', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    let doc = await OrderDocument.findByOrderAndType(orderId, 'invoice');
    if (!doc) {
      // Generate on demand if missing
      const data = await getOrderPdfData(orderId);
      doc = await generateAndStoreOrderDocument(data, 'invoice');
    }
    return res.json({ url: doc.url });
  } catch (err) {
    console.error('Error fetching invoice PDF:', err);
    res.status(500).json({ error: 'Failed to fetch invoice PDF' });
  }
});

// GET /api/orders/:orderId/certificate - Download certificate PDF
router.get('/:orderId/certificate', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    let doc = await OrderDocument.findByOrderAndType(orderId, 'certificate');
    if (!doc) {
      // Generate on demand if missing
      const data = await getOrderPdfData(orderId);
      doc = await generateAndStoreOrderDocument(data, 'certificate');
    }
    return res.json({ url: doc.url });
  } catch (err) {
    console.error('Error fetching certificate PDF:', err);
    res.status(500).json({ error: 'Failed to fetch certificate PDF' });
  }
});

// PATCH /api/orders/:orderId/status - Seller updates shipping status
router.patch('/:orderId/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['under_process', 'shipped', 'delivered'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    // Only seller can update
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (orderResult.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const updateResult = await pool.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, req.params.orderId]);
    res.json(updateResult.rows[0]);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router; 
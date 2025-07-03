const { pool } = require('../db/init');

const SettledAuction = {
  // Create a new auction listing in the database
  async create({ sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, minBidIncrement }) {
    const query = `
      INSERT INTO settled_auctions (seller_id, title, description, image_url, start_time, end_time, starting_price, reserve_price, min_bid_increment, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await pool.query(query, [sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, minBidIncrement !== undefined ? minBidIncrement : 5, 'settled']);
    return result.rows[0];
  },

  // Find auction by id
  async findById(id) {
    const result = await pool.query('SELECT * FROM settled_auctions WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Find auction by id with seller details
  async findByIdWithSeller(id) {
    // Get auction first
    const auction = await this.findById(id);
    if (!auction) return null;
    
    // Get seller details separately
    const sellerQuery = 'SELECT first_name, last_name, email, business_name FROM users WHERE id = $1';
    const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
    const seller = sellerResult.rows[0];
    
    // Combine auction and seller data with nested seller object
    return {
      ...auction,
      seller: seller ? {
        id: auction.seller_id,
        first_name: seller.first_name,
        last_name: seller.last_name,
        email: seller.email,
        business_name: seller.business_name
      } : null
    };
  },

  // Find auction by status
  async findByStatus(status) {
    const result = await pool.query('SELECT * FROM settled_auctions WHERE status = $1', [status]);
    return result.rows;
  },

  // Approve an auction (admin only)
  async approveAuction(id) {
    const query = `
      UPDATE settled_auctions
      SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  async findPending() {
    const result = await pool.query("SELECT * FROM settled_auctions WHERE status = 'pending'");
    return result.rows;
  },

  // Update auction fields by ID
  async updateAuction(id, fields) {
    const allowed = ['title', 'description', 'image_url', 'start_time', 'end_time', 'starting_price', 'reserve_price', 'current_highest_bid', 'current_highest_bidder_id', 'bid_count', 'min_bid_increment', 'status'];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }
    if (updates.length === 0) return null;
    values.push(id);
    const query = `
      UPDATE settled_auctions
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Get all auctions for a specific seller
  async findBySeller(sellerId) {
    const result = await pool.query('SELECT * FROM settled_auctions WHERE seller_id = $1', [sellerId]);
    return result.rows;
  },

  // Delete auction by ID
  async deleteById(id) {
    const result = await pool.query('DELETE FROM settled_auctions WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Count total settled auctions
  async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM settled_auctions');
    return parseInt(result.rows[0].count, 10);
  },

  // Reject a settled auction (admin only)
  async rejectAuction(id, rejectionReason, rejectedBy) {
    const query = `
      UPDATE settled_auctions
      SET status = 'rejected', 
          rejection_reason = $1,
          rejected_at = CURRENT_TIMESTAMP,
          rejected_by = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [rejectionReason, rejectedBy, id]);
    return result.rows[0];
  },

  // Count settled auctions by status
  async countByStatus(status) {
    const result = await pool.query('SELECT COUNT(*) FROM settled_auctions WHERE status = $1', [status]);
    return parseInt(result.rows[0].count, 10);
  }
};

module.exports = SettledAuction; 
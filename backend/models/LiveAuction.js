const { pool } = require('../db/init');

const LiveAuction = {
  // Create a new live auction
  async create({ sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, maxParticipants }) {
    const query = `
      INSERT INTO live_auctions (seller_id, title, description, image_url, start_time, end_time, starting_price, reserve_price, max_participants, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await pool.query(query, [sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, maxParticipants, 'live']);
    return result.rows[0];
  },

  // Find live auction by id
  async findById(id) {
    const result = await pool.query('SELECT * FROM live_auctions WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Find live auctions by status
  async findByStatus(status) {
    const result = await pool.query('SELECT * FROM live_auctions WHERE status = $1', [status]);
    return result.rows;
  },

  // Update live auction fields by ID
  async updateAuction(id, fields) {
    const allowed = ['title', 'description', 'image_url', 'start_time', 'end_time', 'starting_price', 'reserve_price', 'max_participants', 'status', 'current_highest_bid', 'current_highest_bidder_id', 'bid_count', 'min_bid_increment'];
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
      UPDATE live_auctions
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Get all live auctions for a specific seller
  async findBySeller(sellerId) {
    const result = await pool.query('SELECT * FROM live_auctions WHERE seller_id = $1', [sellerId]);
    return result.rows;
  },

  // Delete live auction by ID
  async deleteById(id) {
    const result = await pool.query('DELETE FROM live_auctions WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  // Count total live auctions
  async countAll() {
    const result = await pool.query('SELECT COUNT(*) FROM live_auctions');
    return parseInt(result.rows[0].count, 10);
  },

  // Reject a live auction (admin only)
  async rejectAuction(id, rejectionReason, rejectedBy) {
    const query = `
      UPDATE live_auctions
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

  // Count live auctions by status
  async countByStatus(status) {
    const result = await pool.query('SELECT COUNT(*) FROM live_auctions WHERE status = $1', [status]);
    return parseInt(result.rows[0].count, 10);
  }
};

module.exports = LiveAuction; 
const { pool } = require('../db/init');

const SettledAuction = {
  // Create a new auction listing in the database
  async create({ sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice }) {
    const query = `
      INSERT INTO settled_auctions (seller_id, title, description, image_url, start_time, end_time, starting_price, reserve_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await pool.query(query, [sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice]);
    return result.rows[0];
  },

  // Find auction by id
  async findById(id) {
    const result = await pool.query('SELECT * FROM settled_auctions WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Find auction by status
  async findByStatus(status) {
    const result = await pool.query('SELECT * FROM settled_auctions WHERE status = $1', [status]);
    return result.rows;
  },

  async approveAuction(id) {
    const query = `
      UPDATE settled_auctions
      SET is_approved = true, status = 'approved', updated_at = CURRENT_TIMESTAMP
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
  async updateAuction(id, fields, wasApproved = false) {
    const allowed = ['title', 'description', 'image_url', 'start_time', 'end_time', 'starting_price', 'reserve_price'];
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
    // If auction was previously approved, set is_approved=false and status='pending'
    if (wasApproved && updates.length > 0) {
      updates.push(`is_approved = false`);
      updates.push(`status = 'pending'`);
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

  // Get live auctions (approved and currently active)
  async findLiveAuctions() {
    const result = await pool.query(`
      SELECT * FROM settled_auctions 
      WHERE status = 'approved' 
      AND start_time <= CURRENT_TIMESTAMP 
      AND end_time > CURRENT_TIMESTAMP
      ORDER BY end_time ASC
    `);
    return result.rows;
  },

  // Get ended auctions
  async findEndedAuctions() {
    const result = await pool.query(`
      SELECT * FROM settled_auctions 
      WHERE end_time <= CURRENT_TIMESTAMP
      ORDER BY end_time DESC
    `);
    return result.rows;
  },

  // Get upcoming auctions (approved but not started yet)
  async findUpcomingAuctions() {
    const result = await pool.query(`
      SELECT * FROM settled_auctions 
      WHERE status = 'approved' 
      AND start_time > CURRENT_TIMESTAMP
      ORDER BY start_time ASC
    `);
    return result.rows;
  }
};

module.exports = SettledAuction; 
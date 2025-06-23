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
  }
};

module.exports = SettledAuction; 
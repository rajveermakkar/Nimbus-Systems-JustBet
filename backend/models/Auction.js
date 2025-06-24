const { pool } = require('../db/init');

const Auction = {
  // Find auction by ID
  async findById(id) {
    const result = await pool.query('SELECT * FROM auctions WHERE id = $1', [id]);
    return result.rows[0];
  },
};

module.exports = Auction; 
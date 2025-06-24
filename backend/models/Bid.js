const { pool } = require('../db/init');

const Bid = {
  // Create a new bid for an auction
  async create({ auctionId, userId, amount }) {
    const query = `
      INSERT INTO bids (auction_id, user_id, amount)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [auctionId, userId, amount]);
    return result.rows[0];
  },

  // Get all bids for a specific auction
  async findByAuctionId(auctionId) {
    const result = await pool.query('SELECT * FROM bids WHERE auction_id = $1 ORDER BY created_at DESC', [auctionId]);
    return result.rows;
  }
};

module.exports = Bid; 
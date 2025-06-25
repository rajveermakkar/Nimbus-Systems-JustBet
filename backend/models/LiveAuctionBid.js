const { pool } = require('../db/init');

const LiveAuctionBid = {
  // Add a new bid
  async create({ auctionId, userId, amount }) {
    const query = `
      INSERT INTO live_auction_bids (auction_id, user_id, amount)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [auctionId, userId, amount]);
    return result.rows[0];
  },

  // Get all bids for an auction, sorted oldest first
  async findByAuctionId(auctionId) {
    const result = await pool.query(
      'SELECT * FROM live_auction_bids WHERE auction_id = $1 ORDER BY created_at ASC',
      [auctionId]
    );
    return result.rows;
  },

  // Delete the oldest bid for an auction
  async deleteOldestBid(auctionId) {
    const result = await pool.query(
      `DELETE FROM live_auction_bids WHERE id = (
        SELECT id FROM live_auction_bids WHERE auction_id = $1 ORDER BY created_at ASC LIMIT 1
      ) RETURNING *`,
      [auctionId]
    );
    return result.rows[0];
  }
};

module.exports = LiveAuctionBid; 
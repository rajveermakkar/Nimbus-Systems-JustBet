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
      'SELECT * FROM live_auction_bids WHERE auction_id = $1 ORDER BY created_at DESC LIMIT 10',
      [auctionId]
    );
    return result.rows;
  },

  // Get bids with user names - simple approach
  async findByAuctionIdWithNames(auctionId) {
    const result = await pool.query(
      'SELECT * FROM live_auction_bids WHERE auction_id = $1 ORDER BY created_at DESC LIMIT 10',
      [auctionId]
    );
    
    const bidsWithNames = [];
    
    for (const bid of result.rows) {
      // Get user name for each bid
      const userResult = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [bid.user_id]);
      const user = userResult.rows[0];
      
      bidsWithNames.push({
        id: bid.id,
        amount: bid.amount,
        created_at: bid.created_at,
        user_id: user ? user.email : bid.user_id,
        user_name: user ? `${user.first_name} ${user.last_name}` : `User ${bid.user_id}`
      });
    }
    
    return bidsWithNames;
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
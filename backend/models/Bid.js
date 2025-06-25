const { pool } = require('../db/init');

const Bid = {
  // Create a new bid for a settled auction
  async create({ auctionId, userId, amount }) {
    const query = `
      INSERT INTO settled_auction_bids (auction_id, user_id, amount)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [auctionId, userId, amount]);
    return result.rows[0];
  },

  // Get all bids for a specific settled auction
  async findByAuctionId(auctionId) {
    const result = await pool.query('SELECT * FROM settled_auction_bids WHERE auction_id = $1 ORDER BY created_at DESC', [auctionId]);
    return result.rows;
  },

  // Get all bids for a specific settled auction with bidder details
  async findByAuctionIdWithBidders(auctionId) {
    // Get bids first
    const bids = await this.findByAuctionId(auctionId);
    
    // Get bidder details for each bid
    const bidsWithBidders = [];
    for (const bid of bids) {
      const bidderQuery = 'SELECT first_name, last_name, email FROM users WHERE id = $1';
      const bidderResult = await pool.query(bidderQuery, [bid.user_id]);
      const bidder = bidderResult.rows[0];
      
      bidsWithBidders.push({
        ...bid,
        first_name: bidder?.first_name,
        last_name: bidder?.last_name,
        email: bidder?.email
      });
    }
    
    return bidsWithBidders;
  }
};

module.exports = Bid; 
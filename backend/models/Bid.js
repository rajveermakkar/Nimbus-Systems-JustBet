const { pool, queryWithRetry } = require('../db/init');

const Bid = {
  // Create a new bid for settled auctions
  async create(auctionId, userId, amount) {
    const query = `
      INSERT INTO settled_auction_bids (auction_id, user_id, amount)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await queryWithRetry(query, [auctionId, userId, amount]);
    return result.rows[0];
  },

  // Get all bids for a settled auction
  async getByAuctionId(auctionId) {
    const result = await queryWithRetry('SELECT * FROM settled_auction_bids WHERE auction_id = $1 ORDER BY created_at DESC', [auctionId]);
    return result.rows;
  },

  // Get bid with bidder information
  async getWithBidder(auctionId) {
    const bidderQuery = `
      SELECT b.*, u.first_name, u.last_name, u.email
      FROM settled_auction_bids b
      JOIN users u ON b.user_id = u.id
      WHERE b.auction_id = $1
      ORDER BY b.created_at DESC
    `;
    const result = await queryWithRetry(bidderQuery, [auctionId]);
    return result.rows;
  }
};

module.exports = Bid; 
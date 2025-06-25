const { pool } = require('../db/init');

const LiveAuctionResult = {
  // Create a new auction result
  async create({ auctionId, winnerId, finalBid, reserveMet, status }) {
    const query = `
      INSERT INTO live_auction_results (auction_id, winner_id, final_bid, reserve_met, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [auctionId, winnerId, finalBid, reserveMet, status]);
    return result.rows[0];
  },

  // Find result by auction ID
  async findByAuctionId(auctionId) {
    const result = await pool.query(
      'SELECT * FROM live_auction_results WHERE auction_id = $1',
      [auctionId]
    );
    return result.rows[0];
  },

  // Get all results
  async findAll() {
    const result = await pool.query(
      'SELECT * FROM live_auction_results ORDER BY created_at DESC'
    );
    return result.rows;
  },

  // Get results with user and auction details
  async findAllWithDetails() {
    const query = `
      SELECT 
        lar.*,
        u.first_name as winner_first_name,
        u.last_name as winner_last_name,
        u.email as winner_email,
        la.title as auction_title,
        la.starting_price,
        la.reserve_price
      FROM live_auction_results lar
      LEFT JOIN users u ON lar.winner_id = u.id
      LEFT JOIN live_auctions la ON lar.auction_id = la.id
      ORDER BY lar.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }
};

module.exports = LiveAuctionResult; 
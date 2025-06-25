const { pool } = require('../db/init');

const SettledAuction = {
  // Create a new auction listing in the database
  async create({ sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, minBidIncrement = 1 }) {
    const query = `
      INSERT INTO settled_auctions (seller_id, title, description, image_url, start_time, end_time, starting_price, reserve_price, min_bid_increment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await pool.query(query, [sellerId, title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, minBidIncrement]);
    return result.rows[0];
  },

  // Find auction by id
  async findById(id) {
    const result = await pool.query('SELECT * FROM settled_auctions WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Find auction by id with seller details
  async findByIdWithSeller(id) {
    // Get auction first
    const auction = await this.findById(id);
    if (!auction) return null;
    
    // Get seller details separately
    const sellerQuery = 'SELECT first_name, last_name, email, business_name FROM users WHERE id = $1';
    const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
    const seller = sellerResult.rows[0];
    
    // Combine auction and seller data
    return {
      ...auction,
      first_name: seller?.first_name,
      last_name: seller?.last_name,
      email: seller?.email,
      business_name: seller?.business_name
    };
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
    const allowed = ['title', 'description', 'image_url', 'start_time', 'end_time', 'starting_price', 'reserve_price', 'current_highest_bid', 'current_highest_bidder_id', 'bid_count', 'min_bid_increment'];
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
  }
};

module.exports = SettledAuction; 
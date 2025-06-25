const User = require('../models/User');
const { generateToken } = require('../utils/tokenUtils');

const sellerController = {
  // Request to become a seller
  async requestSellerRole(req, res) {
    try {
      const userId = req.user.id;
      const businessName = req.body.businessName;
      const businessDescription = req.body.businessDescription;
      const businessAddress = req.body.businessAddress;
      const businessPhone = req.body.businessPhone;

      // Check if all required fields are provided
      if (!businessName || !businessDescription || !businessAddress || !businessPhone) {
        return res.status(400).json({
          error: 'Missing required business information. Please provide business name, description, address, and phone number.'
        });
      }

      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is already a seller
      if (user.role === 'seller') {
        return res.status(400).json({ error: 'User is already a seller' });
      }

      // Prepare business details
      const businessDetails = {
        businessName,
        businessDescription,
        businessAddress,
        businessPhone
      };

      // Update user to seller role (pending approval)
      const updatedUser = await User.updateRoleAndApproval(userId, 'seller', false, businessDetails);
      
      // Generate new token
      const token = generateToken(updatedUser);

      res.json({
        message: 'Seller role request submitted successfully. Waiting for admin approval.',
        user: {
          ...updatedUser,
          businessDetails: {
            businessName: updatedUser.business_name,
            businessDescription: updatedUser.business_description,
            businessAddress: updatedUser.business_address,
            businessPhone: updatedUser.business_phone
          }
        },
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error submitting seller role request' });
    }
  },

  // Get seller request status
  async getSellerRequestStatus(req, res) {
    try {
      const userId = req.user.id;
      
      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate new token
      const token = generateToken(user);

      // Determine status
      let status = 'not_requested';
      if (user.role === 'seller') {
        status = user.is_approved ? 'approved' : 'pending';
      }

      // Prepare business details if user is a seller
      let businessDetails = null;
      if (user.role === 'seller' && user.business_name) {
        businessDetails = {
          businessName: user.business_name,
          businessDescription: user.business_description,
          businessAddress: user.business_address,
          businessPhone: user.business_phone
        };
      }

      const response = {
        role: user.role,
        isApproved: user.is_approved,
        status: status,
        businessDetails: businessDetails,
        token
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching seller request status' });
    }
  },

  // Get seller analytics
  async getSellerAnalytics(req, res) {
    try {
      const sellerId = req.user.id;
      const { pool } = require('../db/init');

      // Get live auction stats
      const liveQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN current_highest_bidder_id IS NOT NULL THEN 1 END) as with_bids,
          COALESCE(SUM(CASE WHEN status = 'closed' AND current_highest_bidder_id IS NOT NULL THEN current_highest_bid ELSE 0 END), 0) as revenue,
          COALESCE(AVG(CASE WHEN status = 'closed' AND current_highest_bidder_id IS NOT NULL THEN current_highest_bid ELSE NULL END), 0) as avg_price
        FROM live_auctions 
        WHERE seller_id = $1
      `;

      // Get settled auction stats
      const settledQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN current_highest_bidder_id IS NOT NULL THEN 1 END) as with_bids,
          COALESCE(SUM(CASE WHEN status = 'closed' AND current_highest_bidder_id IS NOT NULL THEN current_highest_bid ELSE 0 END), 0) as revenue,
          COALESCE(AVG(CASE WHEN status = 'closed' AND current_highest_bidder_id IS NOT NULL THEN current_highest_bid ELSE NULL END), 0) as avg_price
        FROM settled_auctions 
        WHERE seller_id = $1
      `;

      // Run both queries
      const liveResult = await pool.query(liveQuery, [sellerId]);
      const settledResult = await pool.query(settledQuery, [sellerId]);

      const live = liveResult.rows[0];
      const settled = settledResult.rows[0];

      // Calculate totals
      const totalAuctions = parseInt(live.total) + parseInt(settled.total);
      const totalRevenue = parseFloat(live.revenue) + parseFloat(settled.revenue);
      const totalCompleted = parseInt(live.completed) + parseInt(settled.completed);

      const analytics = {
        live: {
          total: parseInt(live.total),
          completed: parseInt(live.completed),
          active: parseInt(live.active),
          withBids: parseInt(live.with_bids),
          totalRevenue: parseFloat(live.revenue),
          avgSalePrice: parseFloat(live.avg_price)
        },
        settled: {
          total: parseInt(settled.total),
          completed: parseInt(settled.completed),
          active: parseInt(settled.active),
          withBids: parseInt(settled.with_bids),
          totalRevenue: parseFloat(settled.revenue),
          avgSalePrice: parseFloat(settled.avg_price)
        },
        overall: {
          totalAuctions: totalAuctions,
          totalRevenue: totalRevenue,
          totalCompleted: totalCompleted
        }
      };

      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: 'Something went wrong' });
    }
  },

  // Get auction results
  async getAuctionResults(req, res) {
    try {
      const sellerId = req.user.id;
      const { pool } = require('../db/init');

      // Get live auction results - simple query
      const liveQuery = 'SELECT id, title, description, image_url, starting_price, current_highest_bid as final_bid, end_time, status, max_participants, current_highest_bidder_id FROM live_auctions WHERE seller_id = $1 AND status = $2 ORDER BY end_time DESC';
      const liveResults = await pool.query(liveQuery, [sellerId, 'closed']);

      // Get settled auction results - simple query
      const settledQuery = 'SELECT id, title, description, image_url, starting_price, current_highest_bid as final_bid, end_time, status, current_highest_bidder_id FROM settled_auctions WHERE seller_id = $1 AND status = $2 ORDER BY end_time DESC';
      const settledResults = await pool.query(settledQuery, [sellerId, 'closed']);

      const allResults = [];

      // Process live auction results
      for (const row of liveResults.rows) {
        let winnerName = null;
        if (row.current_highest_bidder_id) {
          const userQuery = 'SELECT first_name, last_name FROM users WHERE id = $1';
          const userResult = await pool.query(userQuery, [row.current_highest_bidder_id]);
          if (userResult.rows[0]) {
            winnerName = userResult.rows[0].first_name + ' ' + userResult.rows[0].last_name;
          }
        }
        
        const resultType = row.current_highest_bidder_id ? 'sold' : 'no_bids';
        
        allResults.push({
          ...row,
          winner_name: winnerName,
          result_type: resultType,
          auction_type: 'live'
        });
      }

      // Process settled auction results
      for (const row of settledResults.rows) {
        let winnerName = null;
        if (row.current_highest_bidder_id) {
          const userQuery = 'SELECT first_name, last_name FROM users WHERE id = $1';
          const userResult = await pool.query(userQuery, [row.current_highest_bidder_id]);
          if (userResult.rows[0]) {
            winnerName = userResult.rows[0].first_name + ' ' + userResult.rows[0].last_name;
          }
        }
        
        const resultType = row.current_highest_bidder_id ? 'sold' : 'no_bids';
        
        allResults.push({
          ...row,
          winner_name: winnerName,
          result_type: resultType,
          auction_type: 'settled'
        });
      }

      // Sort by end time (newest first)
      allResults.sort((a, b) => new Date(b.end_time) - new Date(a.end_time));

      res.json({ results: allResults });
    } catch (error) {
      res.status(500).json({ error: 'Something went wrong' });
    }
  }
};

module.exports = sellerController; 
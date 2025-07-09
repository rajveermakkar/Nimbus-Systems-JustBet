const User = require('../models/User');
const { generateToken } = require('../utils/tokenUtils');
const LiveAuction = require('../models/LiveAuction');
const SettledAuction = require('../models/SettledAuction');
const { auctionCache } = require('../services/redisService');
const stripeService = require('../services/stripeService');

// Use 120s TTL for admin dashboard cache
const ADMIN_CACHE_TTL = 120;

const adminController = {
  // Get all pending seller approvals
  async getPendingSellers(req, res) {
    try {
      const pendingSellers = await User.getPendingSellers();
      const token = generateToken(req.user);
      
      res.json({
        pendingSellers,
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching pending sellers' });
    }
  },

  // Approve or reject a seller
  async handleSellerApproval(req, res) {
    try {
      const { userId } = req.params;
      const { approved } = req.body;

      if (typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'Approval status must be a boolean' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role !== 'seller') {
        return res.status(400).json({ error: 'User is not a seller' });
      }

      // Preserve business details when approving
      const businessDetails = {
        businessName: user.business_name,
        businessDescription: user.business_description,
        businessAddress: user.business_address,
        businessPhone: user.business_phone
      };
      const updatedUser = await User.updateRoleAndApproval(userId, 'seller', approved, businessDetails);
      const token = generateToken(req.user);

      await auctionCache.del('admin:stats');
      await auctionCache.del('admin:users:all');
      await auctionCache.del('admin:auctions:settled');
      await auctionCache.del('admin:auctions:live');

      res.json({
        user: updatedUser,
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error updating seller approval status' });
    }
  },

  // Reject a live auction
  async rejectLiveAuction(req, res) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      const auction = await LiveAuction.findById(id);
      if (!auction) {
        return res.status(404).json({ error: 'Live auction not found' });
      }

      if (auction.status === 'rejected') {
        return res.status(400).json({ error: 'Auction is already rejected' });
      }

      if (auction.status === 'closed') {
        return res.status(400).json({ error: 'Cannot reject a closed auction' });
      }

      const rejectedAuction = await LiveAuction.rejectAuction(id, rejectionReason, req.user.id);
      const token = generateToken(req.user);

      await auctionCache.del('admin:stats');
      await auctionCache.del('admin:users:all');
      await auctionCache.del('admin:auctions:settled');
      await auctionCache.del('admin:auctions:live');

      res.json({
        auction: rejectedAuction,
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error rejecting live auction' });
    }
  },

  // Reject a settled auction
  async rejectSettledAuction(req, res) {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      const auction = await SettledAuction.findById(id);
      if (!auction) {
        return res.status(404).json({ error: 'Settled auction not found' });
      }

      if (auction.status === 'rejected') {
        return res.status(400).json({ error: 'Auction is already rejected' });
      }

      if (auction.status === 'closed') {
        return res.status(400).json({ error: 'Cannot reject a closed auction' });
      }

      const rejectedAuction = await SettledAuction.rejectAuction(id, rejectionReason, req.user.id);
      const token = generateToken(req.user);

      await auctionCache.del('admin:stats');
      await auctionCache.del('admin:users:all');
      await auctionCache.del('admin:auctions:settled');
      await auctionCache.del('admin:auctions:live');

      res.json({
        auction: rejectedAuction,
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error rejecting settled auction' });
    }
  },

  // Get stats: detailed breakdown including rejected auctions
  async getStats(req, res) {
    const cacheKey = 'admin:stats';
    const cached = await auctionCache.get(cacheKey);
    if (cached) {
      console.log('[REDIS] Admin stats - CACHE HIT');
      return res.json(cached);
    }
    try {
      const [
        totalUsers,
        totalBuyers,
        totalSellers,
        totalLiveAuctions,
        totalSettledAuctions,
        livePending,
        liveApproved,
        liveRejected,
        liveClosed,
        settledPending,
        settledApproved,
        settledRejected,
        settledClosed,
        pendingSellerRequests
      ] = await Promise.all([
        User.countAll(),
        User.countByRole('buyer'),
        User.countByRole('seller'),
        LiveAuction.countAll(),
        SettledAuction.countAll(),
        LiveAuction.countByStatus('pending'),
        LiveAuction.countByStatus('approved'),
        LiveAuction.countByStatus('rejected'),
        LiveAuction.countByStatus('closed'),
        SettledAuction.countByStatus('pending'),
        SettledAuction.countByStatus('approved'),
        SettledAuction.countByStatus('rejected'),
        SettledAuction.countByStatus('closed'),
        User.countPendingSellerRequests()
      ]);
      const totalAuctions = totalLiveAuctions + totalSettledAuctions;
      const stats = {
        users: {
          buyers: totalBuyers,
          sellers: totalSellers,
          total: totalUsers,
          pendingSellerRequests
        },
        auctions: {
          live: {
            pending: livePending,
            approved: liveApproved,
            rejected: liveRejected,
            closed: liveClosed,
            total: totalLiveAuctions
          },
          settled: {
            pending: settledPending,
            approved: settledApproved,
            rejected: settledRejected,
            closed: settledClosed,
            total: totalSettledAuctions
          },
          total: totalAuctions
        }
      };
      await auctionCache.set(cacheKey, stats, ADMIN_CACHE_TTL);
      console.log('[DB] Admin stats - CACHE MISS');
      return res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching stats' });
    }
  },

  // Get all users (admin only)
  async getAllUsers(req, res) {
    const cacheKey = 'admin:users:all';
    const cached = await auctionCache.get(cacheKey);
    if (cached) {
      console.log('[REDIS] Admin users - CACHE HIT');
      return res.json(cached);
    }
    try {
      const users = await User.getAll();
      const response = { users };
      await auctionCache.set(cacheKey, response, ADMIN_CACHE_TTL);
      console.log('[DB] Admin users - CACHE MISS');
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching users' });
    }
  },

  // Get all settled auctions (admin only)
  async getAllSettledAuctions(req, res) {
    const cacheKey = 'admin:auctions:settled';
    const cached = await auctionCache.get(cacheKey);
    if (cached) {
      console.log('[REDIS] Admin settled auctions - CACHE HIT');
      return res.json(cached);
    }
    try {
      const { pool } = require('../db/init');
      const result = await pool.query('SELECT * FROM settled_auctions ORDER BY start_time DESC');
      const auctions = result.rows;
      // Attach seller info
      const auctionsWithSellers = [];
      for (const auction of auctions) {
        const sellerQuery = 'SELECT first_name, last_name, email, business_name FROM users WHERE id = $1';
        const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
        const seller = sellerResult.rows[0];
        auctionsWithSellers.push({
          ...auction,
          seller: seller ? {
            id: auction.seller_id,
            first_name: seller.first_name,
            last_name: seller.last_name,
            email: seller.email,
            business_name: seller.business_name
          } : null,
          type: 'settled'
        });
      }
      const response = { auctions: auctionsWithSellers };
      await auctionCache.set(cacheKey, response, ADMIN_CACHE_TTL);
      console.log('[DB] Admin settled auctions - CACHE MISS');
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching all settled auctions' });
    }
  },

  // Get all live auctions (admin only)
  async getAllLiveAuctions(req, res) {
    const cacheKey = 'admin:auctions:live';
    const cached = await auctionCache.get(cacheKey);
    if (cached) {
      console.log('[REDIS] Admin live auctions - CACHE HIT');
      return res.json(cached);
    }
    try {
      const { pool } = require('../db/init');
      const result = await pool.query('SELECT * FROM live_auctions ORDER BY start_time DESC');
      const auctions = result.rows;
      // Attach seller info
      const auctionsWithSellers = [];
      for (const auction of auctions) {
        const sellerQuery = 'SELECT first_name, last_name, email, business_name FROM users WHERE id = $1';
        const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
        const seller = sellerResult.rows[0];
        auctionsWithSellers.push({
          ...auction,
          seller: seller ? {
            id: auction.seller_id,
            first_name: seller.first_name,
            last_name: seller.last_name,
            email: seller.email,
            business_name: seller.business_name
          } : null,
          type: 'live'
        });
      }
      const response = { auctions: auctionsWithSellers };
      await auctionCache.set(cacheKey, response, ADMIN_CACHE_TTL);
      console.log('[DB] Admin live auctions - CACHE MISS');
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching all live auctions' });
    }
  },

  // Get all auctions (live and settled) for a specific seller (admin only)
  async getAuctionsBySeller(req, res) {
    try {
      const { sellerId } = req.params;
      // First check if seller exists
      const seller = await User.findById(sellerId);
      if (!seller) {
        return res.status(404).json({ error: 'Seller not found' });
      }
      // Fetch settled auctions for seller
      const settledAuctions = await SettledAuction.findBySeller(sellerId);
      // Fetch live auctions for seller
      const liveAuctions = await LiveAuction.findBySeller(sellerId);
      const { pool } = require('../db/init');
      const attachSellerAndWinner = async (auction, type) => {
        let winner = null;
        if (auction.status === 'closed' && auction.current_highest_bidder_id) {
          const winnerQuery = 'SELECT id, first_name, last_name, email FROM users WHERE id = $1';
          const winnerResult = await pool.query(winnerQuery, [auction.current_highest_bidder_id]);
          winner = winnerResult.rows[0] || null;
        }
        return {
          ...auction,
          seller: {
            id: seller.id,
            first_name: seller.first_name,
            last_name: seller.last_name,
            email: seller.email,
            business_name: seller.business_name
          },
          winner,
          type
        };
      };
      const settledWithSeller = await Promise.all(settledAuctions.map(a => attachSellerAndWinner(a, 'settled')));
      const liveWithSeller = await Promise.all(liveAuctions.map(a => attachSellerAndWinner(a, 'live')));
      res.json({
        auctions: [...settledWithSeller, ...liveWithSeller],
        seller: {
          id: seller.id,
          first_name: seller.first_name,
          last_name: seller.last_name,
          email: seller.email,
          business_name: seller.business_name
        }
      });
    } catch (error) {
      console.error('Error in getAuctionsBySeller:', error);
      res.status(500).json({ error: 'Error fetching auctions for seller' });
    }
  },

  // PATCH /admin/users/:userId/role - change user role
  async changeUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const allowedRoles = ['buyer', 'seller', 'admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // If changing to seller, keep business details if present
      const businessDetails = (role === 'seller') ? {
        businessName: user.business_name,
        businessDescription: user.business_description,
        businessAddress: user.business_address,
        businessPhone: user.business_phone
      } : null;
      // If changing to seller, set isApproved to false (require approval)
      // If changing to buyer or admin, set isApproved to true
      const isApproved = (role === 'seller') ? false : true;
      const updatedUser = await User.updateRoleAndApproval(userId, role, isApproved, businessDetails);
      res.json({
        message: `Role updated to ${role}`,
        user: updatedUser
      });

      await auctionCache.del('admin:stats');
      await auctionCache.del('admin:users:all');
      await auctionCache.del('admin:auctions:settled');
      await auctionCache.del('admin:auctions:live');
    } catch (error) {
      res.status(500).json({ error: 'Error updating user role' });
    }
  }
};

module.exports = adminController; 
const User = require('../models/User');
const { generateToken } = require('../utils/tokenUtils');
const LiveAuction = require('../models/LiveAuction');
const SettledAuction = require('../models/SettledAuction');

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
      res.json({
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
      });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching stats' });
    }
  },

  // Ban a user (progressive ban logic)
  async banUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;
      if (!reason || reason.trim() === '') {
        return res.status(400).json({ error: 'Ban reason is required' });
      }
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const ban = await User.banUser(userId, adminId, reason);
      res.json({ ban, message: ban.expires_at ? (ban.expires_at && new Date(ban.expires_at) - Date.now() > 20 * 24 * 60 * 60 * 1000 ? 'User banned for 30 days.' : 'User banned for 1 week.') : 'User permanently banned.' });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Error banning user' });
    }
  },

  // Unban a user (if not permanent)
  async unbanUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      try {
        const unbanned = await User.unbanUser(userId, adminId);
        res.json({ ban: unbanned, message: 'User unbanned.' });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    } catch (error) {
      res.status(500).json({ error: error.message || 'Error unbanning user' });
    }
  },

  // Get user ban history
  async getUserBanHistory(req, res) {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const banHistory = await User.getBanHistory(userId);
      const totalBans = banHistory.length;
      const activeBan = await User.getActiveBan(userId);
      
      res.json({ 
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role
        }, 
        banHistory,
        totalBans,
        hasActiveBan: !!activeBan,
        activeBan: activeBan || null
      });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching ban history' });
    }
  },

  // Get ban statistics
  async banStats(req, res) {
    try {
      const stats = await User.getBanStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Error fetching ban statistics' });
    }
  }
};

module.exports = adminController; 
const User = require('../models/User');
const { generateToken } = require('../utils/tokenUtils');
const LiveAuction = require('../models/LiveAuction');
const SettledAuction = require('../models/SettledAuction');

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
      res.json({
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
      });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching stats' });
    }
  },

  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      const users = await User.getAll();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching users' });
    }
  },

  // Get all settled auctions (admin only)
  async getAllSettledAuctions(req, res) {
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
      res.json({ auctions: auctionsWithSellers });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching all settled auctions' });
    }
  },

  // Get all live auctions (admin only)
  async getAllLiveAuctions(req, res) {
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
      res.json({ auctions: auctionsWithSellers });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching all live auctions' });
    }
  }
};

module.exports = adminController; 
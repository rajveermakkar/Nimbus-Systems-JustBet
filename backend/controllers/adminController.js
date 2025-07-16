const User = require('../models/User');
const { generateToken } = require('../utils/tokenUtils');
const LiveAuction = require('../models/LiveAuction');
const SettledAuction = require('../models/SettledAuction');
const { auctionCache } = require('../services/redisService');
const stripeService = require('../services/stripeService');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { queryWithRetry } = require('../db/init');

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
      
      // If approving seller, ensure they have a wallet
      if (approved) {
        const Wallet = require('../models/Wallet');
        let wallet = await Wallet.getWalletByUserId(userId);
        if (!wallet) {
          try {
            console.log(`Creating wallet for approved seller ${userId}`);
            wallet = await Wallet.createWallet(userId);
          } catch (walletErr) {
            console.error('Failed to create wallet for approved seller:', walletErr);
            return res.status(500).json({ error: 'Failed to create seller wallet during approval. Please try again.' });
          }
        }
      }
      
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
      return res.json(cached);
    }
    try {
      const users = await User.getAll();
      // Add pendingDeleteDays field if user is scheduled for deletion
      const now = new Date();
      const usersWithDeleteInfo = users.map(u => {
        let pendingDeleteDays = null;
        if (u.status === 'inactive' && u.deletionscheduledat) {
          const scheduled = new Date(u.deletionscheduledat);
          const diff = Math.ceil((scheduled - now) / (1000 * 60 * 60 * 24));
          pendingDeleteDays = diff > 0 ? diff : 0;
        }
        return {
          ...u,
          pendingDeleteDays
        };
      });
      const response = { users: usersWithDeleteInfo };
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
  },

  // Ban a user (progressive)
  async banUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      if (!reason || reason.trim() === '') {
        return res.status(400).json({ error: 'Ban reason is required' });
      }
      const updatedUser = await User.banUser(userId, reason);
      res.json({ user: updatedUser });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Error banning user' });
    }
  },

  // Unban a user
  async unbanUser(req, res) {
    try {
      const { userId } = req.params;
      const updatedUser = await User.unbanUser(userId);
      res.json({ user: updatedUser });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Error unbanning user' });
    }
  },

  // Get ban history for a user
  async getBanHistory(req, res) {
    try {
      const { userId } = req.params;
      const history = await User.getBanHistory(userId);
      res.json({ banHistory: history });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Error fetching ban history' });
    }
  },

  // AGGREGATED ACTIVITY LOGS FOR ADMIN (last 48 hours)
  async getActivityLogs(req, res) {
    try {
      const Bid = require('../models/Bid');
      const LiveAuctionBid = require('../models/LiveAuctionBid');
      const Transaction = require('../models/Transaction');
      const User = require('../models/User');
      const SettledAuction = require('../models/SettledAuction');
      const LiveAuction = require('../models/LiveAuction');
      const SettledAuctionResult = require('../models/SettledAuctionResult');
      const LiveAuctionResult = require('../models/LiveAuctionResult');

      // Calculate 48 hours ago
      const now = new Date();
      const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const within48h = (date) => date && new Date(date) >= since;

      // Helper function to get user names in batch
      const getUserNamesBatch = async (userIds) => {
        const uniqueIds = [...new Set(userIds.filter(id => id))];
        if (uniqueIds.length === 0) return {};
        
        const users = await User.getAll ? await User.getAll() : [];
        const userMap = {};
        users.forEach(user => {
          userMap[user.id] = `${user.first_name} ${user.last_name}`;
        });
        
        const result = {};
        uniqueIds.forEach(id => {
          result[id] = userMap[id] || `User ${id}`;
        });
        return result;
      };

      // Users (registrations in last 48h)
      const users = await User.getAll ? await User.getAll() : [];
      const userLogs = users.filter(u => within48h(u.created_at)).map(user => ({
        timestamp: user.created_at,
        user: `${user.first_name} ${user.last_name}`,
        action: 'USER_REGISTERED',
        description: `User registered: ${user.email}`,
        relatedId: user.id,
        type: 'user',
      }));
      // Add User_Deleted_Account logs for users deleted in last 48h
      const deletedUserLogs = users.filter(u => u.status === 'deleted' && within48h(u.deletionscheduledat)).map(user => ({
        timestamp: user.deletionscheduledat,
        user: `${user.first_name} ${user.last_name}`,
        action: 'USER_DELETED_ACCOUNT',
        description: `User deleted account: ${user.email}`,
        relatedId: user.id,
        type: 'user',
      }));

      // Settled Auctions (created in last 48h)
      const settledAuctions = await SettledAuction.findByStatus ? await SettledAuction.findByStatus('approved') : [];
      const settledAuctionLogs = settledAuctions.filter(a => within48h(a.created_at)).map(auction => ({
        timestamp: auction.created_at,
        user: auction.seller_id,
        action: 'SETTLED_AUCTION_CREATED',
        description: `Settled auction created: ${auction.title}`,
        relatedId: auction.id,
        type: 'settled_auction',
      }));

      // Live Auctions (created in last 48h)
      const liveAuctions = await LiveAuction.findByStatus ? await LiveAuction.findByStatus('approved') : [];
      const liveAuctionLogs = liveAuctions.filter(a => within48h(a.created_at)).map(auction => ({
        timestamp: auction.created_at,
        user: auction.seller_id,
        action: 'LIVE_AUCTION_CREATED',
        description: `Live auction created: ${auction.title}`,
        relatedId: auction.id,
        type: 'live_auction',
      }));

      // Settled Auction Results (in last 48h)
      const settledResults = await SettledAuctionResult.findAllWithDetails ? await SettledAuctionResult.findAllWithDetails() : [];
      const settledResultLogs = settledResults.filter(r => within48h(r.created_at)).map(result => ({
        timestamp: result.created_at,
        user: result.winner_id,
        action: 'SETTLED_AUCTION_RESULT',
        description: result.status === 'won'
          ? `Auction won by ${result.winner_first_name || ''} ${result.winner_last_name || ''} for $${result.final_bid}`
          : `Auction result: ${result.status}`,
        relatedId: result.auction_id,
        type: 'settled_auction_result',
      }));

      // Live Auction Results (in last 48h)
      const liveResults = await LiveAuctionResult.findAllWithDetails ? await LiveAuctionResult.findAllWithDetails() : [];
      const liveResultLogs = liveResults.filter(r => within48h(r.created_at)).map(result => ({
        timestamp: result.created_at,
        user: result.winner_id,
        action: 'LIVE_AUCTION_RESULT',
        description: result.status === 'won'
          ? `Live auction won by ${result.winner_first_name || ''} ${result.winner_last_name || ''} for $${result.final_bid}`
          : `Live auction result: ${result.status}`,
        relatedId: result.auction_id,
        type: 'live_auction_result',
      }));

      // Aggregate all logs
      let logs = [
        ...userLogs,
        ...deletedUserLogs,
        ...settledAuctionLogs,
        ...liveAuctionLogs,
        ...settledResultLogs,
        ...liveResultLogs,
      ];
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Get all unique user IDs for batch lookup
      const userIds = logs.map(log => log.user).filter(id => id && id !== 'System' && id !== 'No Winner');
      const userNamesMap = await getUserNamesBatch(userIds);

      // Replace user IDs with names
      logs = logs.map(log => ({
        ...log,
        user: log.user === 'System' || log.user === 'No Winner' ? log.user : (userNamesMap[log.user] || log.user)
      }));

      res.json({ logs: logs.slice(0, 100) });
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      res.status(500).json({ error: 'Error fetching activity logs' });
    }
  },

  // Get platform earnings/fees
  async getPlatformEarnings(req, res) {
    try {
      const { pool } = require('../db/init');
      
      // Get all platform fee transactions
      const earningsQuery = `
        SELECT 
          wt.*,
          u.email as user_email,
          u.first_name,
          u.last_name,
          w.currency
        FROM wallet_transactions wt
        JOIN wallets w ON wt.wallet_id = w.id
        JOIN users u ON w.user_id = u.id
        WHERE wt.type = 'platform_fee' AND wt.status = 'succeeded'
        ORDER BY wt.created_at DESC
      `;
      
      const earningsResult = await pool.query(earningsQuery);
      const earnings = earningsResult.rows;
      
      // Calculate totals
      const totalEarnings = earnings.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      // Get admin withdrawals to calculate available balance
      const withdrawalsQuery = `SELECT COALESCE(SUM(ABS(amount)), 0) as total_withdrawals FROM wallet_transactions WHERE type = 'admin_withdrawal' AND status = 'succeeded'`;
      const withdrawalsResult = await pool.query(withdrawalsQuery);
      const totalWithdrawals = parseFloat(withdrawalsResult.rows[0]?.total_withdrawals || 0);
      const availableBalance = totalEarnings - totalWithdrawals;
      
      // Group by month for chart data
      const monthlyEarnings = {};
      earnings.forEach(tx => {
        const date = new Date(tx.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyEarnings[monthKey]) {
          monthlyEarnings[monthKey] = 0;
        }
        monthlyEarnings[monthKey] += parseFloat(tx.amount);
      });
      
      // Convert to array for frontend
      const monthlyData = Object.entries(monthlyEarnings).map(([month, amount]) => ({
        month,
        amount: parseFloat(amount.toFixed(2))
      })).sort((a, b) => a.month.localeCompare(b.month));
      
      // Get recent earnings (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentEarnings = earnings.filter(tx => 
        new Date(tx.created_at) >= thirtyDaysAgo
      );
      
      const recentTotal = recentEarnings.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      res.json({
        earnings,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        availableBalance: parseFloat(availableBalance.toFixed(2)),
        recentEarnings: parseFloat(recentTotal.toFixed(2)),
        monthlyData,
        totalCount: earnings.length
      });
    } catch (error) {
      console.error('Error fetching platform earnings:', error);
      res.status(500).json({ error: 'Error fetching platform earnings' });
    }
  }
};

module.exports = adminController; 
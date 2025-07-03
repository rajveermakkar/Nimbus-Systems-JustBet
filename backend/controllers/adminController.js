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
  }
};

module.exports = adminController; 
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const roleAuth = require('../middleware/roleAuth');
const auctionController = require('../controllers/auctionController');
const liveAuctionController = require('../controllers/liveAuctionController');

// All routes require authentication and admin role
router.use(jwtauthMiddleware);
router.use(roleAuth(['admin']));

// Get all pending seller approvals
router.get('/pending-sellers', adminController.getPendingSellers);

// Approve or reject a seller
router.patch('/sellers/:userId/approve', adminController.handleSellerApproval);

// Settled Auctions (Admin Only)
router.get('/auctions/settled/pending', auctionController.listPendingAuctions);
router.patch('/auctions/settled/:id/approve', auctionController.approveAuction);

// Live Auctions (Admin Only)
router.get('/auctions/live', liveAuctionController.getAdminLiveAuctions);
router.get('/auctions/live/pending', liveAuctionController.getAdminLiveAuctions);
router.patch('/auctions/live/:id/approve', liveAuctionController.approveLiveAuction);

// Reject auctions (Admin Only)
router.patch('/auctions/live/:id/reject', adminController.rejectLiveAuction);
router.patch('/auctions/settled/:id/reject', adminController.rejectSettledAuction);

// Get stats (total users and listings)
router.get('/stats', adminController.getStats);

// Get all users (admin only)
router.get('/users', adminController.getAllUsers);

// Get all settled auctions (admin only)
router.get('/auctions/settled/all', adminController.getAllSettledAuctions);
// Get all live auctions (admin only)
router.get('/auctions/live/all', adminController.getAllLiveAuctions);

// Add new route for fetching all auctions by seller (admin only)
router.get('/auctions/by-seller/:sellerId', adminController.getAuctionsBySeller);

// Add new route for aggregated activity logs
router.get('/activity-logs', adminController.getActivityLogs);

// Get platform earnings/fees
router.get('/earnings', adminController.getPlatformEarnings);

// Test route to verify admin routes are working
router.get('/test-stripe', (req, res) => {
  res.json({ message: 'Admin Stripe routes are working' });
});

// PATCH user role
router.patch('/users/:userId/role', adminController.changeUserRole);

// Ban/unban/ban-history endpoints
router.post('/users/:userId/ban', adminController.banUser);
router.post('/users/:userId/unban', adminController.unbanUser);
router.get('/users/:userId/ban-history', adminController.getBanHistory);

// Database health monitoring endpoint
router.get('/db-health', async (req, res) => {
  try {
    const dbMonitor = require('../utils/dbMonitor');
    const metrics = await dbMonitor.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Database health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check database health',
      details: error.message
    });
  }
});

module.exports = router; 
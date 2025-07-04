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

// Ban/unban user (Admin Only)
router.post('/users/:userId/ban', adminController.banUser);
router.post('/users/:userId/unban', adminController.unbanUser);
router.get('/users/:userId/ban-history', adminController.getUserBanHistory);

// Ban statistics endpoint for admin dashboard
router.get('/ban-stats', adminController.banStats);

module.exports = router; 
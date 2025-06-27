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
router.post('/auctions/settled/:id/approve', auctionController.approveAuction);

// Live Auctions (Admin Only)
router.get('/auctions/live', liveAuctionController.getAdminLiveAuctions);
router.get('/auctions/live/pending', liveAuctionController.getAdminLiveAuctions);
router.patch('/auctions/live/:id/approve', liveAuctionController.approveLiveAuction);

module.exports = router; 
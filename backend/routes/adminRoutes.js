const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const roleAuth = require('../middleware/roleAuth');
const auctionController = require('../controllers/auctionController');

// All routes require authentication and admin role
router.use(jwtauthMiddleware);
router.use(roleAuth(['admin']));

// Get all pending seller approvals
router.get('/pending-sellers', adminController.getPendingSellers);

// Approve or reject a seller
router.patch('/sellers/:userId/approve', adminController.handleSellerApproval);

// List all pending auctions (admin only)
router.get('/auctions/pending', auctionController.listPendingAuctions);

// Approve an auction (admin only)
router.post('/auctions/:id/approve', auctionController.approveAuction);

module.exports = router; 
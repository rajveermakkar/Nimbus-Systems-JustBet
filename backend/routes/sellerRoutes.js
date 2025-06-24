const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const auctionController = require('../controllers/auctionController');
const jwtauth = require('../middleware/jwtauth');
const roleAuth = require('../middleware/roleAuth');

// All routes require authentication
router.use(jwtauthMiddleware);

// Request to become a seller
router.post('/request', sellerController.requestSellerRole);

// Get seller request status
router.get('/status', sellerController.getSellerRequestStatus);

// Create a new auction (seller only)
router.post('/auctions', jwtauth, roleAuth('seller'), auctionController.createAuction);

module.exports = router; 
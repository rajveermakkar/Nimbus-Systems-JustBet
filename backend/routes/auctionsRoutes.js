const express = require('express');
const router = express.Router();
const { getAllApprovedAuctions, placeBid, getBids, getAuctionWithBids, getAuctionCountdownAPI, processSpecificAuction } = require('../controllers/auctionController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const userController = require('../controllers/userController');

// Public: Get all approved settled auctions
router.get('/approved', getAllApprovedAuctions);

// Get auction with bid information (public)
router.get('/:id', getAuctionWithBids);

// Public: Get countdown for any auction (settled or live)
router.get('/countdown/:type/:id', getAuctionCountdownAPI);

// Bidding routes (require authentication)
router.use(jwtauthMiddleware);

// Place a bid on a settled auction
router.post('/:id/bid', placeBid);

// Get all bids for a settled auction
router.get('/:id/bids', getBids);

// Admin: Manually process a specific auction (for testing/fixing missed auctions)
router.post('/:id/process', processSpecificAuction);

// Winnings v2 (from results tables, type-safe)
// router.get('/winnings-v2', userController.getWinningsV2);

module.exports = router; 
const express = require('express');
const router = express.Router();
const { getAllApprovedAuctions, placeBid, getBids, getAuctionWithBids } = require('../controllers/auctionController');
const jwtauthMiddleware = require('../middleware/jwtauth');

// Public: Get all approved settled auctions
router.get('/approved', getAllApprovedAuctions);

// Get auction with bid information (public)
router.get('/:id', getAuctionWithBids);

// Bidding routes (require authentication)
router.use(jwtauthMiddleware);

// Place a bid on a settled auction
router.post('/:id/bid', placeBid);

// Get all bids for a settled auction
router.get('/:id/bids', getBids);

module.exports = router; 
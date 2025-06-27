const express = require('express');
const router = express.Router();
const { getAllApprovedAuctions, placeBid, getBids, getAuctionWithBids, getAuctionCountdownAPI, processSpecificAuction } = require('../controllers/auctionController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const userController = require('../controllers/userController');

// GET all approved settled auctions
router.get('/settled', getAllApprovedAuctions);

// GET single settled auction
router.get('/settled/:id', getAuctionWithBids);

// GET all bids for a settled auction
router.get('/settled/:id/bids', getBids);

// POST a bid on a settled auction
router.post('/settled/:id/bid', placeBid);

// GET result for a settled auction (winner info)
router.get('/settled/:id/result', userController.getSettledAuctionResult);

// POST manual process for a settled auction (admin only)
router.post('/settled/:id/process', processSpecificAuction);

// GET countdown for any auction (settled or live)
router.get('/countdown/:type/:id', getAuctionCountdownAPI);

// Bidding routes (require authentication)
router.use(jwtauthMiddleware);

// Winnings v2 (from results tables, type-safe)
// router.get('/winnings-v2', userController.getWinningsV2);

module.exports = router; 
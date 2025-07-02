const express = require('express');
const router = express.Router();
const { getAllApprovedAuctions, placeBid, getBids, getAuctionWithBids, getAuctionCountdownAPI, processSpecificAuction } = require('../controllers/auctionController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const userController = require('../controllers/userController');
const liveAuctionController = require('../controllers/liveAuctionController');

// GET all approved settled auctions
router.get('/settled', getAllApprovedAuctions);

// GET single settled auction
router.get('/settled/:id', getAuctionWithBids);

// GET all bids for a settled auction
router.get('/settled/:id/bids', getBids);

// GET result for a settled auction (winner info)
router.get('/settled/:id/result', userController.getSettledAuctionResult);

// GET countdown for any auction (settled or live)
router.get('/countdown/:type/:id', getAuctionCountdownAPI);

// GET all approved live auctions (public)
router.get('/live', liveAuctionController.getLiveAuctionsByStatus);

// GET single live auction (public)
router.get('/live/:id', liveAuctionController.getLiveAuctionById);

// GET all bids for a live auction (public)
router.get('/live/:id/bids', liveAuctionController.getLiveAuctionBids);

// GET result for a live auction (public)
router.get('/live/:id/result', userController.getLiveAuctionResult);

// Bidding and admin routes (require authentication)
router.use(jwtauthMiddleware);

// POST a bid on a settled auction (protected)
router.post('/settled/:id/bid', placeBid);

// POST manual process for a settled auction (admin only, protected)
router.post('/settled/:id/process', processSpecificAuction);

module.exports = router; 
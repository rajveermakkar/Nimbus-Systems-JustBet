const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');

// GET /api/auctions/live - get all live auctions
router.get('/live', auctionController.getLiveAuctions);

// GET /api/auctions/ended - get all ended auctions
router.get('/ended', auctionController.getEndedAuctions);

// GET /api/auctions/upcoming - get all upcoming auctions
router.get('/upcoming', auctionController.getUpcomingAuctions);

// GET /api/auctions/approved - get all approved auctions
router.get('/approved', auctionController.getAllApprovedAuctions);

// GET /api/auctions/:id/countdown - for settled auctions
router.get('/:id/countdown', auctionController.getAuctionCountdown);

module.exports = router; 
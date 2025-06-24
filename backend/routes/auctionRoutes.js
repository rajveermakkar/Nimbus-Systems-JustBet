const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');

// GET /api/auctions
router.get('/', auctionController.getAllAuctions);

// GET /api/auctions/:id/countdown
router.get('/:id/countdown', auctionController.getAuctionCountdown);

module.exports = router; 
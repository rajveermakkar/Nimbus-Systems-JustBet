const express = require('express');
const router = express.Router();
const liveAuctionController = require('../controllers/liveAuctionController');

// Public: Get approved live auctions only
router.get('/', liveAuctionController.getLiveAuctionsByStatus);

module.exports = router; 
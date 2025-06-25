const express = require('express');
const router = express.Router();
const liveAuctionController = require('../controllers/liveAuctionController');

// Public endpoint to Get approved live auctions 
router.get('/', liveAuctionController.getLiveAuctionsByStatus);

module.exports = router; 
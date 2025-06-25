const express = require('express');
const router = express.Router();
const liveAuctionController = require('../controllers/liveAuctionController');

// Public endpoint to Get approved live auctions 
router.get('/', liveAuctionController.getLiveAuctionsByStatus);

// Public endpoint to Get specific live auction by ID
router.get('/:id', liveAuctionController.getLiveAuctionById);

// Get bid history for a live auction
router.get('/:id/bids', liveAuctionController.getLiveAuctionBids);

// Join live auction room

module.exports = router; 
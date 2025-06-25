const express = require('express');
const router = express.Router();
const liveAuctionController = require('../controllers/liveAuctionController');

// Public endpoint to Get approved live auctions 
router.get('/', liveAuctionController.getLiveAuctionsByStatus);

// Public endpoint to Get specific live auction by ID
router.get('/:id', liveAuctionController.getLiveAuctionById);

module.exports = router; 
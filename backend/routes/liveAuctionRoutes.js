const express = require('express');
const router = express.Router();
const liveAuctionController = require('../controllers/liveAuctionController');
const userController = require('../controllers/userController');

// GET all approved live auctions
router.get('/auctions/live', liveAuctionController.getLiveAuctionsByStatus);

// GET single live auction
router.get('/auctions/live/:id', liveAuctionController.getLiveAuctionById);

// GET all bids for a live auction
router.get('/auctions/live/:id/bids', liveAuctionController.getLiveAuctionBids);

// GET result for a live auction (winner info)
router.get('/auctions/live/:id/result', userController.getLiveAuctionResult);

// Join live auction room

module.exports = router; 
const express = require('express');
const router = express.Router();
const { getAllApprovedAuctions } = require('../controllers/auctionController');

// Public: Get all approved settled auctions
router.get('/approved', getAllApprovedAuctions);

module.exports = router; 
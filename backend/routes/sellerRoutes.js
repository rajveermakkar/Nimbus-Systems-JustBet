const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const auctionController = require('../controllers/auctionController');
const jwtauth = require('../middleware/jwtauth');
const roleAuth = require('../middleware/roleAuth');
const { upload, uploadAuctionImage, getAllApprovedAuctions, updateAuction, getMyAuctions } = require('../controllers/auctionController');
const liveAuctionController = require('../controllers/liveAuctionController');

// All routes require authentication
router.use(jwtauthMiddleware);

// Request to become a seller
router.post('/request', sellerController.requestSellerRole);

// Get seller request status
router.get('/status', sellerController.getSellerRequestStatus);

// Create a new auction (seller only)
router.post('/auctions', jwtauth, roleAuth('seller'), auctionController.createAuction);

// Upload auction image (seller only)
router.post('/auctions/upload-image', jwtauth, roleAuth('seller'), upload, uploadAuctionImage);

// Update auction (seller only)
router.patch('/auctions/:id', jwtauth, roleAuth('seller'), updateAuction);

// Get a single settled auction by ID (seller only)
router.get('/auctions/:id', jwtauth, roleAuth('seller'), auctionController.getAuctionByIdForSeller);

// Get all auctions for the current seller
router.get('/auctions', jwtauth, roleAuth('seller'), getMyAuctions);

// Live Auctions (Seller Only)
// Create a new live auction
router.post('/live-auction', jwtauth, roleAuth('seller'), liveAuctionController.createLiveAuction);
// Upload image for live auction
router.post('/live-auction/upload-image', jwtauth, roleAuth('seller'), liveAuctionController.upload, liveAuctionController.uploadAuctionImage);
// Update a live auction
router.patch('/live-auction/:id', jwtauth, roleAuth('seller'), liveAuctionController.updateLiveAuction);
// Get a single live auction by ID (seller only)
router.get('/live-auction/:id', jwtauth, roleAuth('seller'), liveAuctionController.getLiveAuctionByIdForSeller);
// Get all live auctions for the current seller
router.get('/live-auction', jwtauth, roleAuth('seller'), liveAuctionController.getLiveAuctionsForSeller);

// Restart a live auction (seller only)
router.post('/live-auction/:id/restart', jwtauth, roleAuth('seller'), liveAuctionController.restartLiveAuction);

// Get seller analytics and auction results
router.get('/analytics', jwtauth, roleAuth('seller'), sellerController.getSellerAnalytics);

// Get auction results (winners, final bids, etc.)
router.get('/auction-results', jwtauth, roleAuth('seller'), sellerController.getAuctionResults);

module.exports = router; 
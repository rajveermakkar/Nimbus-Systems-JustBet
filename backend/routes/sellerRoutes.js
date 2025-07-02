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

// Settled Auctions (Seller Only)
router.post('/auctions/settled', jwtauth, roleAuth('seller'), auctionController.createAuction);
router.post('/auctions/settled/upload-image', jwtauth, roleAuth('seller'), upload, uploadAuctionImage);
router.patch('/auctions/settled/:id', jwtauth, roleAuth('seller'), updateAuction);
router.get('/auctions/settled/:id', jwtauth, roleAuth('seller'), auctionController.getAuctionByIdForSeller);
router.get('/auctions/settled', jwtauth, roleAuth('seller'), getMyAuctions);

// Live Auctions (Seller Only)
router.post('/auctions/live', jwtauth, roleAuth('seller'), liveAuctionController.createLiveAuction);
router.post('/auctions/live/upload-image', jwtauth, roleAuth('seller'), liveAuctionController.upload, liveAuctionController.uploadAuctionImage);
router.patch('/auctions/live/:id', jwtauth, roleAuth('seller'), liveAuctionController.updateLiveAuction);
router.get('/auctions/live/:id', jwtauth, roleAuth('seller'), liveAuctionController.getLiveAuctionByIdForSeller);
router.get('/auctions/live', jwtauth, roleAuth('seller'), liveAuctionController.getLiveAuctionsForSeller);
router.post('/auctions/live/:id/restart', jwtauth, roleAuth('seller'), liveAuctionController.restartLiveAuction);

// Seller analytics and auction results
router.get('/analytics', jwtauth, roleAuth('seller'), sellerController.getSellerAnalytics);
router.get('/auction-results', jwtauth, roleAuth('seller'), sellerController.getAuctionResults);

module.exports = router; 
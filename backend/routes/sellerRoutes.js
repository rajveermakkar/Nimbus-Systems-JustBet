const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const auctionController = require('../controllers/auctionController');
const jwtauth = require('../middleware/jwtauth');
const roleAuth = require('../middleware/roleAuth');
const { upload, uploadAuctionImage, getAllApprovedAuctions, updateAuction } = require('../controllers/auctionController');

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

// Public: Get all approved auctions
router.get('/auctions/approved', getAllApprovedAuctions);

// Update auction (seller only)
router.patch('/auctions/:id', jwtauth, roleAuth('seller'), updateAuction);

module.exports = router; 
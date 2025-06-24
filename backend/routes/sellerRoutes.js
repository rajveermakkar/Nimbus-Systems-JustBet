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

// Public: Get all approved auctions
router.get('/auctions/approved', getAllApprovedAuctions);

// Update auction (seller only)
router.patch('/auctions/:id', jwtauth, roleAuth('seller'), updateAuction);

// Get all auctions for the current seller
router.get('/auctions', jwtauth, roleAuth('seller'), getMyAuctions);

// Live Auctions (Seller Only)
// Create a new live auction
router.post('/live-auction', jwtauth, roleAuth('seller'), liveAuctionController.createLiveAuction);
// Upload image for live auction
router.post('/live-auction/upload-image', jwtauth, roleAuth('seller'), liveAuctionController.upload, liveAuctionController.uploadAuctionImage);
// Update a live auction
router.patch('/live-auction/:id', jwtauth, roleAuth('seller'), liveAuctionController.updateLiveAuction);
// Get all live auctions for the current seller
router.get('/live-auction', jwtauth, roleAuth('seller'), async (req, res) => {
  // This returns all live auctions created by the current seller
  try {
    const auctions = await liveAuctionController.getLiveAuctionsByStatus({
      query: { status: undefined },
      user: req.user,
      sellerOnly: true,
      res
    });
    // If the controller handles the response, return
    if (res.headersSent) return;
    res.json(auctions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const jwtauthMiddleware = require('../middleware/jwtauth');

// All routes require authentication
router.use(jwtauthMiddleware);

// Request to become a seller
router.post('/request', sellerController.requestSellerRole);

// Get seller request status
router.get('/status', sellerController.getSellerRequestStatus);

module.exports = router; 
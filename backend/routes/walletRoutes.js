const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const jwtauth = require('../middleware/jwtauth');

// Stripe webhook endpoint (no auth)
router.post('/webhook', walletController.handleStripeWebhook);

// All wallet routes require authentication
router.use(jwtauth);

// Get wallet balance
router.get('/balance', walletController.getBalance);

// Get wallet transaction history
router.get('/transactions', walletController.getTransactions);

// Create a Stripe payment intent for deposit
router.post('/deposit', walletController.createDepositIntent);

module.exports = router; 
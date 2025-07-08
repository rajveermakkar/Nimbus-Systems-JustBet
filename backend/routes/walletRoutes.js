const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authenticateToken = require('../middleware/jwtauth');

// Wallet routes
router.get('/balance', authenticateToken, walletController.getBalance);
router.get('/transactions', authenticateToken, walletController.getTransactions);
router.post('/create', authenticateToken, walletController.createWallet);

// Deposit and withdrawal routes
router.post('/deposit/intent', authenticateToken, walletController.createDepositIntent);
router.post('/withdraw', authenticateToken, walletController.createWithdrawalIntent);

// Stripe webhook (no auth required)
router.post('/webhook', walletController.handleStripeWebhook);

// Payment method management
router.get('/payment-methods', authenticateToken, walletController.listPaymentMethods);
router.post('/payment-methods/setup-intent', authenticateToken, walletController.createSetupIntent);
router.delete('/payment-methods/:id', authenticateToken, walletController.removePaymentMethod);

module.exports = router; 
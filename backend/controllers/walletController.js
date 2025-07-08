const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const stripeService = require('../services/stripeService');
const User = require('../models/User');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Get wallet balance for logged-in user
async function getBalance(req, res) {
  try {
    const userId = req.user.id;
    const wallet = await Wallet.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    res.json({ balance: wallet.balance, currency: wallet.currency });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get wallet balance' });
  }
}

// Get wallet transaction history for logged-in user
async function getTransactions(req, res) {
  try {
    const userId = req.user.id;
    const transactions = await Transaction.getTransactionsByUserId(userId);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
}

// Create a Stripe payment intent for deposit
async function createDepositIntent(req, res) {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const paymentIntent = await stripeService.createPaymentIntent(userId, amount, 'usd');
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

// Stripe webhook handler
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const userId = paymentIntent.metadata.userId;
    const amount = paymentIntent.amount_received / 100;
    try {
      // Find wallet
      const wallet = await Wallet.getWalletByUserId(userId);
      if (!wallet) return res.status(404).send('Wallet not found');
      // Credit wallet
      await Wallet.updateBalance(userId, amount);
      // Record transaction
      await Transaction.createTransaction({
        walletId: wallet.id,
        type: 'deposit',
        amount,
        description: 'Stripe deposit',
        referenceId: paymentIntent.id,
        status: 'succeeded'
      });
      return res.json({ received: true });
    } catch (err) {
      return res.status(500).send('Failed to process deposit');
    }
  }
  res.json({ received: true });
}

// Create a wallet for the logged-in user
async function createWallet(req, res) {
  try {
    const userId = req.user.id;
    let wallet = await Wallet.getWalletByUserId(userId);
    if (wallet) {
      return res.json({ wallet });
    }
    wallet = await Wallet.createWallet(userId);
    res.status(201).json({ wallet });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create wallet' });
  }
}

module.exports = {
  getBalance,
  getTransactions,
  createDepositIntent,
  handleStripeWebhook,
  createWallet
}; 
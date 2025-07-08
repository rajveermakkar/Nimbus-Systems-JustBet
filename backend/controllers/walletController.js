const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const stripeService = require('../services/stripeService');
const User = require('../models/User');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);



// Get seller earnings (total sales minus withdrawals)
async function getSellerEarnings(userId) {
  const { pool } = require('../db/init');
  
  // Get total sales from auction results
  const salesQuery = `
    SELECT COALESCE(SUM(final_bid), 0) as total_sales
    FROM (
      SELECT final_bid FROM settled_auction_results 
      WHERE winner_id IN (SELECT id FROM users WHERE id = $1)
      UNION ALL
      SELECT final_bid FROM live_auction_results 
      WHERE winner_id IN (SELECT id FROM users WHERE id = $1)
    ) as all_sales
  `;
  
  const salesResult = await pool.query(salesQuery, [userId]);
  const totalSales = parseFloat(salesResult.rows[0]?.total_sales || 0);
  
  // Get total withdrawals
  const withdrawalsQuery = `
    SELECT COALESCE(SUM(ABS(amount)), 0) as total_withdrawals
    FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE w.user_id = $1 AND wt.type = 'withdrawal' AND wt.status = 'succeeded'
  `;
  
  const withdrawalsResult = await pool.query(withdrawalsQuery, [userId]);
  const totalWithdrawals = parseFloat(withdrawalsResult.rows[0]?.total_withdrawals || 0);
  
  return totalSales - totalWithdrawals;
}

// Get buyer unspent deposits (deposits minus spent on auctions)
async function getBuyerUnspentDeposits(userId) {
  const { pool } = require('../db/init');
  
  // Get total deposits
  const depositsQuery = `
    SELECT COALESCE(SUM(amount), 0) as total_deposits
    FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE w.user_id = $1 AND wt.type = 'deposit' AND wt.status = 'succeeded'
  `;
  
  const depositsResult = await pool.query(depositsQuery, [userId]);
  const totalDeposits = parseFloat(depositsResult.rows[0]?.total_deposits || 0);
  
  // Get total spent on auctions (bids placed)
  const spentQuery = `
    SELECT COALESCE(SUM(amount), 0) as total_spent
    FROM (
      SELECT amount FROM settled_auction_bids WHERE user_id = $1
      UNION ALL
      SELECT amount FROM live_auction_bids WHERE user_id = $1
    ) as all_bids
  `;
  
  const spentResult = await pool.query(spentQuery, [userId]);
  const totalSpent = parseFloat(spentResult.rows[0]?.total_spent || 0);
  
  return totalDeposits - totalSpent;
}

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
    // Check direct access
    if (process.env.ALLOW_DIRECT_API_ACCESS !== 'true') {
      return res.status(403).json({ error: 'Direct API access not allowed' });
    }
    
    const userId = req.user.id;
    const { amount } = req.body;
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Check daily deposit limit (if needed)
    const DAILY_DEPOSIT_LIMIT = 2000; // $2000 CAD per day
    const todayDeposits = await getTodayDeposits(userId);
    if (todayDeposits + amount > DAILY_DEPOSIT_LIMIT) {
      return res.status(400).json({ error: 'Daily deposit limit exceeded' });
    }
    
    const paymentIntent = await stripeService.createPaymentIntent(userId, amount, 'cad');
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

// Create a withdrawal request
async function createWithdrawalIntent(req, res) {
  try {
    // Check direct access
    if (process.env.ALLOW_DIRECT_API_ACCESS !== 'true') {
      return res.status(403).json({ error: 'Direct API access not allowed' });
    }
    
    const userId = req.user.id;
    const { amount } = req.body;
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Get user role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check wallet exists
    const wallet = await Wallet.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    // Check wallet balance
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    
    let availableAmount = 0;
    
    if (user.role === 'seller') {
      // Sellers can withdraw their earnings
      availableAmount = await getSellerEarnings(userId);
      if (amount > availableAmount) {
        return res.status(400).json({ 
          error: 'Insufficient earnings', 
          available: availableAmount 
        });
      }
    } else {
      // Buyers can only withdraw unspent deposits
      availableAmount = await getBuyerUnspentDeposits(userId);
      if (amount > availableAmount) {
        return res.status(400).json({ 
          error: 'Insufficient unspent deposits', 
          available: availableAmount 
        });
      }
    }
    
    // Find the most recent deposit transaction for this user
    const transactions = await Transaction.getTransactionsByUserId(userId);
    const depositTransaction = transactions.find(t => t.type === 'deposit' && t.status === 'succeeded');
    
    if (!depositTransaction || !depositTransaction.reference_id) {
      return res.status(400).json({ error: 'No previous deposit found for withdrawal' });
    }
    
    // Verify the original payment was real
    try {
      const originalPayment = await stripe.paymentIntents.retrieve(depositTransaction.reference_id);
      if (originalPayment.status !== 'succeeded' || originalPayment.amount_received === 0) {
        return res.status(400).json({ error: 'No real payment found for withdrawal' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid payment for withdrawal' });
    }
    
    // Create refund to original payment
    const refund = await stripe.refunds.create({
      payment_intent: depositTransaction.reference_id,
      amount: Math.round(amount * 100), // Convert to cents
      reason: 'requested_by_customer'
    });
    
    // Debit wallet
    await Wallet.updateBalance(userId, -amount);
    
    // Record withdrawal transaction
    await Transaction.createTransaction({
      walletId: wallet.id,
      type: 'withdrawal',
      amount: -amount,
      description: user.role === 'seller' ? 'Seller earnings withdrawal' : 'Buyer deposit withdrawal',
      referenceId: refund.id,
      status: 'succeeded'
    });
    
    res.json({ 
      message: 'Withdrawal processed successfully',
      refundId: refund.id,
      amount: amount,
      userRole: user.role
    });
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
}

// Helper function to get today's deposits
async function getTodayDeposits(userId) {
  const { pool } = require('../db/init');
  const query = `
    SELECT COALESCE(SUM(amount), 0) as today_deposits
    FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE w.user_id = $1 
    AND wt.type = 'deposit' 
    AND wt.status = 'succeeded'
    AND DATE(wt.created_at) = CURRENT_DATE
  `;
  const result = await pool.query(query, [userId]);
  return parseFloat(result.rows[0]?.today_deposits || 0);
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
      // Verify this is a real payment
      if (paymentIntent.status !== 'succeeded' || paymentIntent.amount_received === 0) {
        console.log('Invalid payment intent:', paymentIntent.id);
        return res.status(400).send('Invalid payment');
      }
      
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
      console.error('Webhook processing error:', err);
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
  createWithdrawalIntent,
  handleStripeWebhook,
  createWallet
}; 
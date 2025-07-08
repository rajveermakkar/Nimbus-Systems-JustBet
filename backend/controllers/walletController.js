const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const stripeService = require('../services/stripeService');
const User = require('../models/User');
const StripeConnectedCustomer = require('../models/StripeConnectedCustomer');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const emailService = require('../services/emailService');
const { queryWithRetry } = require('../db/init');


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

// Get wallet transaction history for logged-in user (paginated)
async function getTransactions(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10)); // max 50 per page
    const offset = (page - 1) * limit;
    const [transactions, totalCount] = await Promise.all([
      Transaction.getTransactionsByUserIdPaginated(userId, limit, offset),
      Transaction.getTransactionCountByUserId(userId)
    ]);
    res.json({ transactions, totalCount, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
}

// Create a Stripe payment intent for deposit
async function createDepositIntent(req, res) {
  try {
    console.log('createDepositIntent req.body:', req.body);
    if (process.env.ALLOW_DIRECT_API_ACCESS !== 'true') {
      return res.status(403).json({ error: 'Direct API access not allowed' });
    }
    const userId = req.user.id;
    const { amount, saveCard, paymentMethodId } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const DAILY_DEPOSIT_LIMIT = 2000;
    const todayDeposits = await getTodayDeposits(userId);
    if (todayDeposits + amount > DAILY_DEPOSIT_LIMIT) {
      return res.status(400).json({ error: 'Daily deposit limit exceeded' });
    }
    let customerId = null;
    let user = await User.findById(userId);
    const connectedAccountId = user.stripe_account_id || null;
    if (connectedAccountId) {
      // For Connect: get or create customer on connected account
      let connectedCustomer = await StripeConnectedCustomer.findByUserAndAccount(userId, connectedAccountId);
      if (!connectedCustomer) {
        const customer = await stripe.customers.create(
          { email: user.email },
          { stripeAccount: connectedAccountId }
        );
        connectedCustomer = await StripeConnectedCustomer.create(userId, connectedAccountId, customer.id);
      }
      customerId = connectedCustomer.customer_id;
    } else if (saveCard || paymentMethodId) {
      customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email);
        await User.setStripeCustomerId(user.id, customer.id);
        customerId = customer.id;
      }
    }
    const paymentIntent = await stripeService.createPaymentIntent(userId, amount, 'cad', saveCard, customerId, paymentMethodId, connectedAccountId);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Failed to create payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

// Create a withdrawal request (demo mode: no Stripe refund, just update wallet and log)
async function createWithdrawalIntent(req, res) {
  try {
    if (process.env.ALLOW_DIRECT_API_ACCESS !== 'true') {
      return res.status(403).json({ error: 'Direct API access not allowed' });
    }
    const userId = req.user.id;
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const wallet = await Wallet.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    // Find the most recent deposit card (for demo log)
    let cardInfo = null;
    const transactions = await Transaction.getTransactionsByUserId(userId);
    const depositTransaction = transactions.find(t => t.type === 'deposit' && t.status === 'succeeded' && t.reference_id);
    if (depositTransaction && depositTransaction.reference_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(depositTransaction.reference_id);
        if (paymentIntent && paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0]) {
          const charge = paymentIntent.charges.data[0];
          if (charge.payment_method_details && charge.payment_method_details.card) {
            cardInfo = {
              brand: charge.payment_method_details.card.brand,
              last4: charge.payment_method_details.card.last4
            };
          }
        }
      } catch (err) {}
    }
    // Fallback: if no card found, just log generic
    if (cardInfo) {
      console.log(`Amount withdrawn to ${cardInfo.brand.toUpperCase()} ••••${cardInfo.last4}: $${amount}`);
    } else {
      console.log(`Amount withdrawn to saved card: $${amount}`);
    }
    // Debit wallet
    await Wallet.updateBalance(userId, -amount);
    // Record withdrawal transaction
    await Transaction.createTransaction({
      walletId: wallet.id,
      type: 'withdrawal',
      amount: -amount,
      description: 'Wallet withdrawal',
      referenceId: null,
      status: 'succeeded'
    });
    // Send withdrawal email notification
    const user = await User.findById(userId);
    if (user && user.email) {
      try {
        await emailService.sendWithdrawalNotification(user.email, amount, wallet.currency || 'CAD');
      } catch (emailErr) {
        console.error('Failed to send withdrawal email:', emailErr);
      }
    }
    res.json({
      message: 'Withdrawal processed successfully (demo mode)',
      amount: amount
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
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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
        amount: amount,
        description: 'Wallet deposit',
        referenceId: paymentIntent.id,
        status: 'succeeded'
      });
      
      // Send deposit email notification
      const user = await User.findById(userId);
      if (user && user.email) {
        try {
          await emailService.sendDepositNotification(user.email, amount, wallet.currency || 'CAD');
        } catch (emailErr) {
          console.error('Failed to send deposit email:', emailErr);
        }
      }
      return res.status(200).send('Deposit processed');
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

// List saved card payment methods for the logged-in user
async function listPaymentMethods(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user.stripe_customer_id) {
      return res.json({ paymentMethods: [] });
    }
    const methods = await stripeService.listPaymentMethods(user.stripe_customer_id);
    res.json({ paymentMethods: methods });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list payment methods' });
  }
}

// Create a SetupIntent for adding a card
async function createSetupIntent(req, res) {
  try {
    let user = await User.findById(req.user.id);
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      // Create Stripe customer for existing user if needed
      const customer = await stripeService.createCustomer(user.email);
      await User.setStripeCustomerId(user.id, customer.id);
      customerId = customer.id;
    }
    const setupIntent = await stripeService.createSetupIntent(customerId);
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
}

// Remove a card
// NOTE: If all cards are removed, user cannot withdraw until they add a new card and make a deposit. Cards not used for deposit are not verified for withdrawal.
async function removePaymentMethod(req, res) {
  try {
    const { id } = req.params;
    await stripeService.detachPaymentMethod(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove payment method' });
  }
}

// Get card info for most recent deposit
async function getMostRecentDepositCard(req, res) {
  try {
    const userId = req.user.id;
    const transactions = await Transaction.getTransactionsByUserId(userId);
    const depositTransaction = transactions.find(t => t.type === 'deposit' && t.status === 'succeeded' && t.reference_id);
    let card = null;
    if (depositTransaction && depositTransaction.reference_id) {
      // Fetch PaymentIntent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(depositTransaction.reference_id);
      if (paymentIntent && paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0]) {
        const charge = paymentIntent.charges.data[0];
        if (charge.payment_method_details && charge.payment_method_details.card) {
          card = {
            brand: charge.payment_method_details.card.brand,
            last4: charge.payment_method_details.card.last4
          };
        }
      }
    }
    // Fallback: if no card found, try to get saved payment methods
    if (!card) {
      const user = await User.findById(userId);
      if (user && user.stripe_customer_id) {
        const methods = await stripeService.listPaymentMethods(user.stripe_customer_id);
        if (methods && methods.length > 0) {
          card = {
            brand: methods[0].card.brand,
            last4: methods[0].card.last4
          };
        }
      }
    }
    if (!card) {
      // Improved error message for frontend
      return res.status(400).json({ 
        error: 'You have no card saved for withdrawal. Save a card and use it in a deposit to verify it for withdrawals. Cards not used for deposit are not verified and cannot be used for withdrawal.'
      });
    }
    return res.json({ card });
  } catch (err) {
    console.error('Error fetching most recent deposit card:', err);
    return res.status(500).json({ error: 'Failed to fetch card info' });
  }
}

// Get monthly summary for the logged-in user
async function getMonthlySummary(req, res) {
  try {
    const userId = req.user.id;
    const { pool } = require('../db/init');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JS months are 0-based
    // Get all transactions for this month
    const summaryQuery = `
      SELECT
        SUM(CASE WHEN wt.amount > 0 THEN wt.amount ELSE 0 END) AS total_added,
        SUM(CASE WHEN wt.type = 'withdrawal' AND wt.amount < 0 THEN ABS(wt.amount) ELSE 0 END) AS total_withdrawn,
        COUNT(*) AS transaction_count
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      WHERE w.user_id = $1
        AND EXTRACT(YEAR FROM wt.created_at) = $2
        AND EXTRACT(MONTH FROM wt.created_at) = $3
    `;
    const result = await pool.query(summaryQuery, [userId, year, month]);
    const row = result.rows[0] || {};
    res.json({
      totalAdded: Number(row.total_added) || 0,
      totalWithdrawn: Number(row.total_withdrawn) || 0,
      totalSpent: 0, // Placeholder for future bidding/purchase logic
      transactionCount: Number(row.transaction_count) || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get monthly summary' });
  }
}

// --- STRIPE CONNECT CONTROLLER LOGIC ---

// 1. Start onboarding: create account if needed, return onboarding link
async function startOnboarding(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'seller') return res.status(403).json({ error: 'Only sellers can onboard for payouts' });
    let accountId = user.stripe_account_id;
    if (!accountId) {
      // Create new connected account
      const account = await stripeService.createConnectedAccount(user.email);
      accountId = account.id;
      // Save to user
      await queryWithRetry('UPDATE users SET stripe_account_id = $1 WHERE id = $2', [accountId, userId]);
    }
    // Generate onboarding link
    const frontendBase = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
    const refreshUrl = `${frontendBase}/wallet`;
    const returnUrl = `${frontendBase}/wallet`;
    const url = await stripeService.generateOnboardingLink(accountId, refreshUrl, returnUrl);
    res.json({ url });
  } catch (err) {
    console.error('Stripe Connect onboarding error:', err);
    res.status(500).json({ error: 'Failed to start onboarding' });
  }
}

// 2. Get onboarding/KYC status
async function getOnboardingStatus(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || !user.stripe_account_id) return res.status(404).json({ error: 'No connected account' });
    const status = await stripeService.getAccountStatus(user.stripe_account_id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
}

// 3. Create payout to connected account
async function createPayout(req, res) {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const user = await User.findById(userId);
    if (!user || !user.stripe_account_id) return res.status(404).json({ error: 'No connected account' });
    // Check KYC status
    const status = await stripeService.getAccountStatus(user.stripe_account_id);
    if (!status.charges_enabled || !status.payouts_enabled) {
      return res.status(400).json({ error: 'Account not fully onboarded for payouts' });
    }
    // Check wallet balance (seller earnings)
    const earnings = await getSellerEarnings(userId);
    if (earnings < amount) return res.status(400).json({ error: 'Insufficient earnings for payout' });
    // Initiate payout
    await stripeService.createPayout(user.stripe_account_id, amount, 'cad');
    // Log payout (optional: create a transaction record)
    res.json({ success: true });
  } catch (err) {
    console.error('Stripe Connect payout error:', err);
    res.status(500).json({ error: 'Failed to create payout' });
  }
}

module.exports = {
  getBalance,
  getTransactions,
  createDepositIntent,
  createWithdrawalIntent,
  handleStripeWebhook,
  createWallet,
  listPaymentMethods,
  createSetupIntent,
  removePaymentMethod,
  getMostRecentDepositCard,
  getMonthlySummary,
  startOnboarding,
  getOnboardingStatus,
  createPayout
}; 
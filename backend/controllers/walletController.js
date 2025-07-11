const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const stripeService = require('../services/stripeService');
const User = require('../models/User');
const StripeConnectedCustomer = require('../models/StripeConnectedCustomer');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const emailService = require('../services/emailService');
const { queryWithRetry } = require('../db/init');


// Get seller earnings (sum of auction_income minus withdrawals)
async function getSellerEarnings(userId) {
  const { pool } = require('../db/init');
  // Get seller's wallet id
  const walletIdResult = await pool.query('SELECT id FROM wallets WHERE user_id = $1', [userId]);
  const walletId = walletIdResult.rows[0]?.id;
  if (!walletId) return 0;
  // Sum auction_income
  const incomeResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total_income FROM wallet_transactions WHERE wallet_id = $1 AND type = 'auction_income' AND status = 'succeeded'`,
    [walletId]
  );
  const totalIncome = parseFloat(incomeResult.rows[0]?.total_income || 0);
  // Sum withdrawals
  const withdrawalResult = await pool.query(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total_withdrawals FROM wallet_transactions WHERE wallet_id = $1 AND type = 'withdrawal' AND status = 'succeeded'`,
    [walletId]
  );
  const totalWithdrawals = parseFloat(withdrawalResult.rows[0]?.total_withdrawals || 0);
  return totalIncome - totalWithdrawals;
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
    console.log('[getBalance] userId:', userId);
    const wallet = await Wallet.getWalletByUserId(userId);
    console.log('[getBalance] wallet:', wallet);
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
    const user = await User.findById(userId);
    const connectedAccountId = user.stripe_account_id || null;
    
    console.log('[createDepositIntent] Debug:', {
      userId,
      connectedAccountId,
      userEmail: user.email,
      platformCustomerId: user.stripe_customer_id,
      amount,
      saveCard,
      paymentMethodId
    });
    
    // Always use platform customer for consistency
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      console.log('[createDepositIntent] Creating new platform customer');
      const customer = await stripeService.createCustomer(user.email);
      await User.setStripeCustomerId(user.id, customer.id);
      customerId = customer.id;
      console.log('[createDepositIntent] New platform customer created:', customerId);
    } else {
      // Verify the customer exists on platform account
      try {
        await stripe.customers.retrieve(customerId);
        console.log('[createDepositIntent] Platform customer verified:', customerId);
      } catch (err) {
        console.log('[createDepositIntent] Platform customer not found, creating new one');
        const customer = await stripeService.createCustomer(user.email);
        await User.setStripeCustomerId(user.id, customer.id);
        customerId = customer.id;
        console.log('[createDepositIntent] New platform customer created:', customerId);
      }
    }
    
    console.log('[createDepositIntent] Final customerId:', customerId);
    console.log('[createDepositIntent] Creating PaymentIntent with connectedAccountId:', connectedAccountId);
    
    // Always use platform account for consistency
    // Platform customer will be created on first interaction if it doesn't exist
    const finalConnectedAccountId = null; // Always use platform account
    
    console.log('[createDepositIntent] Final connectedAccountId (always platform):', finalConnectedAccountId);
    
    const paymentIntent = await stripeService.createPaymentIntent(userId, amount, 'cad', saveCard, customerId, paymentMethodId, finalConnectedAccountId);
    console.log('[createDepositIntent] PaymentIntent created:', {
      clientSecret: paymentIntent.client_secret,
      connectedAccountId,
      customerId,
      paymentIntentId: paymentIntent.id
    });
    res.json({ 
      clientSecret: paymentIntent.client_secret
      // No stripeAccount since we always use platform account
    });
  } catch (err) {
    console.error('Failed to create payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

// Create a withdrawal request (refund for users, payout for sellers)
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
    const user = await User.findById(userId);
    const wallet = await Wallet.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check if user has a connected account (seller)
    const hasConnectedAccount = user.role === 'seller' && user.stripe_account_id;
    
    if (hasConnectedAccount) {
      // Seller: Check if they have earned funds available for payout
      // For now, we'll assume all withdrawals are refunds unless explicitly earned
      // You can add logic here to track earned vs deposited funds
      console.log('[createWithdrawalIntent] Seller withdrawal - using refund method for deposited funds');
    }

    // Always use refund method for wallet withdrawals (deposited funds)
    // Find the most recent successful deposit transaction
    const transactions = await Transaction.getTransactionsByUserId(userId);
    const depositTx = transactions.find(t => t.type === 'deposit' && t.status === 'succeeded' && t.reference_id);
    
    if (!depositTx || !depositTx.reference_id) {
      return res.status(400).json({ error: 'No deposit found to refund.' });
    }
    
    // Issue refund
    const refund = await stripeService.createRefund(depositTx.reference_id, amount, wallet.currency || 'cad');
    if (refund.status === 'succeeded') {
      await Wallet.updateBalance(userId, -amount);
      await Transaction.createTransaction({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: -amount,
        description: 'Wallet withdrawal (refund)',
        referenceId: refund.id,
        status: 'succeeded'
      });
      if (user.email) {
        try {
          await emailService.sendWithdrawalNotification(user.email, amount, wallet.currency || 'CAD');
        } catch (emailErr) {
          console.error('Failed to send withdrawal email:', emailErr);
        }
      }
      return res.json({ message: 'Withdrawal processed and refunded', amount });
    } else {
      return res.status(500).json({ error: 'Refund failed' });
    }
  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
}

// Create a seller earnings withdrawal (payout via Stripe Connect)
async function createSellerEarningsWithdrawal(req, res) {
  try {
    const userId = req.user.id;
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const user = await User.findById(userId);
    if (user.role !== 'seller' || !user.stripe_account_id) {
      return res.status(403).json({ error: 'Seller account required for earnings withdrawal' });
    }
    
    const wallet = await Wallet.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    // Check KYC status
    const status = await stripeService.getAccountStatus(user.stripe_account_id);
    if (!status.charges_enabled || !status.payouts_enabled) {
      return res.status(400).json({ error: 'Account not fully onboarded for payouts' });
    }
    
    // For now, we'll allow withdrawal of any balance
    // In the future, you can add logic to track earned vs deposited funds
    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // --- Manual transfer from platform to seller's connected account ---
    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: wallet.currency || 'cad',
        destination: user.stripe_account_id,
        description: 'Seller earnings withdrawal (manual transfer)'
      });
    } catch (transferErr) {
      console.error('Stripe transfer to connected account failed:', transferErr);
      return res.status(500).json({ error: 'Failed to transfer funds to seller account. Please try again later.' });
    }

    // --- Now create payout from connected account to seller's bank ---
    let payout;
    try {
      payout = await stripeService.createPayout(user.stripe_account_id, amount, wallet.currency || 'cad');
    } catch (payoutErr) {
      console.error('Stripe payout from connected account failed:', payoutErr);
      return res.status(500).json({ error: 'Failed to create payout from seller account. Please try again later.' });
    }
    
    // Debit wallet
    await Wallet.updateBalance(userId, -amount);
    
    // Record payout transaction (include both transfer and payout IDs)
    await Transaction.createTransaction({
      walletId: wallet.id,
      type: 'withdrawal',
      amount: -amount,
      description: 'Seller earnings withdrawal (manual transfer + payout)',
      referenceId: `${transfer.id}|${payout.id}`,
      status: 'succeeded'
    });
    
    // Send notification (optional)
    if (user.email) {
      try {
        await emailService.sendWithdrawalNotification(user.email, amount, wallet.currency || 'CAD');
      } catch (emailErr) {
        console.error('Failed to send withdrawal email:', emailErr);
      }
    }
    
    return res.json({ message: 'Earnings withdrawal processed successfully', amount, transferId: transfer.id, payoutId: payout.id });
  } catch (err) {
    console.error('Seller earnings withdrawal error:', err);
    res.status(500).json({ error: 'Failed to process earnings withdrawal' });
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
  console.log('Webhook called!');
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook event type:', event.type);
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('Webhook paymentIntent metadata:', paymentIntent.metadata);
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
    const userId = user.id;
    const connectedAccountId = user.stripe_account_id || null;
    let customerId = null;
    
    console.log('[createSetupIntent] Debug:', {
      userId,
      connectedAccountId,
      userEmail: user.email,
      platformCustomerId: user.stripe_customer_id
    });
    
    // Always create/use platform customer for card setup
    customerId = user.stripe_customer_id;
    if (!customerId) {
      console.log('[createSetupIntent] Creating new platform customer');
      const customer = await stripeService.createCustomer(user.email);
      await User.setStripeCustomerId(user.id, customer.id);
      customerId = customer.id;
      console.log('[createSetupIntent] New platform customer created:', customerId);
    } else {
      // Verify the customer exists on platform account
      try {
        await stripe.customers.retrieve(customerId);
        console.log('[createSetupIntent] Platform customer verified:', customerId);
      } catch (err) {
        console.log('[createSetupIntent] Platform customer not found, creating new one');
        const customer = await stripeService.createCustomer(user.email);
        await User.setStripeCustomerId(user.id, customer.id);
        customerId = customer.id;
        console.log('[createSetupIntent] New platform customer created:', customerId);
      }
    }
    
    console.log('[createSetupIntent] Final customerId:', customerId);
    console.log('[createSetupIntent] Creating SetupIntent on platform account (no connected account)');
    
    // Always create SetupIntent on platform account
    const setupIntent = await stripeService.createSetupIntent(customerId, null);
    console.log('SetupIntent created:', {
      clientSecret: setupIntent.client_secret,
      connectedAccountId: null,
      customerId,
      setupIntentId: setupIntent.id
    });
    res.json({ 
      clientSecret: setupIntent.client_secret
      // No stripeAccount since we're using platform account
    });
  } catch (err) {
    console.error('SetupIntent creation error:', err);
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
    if (user.role !== 'seller' && user.role !== 'admin') return res.status(403).json({ error: 'Only sellers or admins can onboard for payouts' });
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
    const refreshUrl = user.role === 'admin' ? `${frontendBase}/admin` : `${frontendBase}/wallet`;
    const returnUrl = user.role === 'admin' ? `${frontendBase}/admin/earnings` : `${frontendBase}/wallet`;
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
    let availableBalance = 0;
    let txType = 'withdrawal';
    let txDescription = '';
    let earnings = 0;
    if (user.role === 'admin') {
      // Admin: platform earnings minus admin withdrawals
      const { pool } = require('../db/init');
      const earningsQuery = `SELECT COALESCE(SUM(amount), 0) as total_earnings FROM wallet_transactions WHERE type = 'platform_fee' AND status = 'succeeded'`;
      const earningsResult = await pool.query(earningsQuery);
      const totalEarnings = parseFloat(earningsResult.rows[0]?.total_earnings || 0);
      const withdrawalsQuery = `SELECT COALESCE(SUM(ABS(amount)), 0) as total_withdrawals FROM wallet_transactions WHERE type = 'admin_withdrawal' AND status = 'succeeded'`;
      const withdrawalsResult = await pool.query(withdrawalsQuery);
      const totalWithdrawals = parseFloat(withdrawalsResult.rows[0]?.total_withdrawals || 0);
      availableBalance = totalEarnings - totalWithdrawals;
      txType = 'admin_withdrawal';
      txDescription = 'Admin platform fees withdrawal (manual transfer + payout)';
      earnings = availableBalance;
    } else if (user.role === 'seller') {
      // Seller: seller earnings
      earnings = await getSellerEarnings(userId);
      availableBalance = earnings;
      txType = 'withdrawal';
      txDescription = 'Seller earnings withdrawal (manual transfer + payout)';
    } else {
      return res.status(403).json({ error: 'Only sellers or admins can request payout' });
    }
    if (availableBalance < amount) return res.status(400).json({ error: 'Insufficient earnings for payout' });

    // --- Manual transfer from platform to connected account ---
    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'cad',
        destination: user.stripe_account_id,
        description: txDescription
      });
    } catch (transferErr) {
      console.error('Stripe transfer to connected account failed:', transferErr);
      return res.status(500).json({ error: 'Failed to transfer funds to connected account. Please try again later.' });
    }

    // --- Now create payout from connected account to bank ---
    let payout;
    try {
      payout = await stripeService.createPayout(user.stripe_account_id, amount, 'cad');
    } catch (payoutErr) {
      console.error('Stripe payout from connected account failed:', payoutErr);
      return res.status(500).json({ error: 'Failed to create payout from connected account. Please try again later.' });
    }

    // Record payout transaction (include both transfer and payout IDs)
    const wallet = await Wallet.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    await Transaction.createTransaction({
      walletId: wallet.id,
      type: txType,
      amount: -amount,
      description: txDescription,
      referenceId: `${transfer.id}|${payout.id}`,
      status: 'succeeded'
    });

    res.json({ success: true, transferId: transfer.id, payoutId: payout.id });
  } catch (err) {
    console.error('Stripe Connect payout error:', err);
    res.status(500).json({ error: 'Failed to create payout' });
  }
}

// Get seller earnings balance (for Seller Dashboard)
async function getSellerEarningsBalance(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can view earnings balance' });
    }
    const earnings = await getSellerEarnings(userId);
    res.json({ earnings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get seller earnings balance' });
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
  createPayout,
  createSellerEarningsWithdrawal,
  getSellerEarningsBalance
}; 
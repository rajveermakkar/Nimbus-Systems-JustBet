const { pool, queryWithRetry } = require('../db/init');

// Create a new wallet transaction
async function createTransaction({ walletId, type, amount, description, referenceId, status = 'pending', auctionId = null }) {
  const query = `
    INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status, auction_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const result = await queryWithRetry(query, [walletId, type, amount, description, referenceId, status, auctionId]);
  return result.rows[0];
}

// Get all transactions for a wallet
async function getTransactionsByWalletId(walletId) {
  const query = 'SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC';
  const result = await queryWithRetry(query, [walletId]);
  return result.rows;
}

// Get all transactions for a user (by joining wallets)
async function getTransactionsByUserId(userId) {
  const query = `
    SELECT wt.* FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE w.user_id = $1
    ORDER BY wt.created_at DESC
  `;
  const result = await queryWithRetry(query, [userId]);
  return result.rows;
}

// Get paginated transactions for a user (by joining wallets)
async function getTransactionsByUserIdPaginated(userId, limit, offset) {
  const query = `
    SELECT wt.* FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE w.user_id = $1
    ORDER BY wt.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await queryWithRetry(query, [userId, limit, offset]);
  return result.rows;
}

// Get total transaction count for a user
async function getTransactionCountByUserId(userId) {
  const query = `
    SELECT COUNT(*) FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE w.user_id = $1
  `;
  const result = await queryWithRetry(query, [userId]);
  return parseInt(result.rows[0].count, 10);
}

// Get total platform fees
async function getTotalPlatformFees() {
  const query = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    WHERE wt.type = 'platform_fee'
  `;
  const result = await queryWithRetry(query);
  return parseFloat(result.rows[0].total);
}

// Create transaction directly (for admin payouts)
async function create({ user_id, type, amount, description, status = 'succeeded', reference_id = null, auction_id = null }) {
  // Get user's wallet
  const Wallet = require('./Wallet');
  const wallet = await Wallet.getWalletByUserId(user_id);
  if (!wallet) {
    throw new Error('User wallet not found');
  }
  const query = `
    INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status, auction_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const result = await queryWithRetry(query, [wallet.id, type, amount, description, reference_id, status, auction_id]);
  return result.rows[0];
}

module.exports = {
  createTransaction,
  getTransactionsByWalletId,
  getTransactionsByUserId,
  getTransactionsByUserIdPaginated,
  getTransactionCountByUserId,
  getTotalPlatformFees,
  create
}; 
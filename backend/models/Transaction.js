const { pool, queryWithRetry } = require('../db/init');

// Create a new wallet transaction
async function createTransaction({ walletId, type, amount, description, referenceId, status = 'pending' }) {
  const query = `
    INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await queryWithRetry(query, [walletId, type, amount, description, referenceId, status]);
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

module.exports = {
  createTransaction,
  getTransactionsByWalletId,
  getTransactionsByUserId
}; 
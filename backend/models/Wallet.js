const { pool, queryWithRetry } = require('../db/init');

// Create a new wallet for a user
async function createWallet(userId) {
  const query = `
    INSERT INTO wallets (user_id, currency)
    VALUES ($1, 'CAD')
    RETURNING *
  `;
  const result = await queryWithRetry(query, [userId]);
  return result.rows[0];
}

// Get wallet by user ID
async function getWalletByUserId(userId) {
  const query = 'SELECT * FROM wallets WHERE user_id = $1';
  const result = await queryWithRetry(query, [userId]);
  return result.rows[0];
}

// Update wallet balance (add or subtract)
async function updateBalance(userId, amount) {
  const query = `
    UPDATE wallets
    SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $2
    RETURNING *
  `;
  const result = await queryWithRetry(query, [amount, userId]);
  return result.rows[0];
}

// Get all wallets (admin/debug)
async function getAllWallets() {
  const query = 'SELECT * FROM wallets';
  const result = await queryWithRetry(query);
  return result.rows;
}

module.exports = {
  createWallet,
  getWalletByUserId,
  updateBalance,
  getAllWallets
}; 
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
  // Check current balance
  const wallet = await getWalletByUserId(userId);
  if (!wallet) throw new Error('Wallet not found');
  const newBalance = Number(wallet.balance) + Number(amount);
  if (newBalance < 0) {
    throw new Error('Insufficient funds: wallet balance cannot go negative');
  }
  const query = `
    UPDATE wallets
    SET balance = $1, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $2
    RETURNING *
  `;
  const result = await queryWithRetry(query, [newBalance, userId]);
  return result.rows[0];
}

// Get all wallets (admin/debug)
async function getAllWallets() {
  const query = 'SELECT * FROM wallets';
  const result = await queryWithRetry(query);
  return result.rows;
}

// --- Wallet Blocks Logic ---

// Get total blocked amount for a user
async function getTotalBlockedAmount(userId) {
  const query = 'SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_blocks WHERE user_id = $1';
  const result = await queryWithRetry(query, [userId]);
  return Number(result.rows[0].total) || 0;
}

// Create a wallet block
async function createWalletBlock(userId, auctionId, amount) {
  const query = `
    INSERT INTO wallet_blocks (user_id, auction_id, amount)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await queryWithRetry(query, [userId, auctionId, amount]);
  return result.rows[0];
}

// Remove a wallet block
async function removeWalletBlock(userId, auctionId) {
  const query = 'DELETE FROM wallet_blocks WHERE user_id = $1 AND auction_id = $2 RETURNING *';
  const result = await queryWithRetry(query, [userId, auctionId]);
  return result.rows[0];
}

// Get a wallet block by user and auction
async function getWalletBlock(userId, auctionId) {
  const query = 'SELECT * FROM wallet_blocks WHERE user_id = $1 AND auction_id = $2';
  const result = await queryWithRetry(query, [userId, auctionId]);
  return result.rows[0];
}

module.exports = {
  createWallet,
  getWalletByUserId,
  updateBalance,
  getAllWallets,
  getTotalBlockedAmount,
  createWalletBlock,
  removeWalletBlock,
  getWalletBlock
}; 
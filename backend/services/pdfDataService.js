const { pool } = require('../db/init');
const SettledAuction = require('../models/SettledAuction');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const LiveAuction = require('../models/LiveAuction');
const Wallet = require('../models/Wallet');

async function getOrderPdfData(orderId) {
  // Fetch order
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (orderResult.rows.length === 0) throw new Error('Order not found');
  const order = orderResult.rows[0];

  // Try to determine auction type (default to settled)
  let auction = null;
  let auctionType = 'settled';
  // Try settled auction first
  auction = await SettledAuction.findByIdWithSeller(order.auction_id);
  if (!auction) {
    // Try live auction if not found in settled
    if (LiveAuction.findByIdWithSeller) {
      auction = await LiveAuction.findByIdWithSeller(order.auction_id);
      auctionType = 'live';
    } else {
      // fallback: fetch live auction basic info
      const liveResult = await pool.query('SELECT * FROM live_auctions WHERE id = $1', [order.auction_id]);
      if (liveResult.rows.length > 0) {
        auction = liveResult.rows[0];
        auctionType = 'live';
      }
    }
  }

  // Fetch winner and seller
  const winner = await User.findById(order.winner_id);
  let seller = null;
  if (auction && auction.seller) {
    seller = auction.seller;
  } else if (auction && auction.seller_id) {
    seller = await User.findById(auction.seller_id);
  } else {
    seller = await User.findById(order.seller_id);
  }

  // Fetch winner's wallet
  const winnerWallet = await Wallet.getWalletByUserId(order.winner_id);

  // Fetch wallet transaction for this auction and winner
  let walletTxn = null;
  if (winnerWallet) {
    const txnResult = await pool.query(
      'SELECT * FROM wallet_transactions WHERE auction_id = $1 AND wallet_id = $2 AND type = $3 ORDER BY created_at DESC LIMIT 1',
      [order.auction_id, winnerWallet.id, 'auction_payment']
    );
    walletTxn = txnResult.rows[0] || null;
  }

  return {
    order,
    auction,
    auctionType,
    winner,
    seller,
    walletTxn,
    walletTxnId: walletTxn ? walletTxn.id : null
  };
}

module.exports = { getOrderPdfData }; 
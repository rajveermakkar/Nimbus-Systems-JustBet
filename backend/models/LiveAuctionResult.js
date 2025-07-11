const { pool } = require('../db/init');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const LiveAuction = require('./LiveAuction');
const LiveAuctionBid = require('./LiveAuctionBid');

const LiveAuctionResult = {
  // Create a new auction result
  async create({ auctionId, winnerId, finalBid, reserveMet, status }) {
    const query = `
      INSERT INTO live_auction_results (auction_id, winner_id, final_bid, reserve_met, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (auction_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [auctionId, winnerId, finalBid, reserveMet, status]);
    return result.rows[0];
  },

  // Find result by auction ID
  async findByAuctionId(auctionId) {
    const result = await pool.query(
      'SELECT * FROM live_auction_results WHERE auction_id = $1',
      [auctionId]
    );
    return result.rows[0];
  },

  // Get all results
  async findAll() {
    const result = await pool.query(
      'SELECT * FROM live_auction_results ORDER BY created_at DESC'
    );
    return result.rows;
  },

  // Get results with user and auction details
  async findAllWithDetails() {
    const query = `
      SELECT 
        lar.*,
        u.first_name as winner_first_name,
        u.last_name as winner_last_name,
        u.email as winner_email,
        la.title as auction_title,
        la.starting_price,
        la.reserve_price
      FROM live_auction_results lar
      LEFT JOIN users u ON lar.winner_id = u.id
      LEFT JOIN live_auctions la ON lar.auction_id = la.id
      ORDER BY lar.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }
};

// Finalize a live auction (process winner, funds, etc.)
LiveAuctionResult.finalizeAuction = async function(auctionId) {
  console.log(`[FINALIZE] Starting finalizeAuction for auctionId=${auctionId}`);
  
  // Get the auction
  const auction = await LiveAuction.findById(auctionId);
  if (!auction || auction.status === 'closed') {
    console.log(`[FINALIZE] Auction ${auctionId} not found or already closed, skipping.`);
    return;
  }
  
  // Check if result already exists for this auction (double-check)
  const existingResult = await LiveAuctionResult.findByAuctionId(auctionId);
  if (existingResult) {
    console.log(`[FINALIZE] Result already exists for auctionId=${auctionId}, skipping processing.`);
    // Always update status to closed, even if result exists
    await LiveAuction.updateAuction(auctionId, { status: 'closed' });
    return;
  }
  
  console.log(`[FINALIZE] Proceeding with auction finalization for auctionId=${auctionId}`);
  
  // Get all bids
  const bids = await LiveAuctionBid.findByAuctionId(auctionId);
  if (!bids.length) {
    // No bids placed
    console.log(`[FINALIZE] No bids found for auctionId=${auctionId}, creating no_bids result.`);
    await LiveAuction.updateAuction(auctionId, { status: 'closed', current_highest_bidder_id: null });
    const result = await LiveAuctionResult.create({
      auctionId,
      winnerId: null,
      finalBid: null,
      reserveMet: false,
      status: 'no_bids'
    });
    if (!result) {
      console.log(`[FINALIZE] Duplicate result creation prevented for auctionId=${auctionId} (no_bids)`);
    }
    return;
  }
  
  // Find highest bid - sort by amount descending, then by time ascending (earliest wins in tie)
  const sortedBids = bids.sort((a, b) => {
    if (a.amount !== b.amount) {
      return b.amount - a.amount; // Highest amount first
    }
    return new Date(a.created_at) - new Date(b.created_at); // Earliest time first (wins in tie)
  });
  const highestBid = sortedBids[0];
  
  console.log(`[LIVE AUCTION ${auctionId}] Winner selection:`, {
    totalBids: bids.length,
    highestBid: {
      user_id: highestBid.user_id,
      amount: highestBid.amount,
      created_at: highestBid.created_at
    },
    reservePrice: auction.reserve_price,
    reserveMet: !auction.reserve_price || Number(highestBid.amount) >= Number(auction.reserve_price)
  });

  // Check reserve price
  if (auction.reserve_price && Number(highestBid.amount) < Number(auction.reserve_price)) {
    console.log(`[FINALIZE] Reserve price not met for auctionId=${auctionId}, creating reserve_not_met result.`);
    await LiveAuction.updateAuction(auctionId, { status: 'closed', current_highest_bidder_id: null });
    const result = await LiveAuctionResult.create({
      auctionId,
      winnerId: null,
      finalBid: highestBid.amount,
      reserveMet: false,
      status: 'reserve_not_met'
    });
    if (!result) {
      console.log(`[FINALIZE] Duplicate result creation prevented for auctionId=${auctionId} (reserve_not_met)`);
    }
    return;
  }
  // Set winner
  console.log(`[FINALIZE] Creating winning result for auctionId=${auctionId}, winner=${highestBid.user_id}`);
  await LiveAuction.updateAuction(auctionId, { status: 'closed', current_highest_bidder_id: highestBid.user_id });
  const result = await LiveAuctionResult.create({
    auctionId,
    winnerId: highestBid.user_id,
    finalBid: highestBid.amount,
    reserveMet: true,
    status: 'won'
  });
  if (!result) {
    console.log(`[FINALIZE] Duplicate result creation prevented for auctionId=${auctionId} (won)`);
    return; // Don't process wallet operations if result creation was prevented
  }
  // --- WALLET BLOCK/FUND LOGIC ---
  // 1. Release wallet blocks for all non-winning bidders
  for (const bid of bids) {
    if (bid.user_id !== highestBid.user_id) {
      await Wallet.removeWalletBlock(bid.user_id, auctionId);
    }
  }
  // 2. For the winner, deduct the bid amount and remove block
  const winnerId = highestBid.user_id;
  let winnerBlock = await Wallet.getWalletBlock(winnerId, auctionId);
  if (!winnerBlock) {
    // If no block exists, create one for deduction
    await Wallet.createWalletBlock(winnerId, auctionId, highestBid.amount);
    winnerBlock = await Wallet.getWalletBlock(winnerId, auctionId);
  }
  if (winnerBlock) {
    await Wallet.removeWalletBlock(winnerId, auctionId);
    await Wallet.updateBalance(winnerId, -highestBid.amount);
    // Add wallet transaction for deduction
    const winnerWallet = await Wallet.getWalletByUserId(winnerId);
    await Transaction.createTransaction({
      walletId: winnerWallet.id,
      type: 'auction_payment',
      amount: -highestBid.amount,
      description: `Payment for winning live auction`, // No id number
      referenceId: auctionId,
      status: 'succeeded'
    });
  }
  // 3. Distribute funds
  // Seller gets (bid - 10% fee), admin gets 10% fee
  const platformFee = Math.round(highestBid.amount * 0.10 * 100) / 100;
  const sellerAmount = Math.round((highestBid.amount - platformFee) * 100) / 100;
  const sellerId = auction.seller_id;
  await Wallet.updateBalance(sellerId, sellerAmount);
  // Add wallet transaction for seller
  const sellerWallet = await Wallet.getWalletByUserId(sellerId);
  await Transaction.createTransaction({
    walletId: sellerWallet.id,
    type: 'auction_income',
    amount: sellerAmount,
    description: `Income from live auction`, // No id number
    referenceId: auctionId,
    status: 'succeeded'
    // Frontend: use trophy icon for this type
  });
  // Admin wallet
  const adminUser = await User.findByEmail('admin@justbet.com');
  if (adminUser) {
    await Wallet.updateBalance(adminUser.id, platformFee);
    // Add wallet transaction for admin
    const adminWallet = await Wallet.getWalletByUserId(adminUser.id);
    await Transaction.createTransaction({
      walletId: adminWallet.id,
      type: 'platform_fee',
      amount: platformFee,
      description: `Platform fee from live auction`,
      referenceId: auctionId,
      status: 'succeeded'
    });
  }
  // --- END WALLET BLOCK/FUND LOGIC ---
};

module.exports = LiveAuctionResult; 
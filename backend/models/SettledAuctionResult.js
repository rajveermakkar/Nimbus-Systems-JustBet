const { pool } = require('../db/init');

const SettledAuctionResult = {
  // Create a new auction result
  async create({ auctionId, winnerId, finalBid, reserveMet, status }) {
    const query = `
      INSERT INTO settled_auction_results (auction_id, winner_id, final_bid, reserve_met, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [auctionId, winnerId, finalBid, reserveMet, status]);
    return result.rows[0];
  },

  // Find result by auction ID
  async findByAuctionId(auctionId) {
    const result = await pool.query(
      'SELECT * FROM settled_auction_results WHERE auction_id = $1',
      [auctionId]
    );
    return result.rows[0];
  },

  // Get all results
  async findAll() {
    const result = await pool.query(
      'SELECT * FROM settled_auction_results ORDER BY created_at DESC'
    );
    return result.rows;
  },

  // Get results with user and auction details
  async findAllWithDetails() {
    const query = `
      SELECT 
        sar.*,
        u.first_name as winner_first_name,
        u.last_name as winner_last_name,
        u.email as winner_email,
        sa.title as auction_title,
        sa.starting_price,
        sa.reserve_price
      FROM settled_auction_results sar
      LEFT JOIN users u ON sar.winner_id = u.id
      LEFT JOIN settled_auctions sa ON sar.auction_id = sa.id
      ORDER BY sar.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // Finalize a settled auction (process winner, funds, etc.)
  async finalizeAuction(auctionId) {
    const SettledAuction = require('./SettledAuction');
    const Bid = require('./Bid');
    const Wallet = require('./Wallet');
    const User = require('./User');
    const Transaction = require('./Transaction');
    const { auctionCache } = require('../services/redisService');

    // Get the auction
    const auction = await SettledAuction.findById(auctionId);
    if (!auction || auction.status === 'closed') return;

    // Check if result already exists for this auction
    const existingResult = await this.findByAuctionId(auction.id);
    if (existingResult) {
      // Always update status to closed, even if result exists
      await SettledAuction.updateAuction(auction.id, { status: 'closed' });
      return;
    }

    // Get all bids for this auction
    const bids = await Bid.getByAuctionId(auction.id);
    if (!bids.length) {
      // No bids placed
      await SettledAuction.updateAuction(auction.id, {
        status: 'closed',
        current_highest_bidder_id: null
      });
      await SettledAuctionResult.create({
        auctionId: auction.id,
        winnerId: null,
        finalBid: null,
        reserveMet: false,
        status: 'no_bids'
      });
      await auctionCache.del(`auction:closed:${auction.id}:full`);
      return;
    }

    // Find highest bid
    const highestBid = bids.reduce((max, bid) => bid.amount > max.amount ? bid : max, bids[0]);

    // Check reserve price
    if (auction.reserve_price && highestBid.amount < auction.reserve_price) {
      await SettledAuction.updateAuction(auction.id, {
        status: 'closed',
        current_highest_bidder_id: null
      });
      await SettledAuctionResult.create({
        auctionId: auction.id,
        winnerId: null,
        finalBid: highestBid.amount,
        reserveMet: false,
        status: 'reserve_not_met'
      });
      await auctionCache.del(`auction:closed:${auction.id}:full`);
      return;
    }

    // Set winner
    await SettledAuction.updateAuction(auction.id, {
      status: 'closed',
      current_highest_bidder_id: highestBid.user_id
    });
    await SettledAuctionResult.create({
      auctionId: auction.id,
      winnerId: highestBid.user_id,
      finalBid: highestBid.amount,
      reserveMet: true,
      status: 'won'
    });

    // --- WALLET BLOCK/FUND LOGIC ---
    // 1. Release wallet blocks for all non-winning bidders
    for (const bid of bids) {
      if (bid.user_id !== highestBid.user_id) {
        await Wallet.removeWalletBlock(bid.user_id, auction.id);
      }
    }
    // 2. For the winner, deduct the bid amount and remove block
    const winnerId = highestBid.user_id;
    const winnerBlock = await Wallet.getWalletBlock(winnerId, auction.id);
    if (winnerBlock) {
      await Wallet.removeWalletBlock(winnerId, auction.id);
      await Wallet.updateBalance(winnerId, -highestBid.amount);
      // Add wallet transaction for deduction
      const winnerWallet = await Wallet.getWalletByUserId(winnerId);
      await Transaction.createTransaction({
        walletId: winnerWallet.id,
        type: 'auction_payment',
        amount: -highestBid.amount,
        description: `Payment for winning auction: ${auction.title}`, // No id or title
        referenceId: auction.id,
        status: 'succeeded'
      });
    }
    // 3. Distribute funds
    // Seller gets (bid - 5% fee), admin gets 5% fee
    const platformFee = Math.round(highestBid.amount * 0.05 * 100) / 100;
    const sellerAmount = Math.round((highestBid.amount - platformFee) * 100) / 100;
    const sellerId = auction.seller_id;
    await Wallet.updateBalance(sellerId, sellerAmount);
    // Add wallet transaction for seller
    const sellerWallet = await Wallet.getWalletByUserId(sellerId);
    await Transaction.createTransaction({
      walletId: sellerWallet.id,
      type: 'auction_income',
      amount: sellerAmount,
      description: `Income from auction: ${auction.title}`, // No id or title
      referenceId: auction.id,
      status: 'succeeded'
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
        description: `Platform fee from auction ${auction.id}`,
        referenceId: auction.id,
        status: 'succeeded'
      });
    }
    // --- END WALLET BLOCK/FUND LOGIC ---

    await auctionCache.del(`auction:closed:${auction.id}:full`);
    if (highestBid && highestBid.user_id) {
      await auctionCache.del(`user:winnings:${highestBid.user_id}`);
    }
  }
};

module.exports = SettledAuctionResult; 
const cron = require('node-cron');
const SettledAuction = require('../models/SettledAuction');
const Bid = require('../models/Bid');
const SettledAuctionResult = require('../models/SettledAuctionResult');
const { pool } = require('../db/init');
const { auctionCache } = require('./redisService');

// Store scheduled timeouts for auctions
const scheduledAuctions = new Map();

// Function to process a single auction
async function processAuction(auctionId) {
  try {
    // Get the auction
    const auction = await SettledAuction.findById(auctionId);
    if (!auction || auction.status === 'closed') {
      return; // Auction already processed or doesn't exist
    }

    // Check if result already exists for this auction (direct DB query for robustness)
    const existingResult = await pool.query('SELECT 1 FROM settled_auction_results WHERE auction_id = $1', [auction.id]);
    if (existingResult.rows.length > 0) {
      // Always update status to closed, even if result exists
      await SettledAuction.updateAuction(auction.id, { status: 'closed' });
      console.log(`Result already exists for auction ${auction.id}, status set to closed, skipping`);
      return;
    }

    // Get all bids for this auction
    const bids = await Bid.findByAuctionId(auction.id);
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
      console.log(`Auction ${auction.id} closed with no bids`);
      
      // Invalidate cache for this auction
      await auctionCache.del(`auction:closed:${auction.id}:full`);
      console.log(`🗑️ Invalidated cache for auction: ${auction.id}`);
      return;
    }

    // Find highest bid
    const highestBid = bids.reduce((max, bid) => bid.amount > max.amount ? bid : max, bids[0]);
    
    // Check reserve price
    if (auction.reserve_price && highestBid.amount < auction.reserve_price) {
      // Reserve not met
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
      console.log(`Auction ${auction.id} closed - reserve not met`);
      
      // Invalidate cache for this auction
      await auctionCache.del(`auction:closed:${auction.id}:full`);
      console.log(`🗑️ Invalidated cache for auction: ${auction.id}`);
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
    console.log(`Auction ${auction.id} closed - winner: ${highestBid.user_id}`);
    
    // Invalidate cache for this auction
    await auctionCache.del(`auction:closed:${auction.id}:full`);
    console.log(`🗑️ Invalidated cache for auction: ${auction.id}`);
    
    // Invalidate user winnings cache for the winner
    if (highestBid && highestBid.user_id) {
      await auctionCache.del(`user:winnings:${highestBid.user_id}`);
      console.log(`🗑️ Invalidated winnings cache for winner: ${highestBid.user_id}`);
    }
  } catch (err) {
    console.error(`Error processing auction ${auctionId}:`, err);
  }
}

// Function to schedule auction processing
function scheduleAuctionProcessing(auctionId, endTime) {
  // Clear existing timeout if any
  if (scheduledAuctions.has(auctionId)) {
    clearTimeout(scheduledAuctions.get(auctionId));
  }

  const now = new Date();
  const timeUntilEnd = new Date(endTime).getTime() - now.getTime();

  if (timeUntilEnd <= 0) {
    // Auction has already ended, process immediately
    processAuction(auctionId);
  } else {
    // Schedule processing for when auction ends
    const timeout = setTimeout(() => {
      processAuction(auctionId);
      scheduledAuctions.delete(auctionId);
    }, timeUntilEnd);
    
    scheduledAuctions.set(auctionId, timeout);
    console.log(`Scheduled auction ${auctionId} to end at ${new Date(endTime).toLocaleString()}`);
  }
}

// Initialize: Schedule all pending auctions
async function initializeScheduledAuctions() {
  try {
    const now = new Date();
    const result = await pool.query(
      `SELECT id, end_time FROM settled_auctions 
       WHERE end_time > $1 
       AND status != 'closed'`,
      [now]
    );

    console.log(`Scheduling ${result.rows.length} pending auctions...`);
    
    for (const auction of result.rows) {
      scheduleAuctionProcessing(auction.id, auction.end_time);
    }
  } catch (err) {
    console.error('Error initializing scheduled auctions:', err);
  }
}

// Fallback cron job that runs every 10 minutes to catch any missed auctions
cron.schedule('*/10 * * * *', async () => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const result = await pool.query(
      `SELECT id FROM settled_auctions 
       WHERE end_time <= $1 
       AND end_time >= $2 
       AND status != 'closed'`,
      [now, fiveMinutesAgo]
    );
    
    if (result.rows.length > 0) {
      console.log(`Fallback: Processing ${result.rows.length} missed auctions...`);
      for (const auction of result.rows) {
        processAuction(auction.id);
      }
    }
  } catch (err) {
    console.error('Error in fallback cron job:', err);
  }
});

// Initialize when the service starts
initializeScheduledAuctions();

// Export functions for external use
module.exports = {
  scheduleAuctionProcessing,
  processAuction,
  // Add function to manually process a specific auction (useful for testing or fixing missed auctions)
  async processSpecificAuction(auctionId) {
    console.log(`Manually processing auction ${auctionId}...`);
    await processAuction(auctionId);
  }
}; 
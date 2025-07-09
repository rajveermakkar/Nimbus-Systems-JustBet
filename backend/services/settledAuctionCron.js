const cron = require('node-cron');
const SettledAuction = require('../models/SettledAuction');
const Bid = require('../models/Bid');
const SettledAuctionResult = require('../models/SettledAuctionResult');
const { pool } = require('../db/init');
const { auctionCache } = require('./redisService');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Store scheduled timeouts for auctions
const scheduledAuctions = new Map();

// Function to process a single auction
async function processAuction(auctionId) {
  try {
    await SettledAuctionResult.finalizeAuction(auctionId);
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
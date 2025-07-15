const cron = require('node-cron');
const LiveAuction = require('../models/LiveAuction');
const LiveAuctionResult = require('../models/LiveAuctionResult');
const { pool } = require('../db/init');

// Store scheduled timeouts for auctions
const scheduledAuctions = new Map();

// Function to process a single live auction
async function processAuction(auctionId) {
  try {
    await LiveAuctionResult.finalizeAuction(auctionId);
  } catch (err) {
    console.error(`Error processing live auction ${auctionId}:`, err);
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
    console.log(`Scheduled live auction ${auctionId} to end at ${new Date(endTime).toLocaleString()}`);
  }
}

// Cancel scheduled auction processing for a given auctionId
function cancelAuctionProcessing(auctionId) {
  if (scheduledAuctions.has(auctionId)) {
    clearTimeout(scheduledAuctions.get(auctionId));
    scheduledAuctions.delete(auctionId);
    console.log(`Cancelled scheduled processing for live auction ${auctionId}`);
  }
}

// Initialize: Schedule all approved live auctions
async function initializeScheduledAuctions() {
  try {
    const now = new Date();
    const result = await pool.query(
      `SELECT id, end_time FROM live_auctions 
       WHERE end_time > $1 
       AND status = 'approved'`,
      [now]
    );

    console.log(`Scheduling ${result.rows.length} approved live auctions...`);
    
    for (const auction of result.rows) {
      scheduleAuctionProcessing(auction.id, auction.end_time);
    }
  } catch (err) {
    console.error('Error initializing scheduled live auctions:', err);
  }
}

// Fallback cron job that runs every 10 minutes to catch any missed live auctions
cron.schedule('*/10 * * * *', async () => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const result = await pool.query(
      `SELECT id FROM live_auctions 
       WHERE end_time <= $1 
       AND end_time >= $2 
       AND status = 'approved'`,
      [now, fiveMinutesAgo]
    );
    
    if (result.rows.length > 0) {
      console.log(`Fallback: Processing ${result.rows.length} missed approved live auctions...`);
      for (const auction of result.rows) {
        processAuction(auction.id);
      }
    }
  } catch (err) {
    console.error('Error in fallback cron job for live auctions:', err);
  }
});

// Initialize when the service starts
initializeScheduledAuctions();

// Export functions for external use
module.exports = {
  scheduleAuctionProcessing,
  processAuction,
  cancelAuctionProcessing,
  // Add function to manually process a specific auction (useful for testing or fixing missed auctions)
  async processSpecificAuction(auctionId) {
    console.log(`Manually processing live auction ${auctionId}...`);
    await processAuction(auctionId);
  }
}; 
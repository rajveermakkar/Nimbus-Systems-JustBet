const SettledAuction = require('../models/SettledAuction');
const { pool } = require('../db/init');
const multer = require('multer');
const { uploadImageToAzure } = require('../services/azureBlobService');
const Bid = require('../models/Bid');
const { getAuctionCountdown, getAuctionType } = require('../utils/auctionUtils');
const LiveAuction = require('../models/LiveAuction');
const settledAuctionCron = require('../services/settledAuctionCron');
const { auctionCache } = require('../services/redisService');
const Wallet = require('../models/Wallet');

// function for a seller create a new auction listing
async function createAuction(req, res) {
  try {
    const user = req.user;
    // Only sellers can create auctions
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create auctions.' });
    }
    const { title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, minBidIncrement } = req.body;

    // Validate required fields are present and not blank
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required.' });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start and end time are required.' });
    }
    if (!startingPrice || isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) {
      return res.status(400).json({ error: 'Starting price must be a positive number.' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to start of today
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for start or end date.' });
    }
    if (start < now) {
      return res.status(400).json({ error: 'Start date must be today or in the future.' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after the start date.' });
    }
    if (end < new Date()) {
      return res.status(400).json({ error: 'End date must be in the future.' });
    }

    let reserve = reservePrice;
    if (reserve !== undefined && reserve !== null && reserve !== '') {
      if (isNaN(Number(reserve)) || Number(reserve) < 0) {
        return res.status(400).json({ error: 'Reserve price must be a non-negative number.' });
      }
    } else {
      reserve = null;
    }

    // Create the auction in the database
    const auction = await SettledAuction.create({
      sellerId: user.id,
      title: title.trim(),
      description: description ? description.trim() : '',
      imageUrl: imageUrl ? imageUrl.trim() : null,
      startTime: start,
      endTime: end,
      startingPrice: Number(startingPrice),
      reservePrice: reserve !== null ? Number(reserve) : null,
      minBidIncrement: minBidIncrement !== undefined ? minBidIncrement : 5
    });
    
    // Schedule the auction for processing when it ends
    settledAuctionCron.scheduleAuctionProcessing(auction.id, end);
    
    res.status(201).json({ auction });
  } catch (error) {
    console.error('Error creating auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// List all pending auctions (admin only)
async function listPendingAuctions(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view pending auctions.' });
    }
    const auctions = await SettledAuction.findPending();
    res.json({ auctions });
  } catch (error) {
    console.error('Error fetching pending auctions:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Approve an auction (admin only)
async function approveAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve auctions.' });
    }
    const { id } = req.params;
    const auction = await SettledAuction.approveAuction(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    
    // Schedule the auction for processing when it ends
    settledAuctionCron.scheduleAuctionProcessing(id, auction.end_time);
    console.log(`Scheduled approved auction ${id} to end at ${new Date(auction.end_time).toLocaleString()}`);
    
    // Invalidate any existing cache for this auction
    await auctionCache.del(`auction:closed:${id}:full`);
    
    res.json({ auction });
  } catch (error) {
    console.error('Error approving auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Multer setup for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /api/auctions/upload-image
async function uploadAuctionImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const url = await uploadImageToAzure(req.file);
    res.json({ url });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Image upload failed' });
  }
}

// GET /api/auctions/approved - public endpoint to get all approved auctions
async function getAllApprovedAuctions(req, res) {
  try {
    // Get all approved auctions that haven't ended yet
    const now = new Date();
    const query = `
      SELECT * FROM settled_auctions 
      WHERE status = 'approved' 
      AND end_time > $1
      ORDER BY start_time ASC
    `;
    const result = await pool.query(query, [now]);
    const auctions = result.rows;
    
    // Get seller info for each auction separately
    const auctionsWithSellers = [];
    for (const auction of auctions) {
      // Get seller details for this auction
      const sellerQuery = 'SELECT first_name, last_name, email, business_name FROM users WHERE id = $1';
      const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
      const seller = sellerResult.rows[0];
      
      // Combine auction and seller data
      const auctionWithSeller = {
        ...auction,
        seller: seller ? {
          id: seller.id,
          first_name: seller.first_name,
          last_name: seller.last_name,
          email: seller.email,
          business_name: seller.business_name
        } : null,
        type: 'settled'
      };
      
      auctionsWithSellers.push(auctionWithSeller);
    }
    
    res.json({ auctions: auctionsWithSellers });
  } catch (error) {
    console.error('Error fetching approved auctions:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /api/auctions/:id - update auction
async function updateAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can update auctions.' });
    }
    const { id } = req.params;
    // Find auction and check ownership
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ error: 'You can only update your own auctions.' });
    }
    
    const fields = req.body;
    
    // If the auction was previously approved or rejected and is being updated, set status back to pending
    if (auction.status === 'approved' || auction.status === 'rejected') {
      fields.status = 'pending';
    }
    
    const updated = await SettledAuction.updateAuction(id, fields);
    if (!updated) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    
    // Reschedule auction if end time was changed
    if (fields.endTime && fields.endTime !== auction.end_time) {
      console.log(`Rescheduling auction ${id} due to end time change: ${auction.end_time} -> ${fields.endTime}`);
      settledAuctionCron.scheduleAuctionProcessing(id, fields.endTime);
    }
    
    const message = (auction.status === 'approved' || auction.status === 'rejected')
      ? 'Auction updated and set to pending for admin approval.' 
      : 'Auction updated.';
    
    // Invalidate cache for this auction
    await auctionCache.del(`auction:closed:${id}:full`);
      
    res.json({ auction: updated, message });
  } catch (error) {
    console.error('Error updating auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/seller/auctions - get all auctions for the current seller
async function getMyAuctions(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can view their own listings.' });
    }
    
    // Get all auctions for the seller (including closed ones for winner info)
    const query = 'SELECT * FROM settled_auctions WHERE seller_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [user.id]);
    
    // Add winner information for closed auctions
    const auctionsWithWinners = [];
    for (const auction of result.rows) {
      let winner = null;
      if (auction.status === 'closed' && auction.current_highest_bidder_id) {
        const winnerQuery = 'SELECT first_name, last_name FROM users WHERE id = $1';
        const winnerResult = await pool.query(winnerQuery, [auction.current_highest_bidder_id]);
        if (winnerResult.rows[0]) {
          winner = {
            id: auction.current_highest_bidder_id,
            first_name: winnerResult.rows[0].first_name,
            last_name: winnerResult.rows[0].last_name
          };
        }
      }
      
      auctionsWithWinners.push({
        ...auction,
        winner
      });
    }
    
    res.json({ auctions: auctionsWithWinners });
  } catch (error) {
    console.error('Error fetching seller auctions:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Place a bid on a settled auction
async function placeBid(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { amount } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid auction ID format.' });
    }

    // Validate bid amount
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid bid amount is required.' });
    }

    const bidAmount = Number(amount);

    // Get auction details
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }

    // Check if auction is approved and active
    if (auction.status !== 'approved') {
      return res.status(400).json({ error: 'Auction is not open for bidding.' });
    }

    // Check if auction has ended
    const now = new Date();
    const endTime = new Date(auction.end_time);
    if (now > endTime) {
      return res.status(400).json({ error: 'Auction has ended.' });
    }

    // Check if auction has started
    const startTime = new Date(auction.start_time);
    if (now < startTime) {
      return res.status(400).json({ error: 'Auction has not started yet.' });
    }

    // Determine minimum bid amount
    const currentBid = auction.current_highest_bid || auction.starting_price;
    const minIncrement = auction.min_bid_increment || 1;
    const minBidAmount = Number(currentBid) + Number(minIncrement);

    if (bidAmount < minBidAmount) {
      return res.status(400).json({ 
        error: `Bid must be at least $${minBidAmount.toFixed(2)}` 
      });
    }

    // --- WALLET CHECK AND SOFT-BLOCK ---
    const wallet = await Wallet.getWalletByUserId(user.id);
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet not found.' });
    }
    const totalBlocked = await Wallet.getTotalBlockedAmount(user.id);
    const available = Number(wallet.balance) - totalBlocked;
    if (available < bidAmount) {
      return res.status(400).json({ error: 'Insufficient available wallet balance for this bid.' });
    }
    // Check if user already has a block for this auction (shouldn't happen, but just in case)
    const existingBlock = await Wallet.getWalletBlock(user.id, id);
    if (!existingBlock) {
      await Wallet.createWalletBlock(user.id, id, bidAmount);
    } else {
      // Update block amount if needed (not strictly necessary for first version)
    }
    // --- END WALLET CHECK ---

    // Store the bid
    const bid = await Bid.create(id, user.id, bidAmount);

    // Remove previous highest bidder's wallet block (if any and not the current user)
    const previousHighestBidderId = auction.current_highest_bidder_id;
    if (previousHighestBidderId && previousHighestBidderId !== user.id) {
      await Wallet.removeWalletBlock(previousHighestBidderId, id);
    }

    // Update auction with new highest bid
    const updatedAuction = await SettledAuction.updateAuction(id, {
      current_highest_bid: bidAmount,
      current_highest_bidder_id: user.id,
      bid_count: (auction.bid_count || 0) + 1
    });

    res.json({
      message: 'Bid placed successfully',
      bid,
      auction: updatedAuction
    });
    
    // Invalidate user bid history cache for the bidder
    await auctionCache.del(`user:bidhistory:${user.id}`);
    console.log('🗑️ Invalidated bid history cache for user:', user.id);

  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get all bids for a settled auction
async function getBids(req, res) {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid auction ID format.' });
    }

    // Check if auction exists
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }

    // Get bids with bidder details
    const bids = await Bid.getWithBidder(id);
    res.json({ bids });

  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get auction with current bid information
async function getAuctionWithBids(req, res) {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid auction ID format.' });
    }

    // Check cache first for closed auctions
    const cacheKey = `auction:closed:${id}:full`;
    const cached = await auctionCache.get(cacheKey);
    if (cached) {
      console.log(`[REDIS] Closed auction ${id} - CACHE HIT`);
      return res.json(cached);
    }
    console.log(`[DB] Closed auction ${id} - CACHE MISS, fetching from DB`);

    // Get auction with seller details
    const auction = await SettledAuction.findByIdWithSeller(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }

    // Only allow viewing if auction is approved or closed
    if (auction.status !== 'approved' && auction.status !== 'closed') {
      return res.status(403).json({ error: 'This auction is not available.' });
    }

    // Get ALL bids with bidder details (expensive query)
    const bids = await Bid.getWithBidder(id);
    const recentBids = bids.slice(0, 10);

    // Get winner information for closed auctions
    let winner = null;
    if (auction.status === 'closed') {
      try {
        const resultQuery = `
          SELECT sar.*, u.first_name, u.last_name, u.email
          FROM settled_auction_results sar
          LEFT JOIN users u ON sar.winner_id = u.id
          WHERE sar.auction_id = $1
        `;
        const result = await pool.query(resultQuery, [id]);
        if (result.rows.length > 0) {
          const auctionResult = result.rows[0];
          if (auctionResult.winner_id) {
            winner = {
              id: auctionResult.winner_id,
              user_name: `${auctionResult.first_name} ${auctionResult.last_name}`,
              email: auctionResult.email,
              amount: auctionResult.winning_amount,
              time: auctionResult.created_at
            };
          }
        }
      } catch (error) {
        console.error('Error fetching winner info:', error);
      }
    }

    // Ensure current_highest_bidder_id is present (fallback to highest bid user if missing)
    let auctionWithWinner = { ...auction };
    if (!auctionWithWinner.current_highest_bidder_id && bids.length > 0) {
      // Find the highest bid
      const highestBid = bids.reduce((max, bid) => bid.amount > max.amount ? bid : max, bids[0]);
      auctionWithWinner.current_highest_bidder_id = highestBid.user_id;
    }

    const response = {
      auction: auctionWithWinner,
      bids: recentBids,
      totalBids: bids.length,
      winner: winner
    };

    // Cache closed auctions for 5 minutes
    if (auction.status === 'closed') {
      await auctionCache.set(cacheKey, response, 300);
      console.log('💾 Cached closed auction:', id);
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching auction with bids:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getAuctionByIdForSeller(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const query = 'SELECT * FROM settled_auctions WHERE id = $1 AND seller_id = $2';
    const result = await pool.query(query, [id, user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    res.json({ auction: result.rows[0] });
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/auction/:type/:id/countdown
async function getAuctionCountdownAPI(req, res) {
  try {
    const { type, id } = req.params;
    let auction;
    if (type === 'live') {
      auction = await LiveAuction.findById(id);
    } else {
      auction = await SettledAuction.findById(id);
    }
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    const auctionType = getAuctionType(auction);
    const countdown = getAuctionCountdown(auction);
    res.json({
      auctionType,
      ...countdown
    });
  } catch (error) {
    console.error('Error getting auction countdown:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Manual trigger to process a specific auction (for testing/fixing missed auctions)
async function processSpecificAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manually process auctions.' });
    }
    const { id } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid auction ID format.' });
    }
    
    // Check if auction exists
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    
    // Process the auction
    await settledAuctionCron.processSpecificAuction(id);
    
    res.json({ message: `Auction ${id} processed successfully` });
  } catch (error) {
    console.error('Error manually processing auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// DELETE /api/seller/auctions/settled/:id - delete a settled auction (seller only)
async function deleteAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can delete auctions.' });
    }
    const { id } = req.params;
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ error: 'You can only delete your own auctions.' });
    }
    if (auction.status === 'closed') {
      return res.status(400).json({ error: 'Cannot delete a closed auction.' });
    }
    await SettledAuction.deleteById(id);
    res.json({ message: 'Auction deleted successfully.' });
  } catch (error) {
    console.error('Error deleting auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  createAuction,
  listPendingAuctions,
  approveAuction,
  getAllApprovedAuctions,
  updateAuction,
  getMyAuctions,
  placeBid,
  getBids,
  getAuctionWithBids,
  getAuctionByIdForSeller,
  getAuctionCountdownAPI,
  processSpecificAuction,
  deleteAuction
};

module.exports.upload = upload.single('image');
module.exports.uploadAuctionImage = uploadAuctionImage; 
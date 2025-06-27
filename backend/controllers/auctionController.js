const SettledAuction = require('../models/SettledAuction');
const { pool } = require('../db/init');
const multer = require('multer');
const { uploadImageToAzure } = require('../services/azureBlobService');
const Bid = require('../models/Bid');
const { getAuctionCountdown, getAuctionType } = require('../utils/auctionUtils');
const LiveAuction = require('../models/LiveAuction');
const settledAuctionCron = require('../services/settledAuctionCron');

// function for a seller create a new auction listing
async function createAuction(req, res) {
  try {
    const user = req.user;
    // Only sellers can create auctions
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can create auctions.' });
    }
    const { title, description, imageUrl, startTime, endTime, startingPrice, reservePrice } = req.body;

    // Validate required fields are present and not blank
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ message: 'Title is required.' });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start and end time are required.' });
    }
    if (!startingPrice || isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) {
      return res.status(400).json({ message: 'Starting price must be a positive number.' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to start of today
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for start or end date.' });
    }
    if (start < now) {
      return res.status(400).json({ message: 'Start date must be today or in the future.' });
    }
    if (end <= start) {
      return res.status(400).json({ message: 'End date must be after the start date.' });
    }
    if (end < new Date()) {
      return res.status(400).json({ message: 'End date must be in the future.' });
    }

    let reserve = reservePrice;
    if (reserve !== undefined && reserve !== null && reserve !== '') {
      if (isNaN(Number(reserve)) || Number(reserve) < 0) {
        return res.status(400).json({ message: 'Reserve price must be a non-negative number.' });
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
      reservePrice: reserve !== null ? Number(reserve) : null
    });
    
    // Schedule the auction for processing when it ends
    settledAuctionCron.scheduleAuctionProcessing(auction.id, end);
    
    res.status(201).json(auction);
  } catch (error) {
    console.error('Error creating auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// List all pending auctions (admin only)
async function listPendingAuctions(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view pending auctions.' });
    }
    const auctions = await SettledAuction.findPending();
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching pending auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Approve an auction (admin only)
async function approveAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can approve auctions.' });
    }
    const { id } = req.params;
    const auction = await SettledAuction.approveAuction(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }
    
    // Schedule the auction for processing when it ends
    settledAuctionCron.scheduleAuctionProcessing(id, auction.end_time);
    console.log(`Scheduled approved auction ${id} to end at ${new Date(auction.end_time).toLocaleString()}`);
    
    res.json(auction);
  } catch (error) {
    console.error('Error approving auction:', error);
    res.status(500).json({ message: 'Server error' });
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
        first_name: seller?.first_name,
        last_name: seller?.last_name,
        email: seller?.email,
        business_name: seller?.business_name
      };
      
      auctionsWithSellers.push(auctionWithSeller);
    }
    
    res.json(auctionsWithSellers);
  } catch (error) {
    console.error('Error fetching approved auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// PATCH /api/auctions/:id - update auction
async function updateAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can update auctions.' });
    }
    const { id } = req.params;
    // Find auction and check ownership
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ message: 'You can only update your own auctions.' });
    }
    // Only allow updates if not approved yet
    // if (auction.is_approved) {
    //   return res.status(400).json({ message: 'Cannot edit an approved auction.' });
    // }
    
    const fields = req.body;
    // If auction was approved, re-approval must be needed for editing
    const updated = await SettledAuction.updateAuction(id, fields, auction.is_approved);
    if (!updated) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }
    
    // Reschedule auction if end time was changed
    if (fields.endTime && fields.endTime !== auction.end_time) {
      console.log(`Rescheduling auction ${id} due to end time change: ${auction.end_time} -> ${fields.endTime}`);
      settledAuctionCron.scheduleAuctionProcessing(id, fields.endTime);
    }
    
    let msg = 'Auction updated.';
    if (auction.is_approved) {
      msg = 'Auction updated. Changes require admin re-approval.';
    }
    res.json({ auction: updated, message: msg });
  } catch (error) {
    console.error('Error updating auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/seller/auctions - get all auctions for the current seller
async function getMyAuctions(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can view their own listings.' });
    }
    // Only get auctions that are not closed
    const query = 'SELECT * FROM settled_auctions WHERE seller_id = $1 AND status != $2';
    const result = await pool.query(query, [user.id, 'closed']);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching seller auctions:', error);
    res.status(500).json({ message: 'Server error' });
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
      return res.status(400).json({ message: 'Invalid auction ID format.' });
    }

    // Validate bid amount
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid bid amount is required.' });
    }

    const bidAmount = Number(amount);

    // Get auction details
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }

    // Check if auction is approved and active
    if (!auction.is_approved || auction.status !== 'approved') {
      return res.status(400).json({ message: 'Auction is not open for bidding.' });
    }

    // Check if auction has ended
    const now = new Date();
    const endTime = new Date(auction.end_time);
    if (now > endTime) {
      return res.status(400).json({ message: 'Auction has ended.' });
    }

    // Check if auction has started
    const startTime = new Date(auction.start_time);
    if (now < startTime) {
      return res.status(400).json({ message: 'Auction has not started yet.' });
    }

    // Determine minimum bid amount
    const currentBid = auction.current_highest_bid || auction.starting_price;
    const minIncrement = auction.min_bid_increment || 1;
    const minBidAmount = currentBid + minIncrement;

    if (bidAmount < minBidAmount) {
      return res.status(400).json({ 
        message: `Bid must be at least $${minBidAmount.toFixed(2)}` 
      });
    }

    // Check reserve price if set
    if (auction.reserve_price && bidAmount < Number(auction.reserve_price)) {
      return res.status(400).json({ 
        message: `Bid must meet the reserve price of $${Number(auction.reserve_price).toFixed(2)}` 
      });
    }

    // Store the bid
    const bid = await Bid.create({
      auctionId: id,
      userId: user.id,
      amount: bidAmount
    });

    // Update auction with new highest bid
    const updatedAuction = await SettledAuction.updateAuction(id, {
      current_highest_bid: bidAmount,
      current_highest_bidder_id: user.id,
      bid_count: (auction.bid_count || 0) + 1
    });

    res.json({
      message: 'Bid placed successfully',
      bid: bid,
      auction: updatedAuction
    });

  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Get all bids for a settled auction
async function getBids(req, res) {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: 'Invalid auction ID format.' });
    }

    // Check if auction exists
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }

    // Get bids with bidder details
    const bids = await Bid.findByAuctionIdWithBidders(id);
    res.json(bids);

  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Get auction with current bid information
async function getAuctionWithBids(req, res) {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: 'Invalid auction ID format.' });
    }

    // Get auction with seller details
    const auction = await SettledAuction.findByIdWithSeller(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }

    // Only allow viewing if auction is approved or closed
    if (auction.status !== 'approved' && auction.status !== 'closed') {
      return res.status(403).json({ message: 'This auction is not available.' });
    }
    // Get recent bids with bidder details (last 10)
    const bids = await Bid.findByAuctionIdWithBidders(id);
    const recentBids = bids.slice(0, 10);
    // Ensure current_highest_bidder_id is present (fallback to highest bid user if missing)
    let auctionWithWinner = { ...auction };
    if (!auctionWithWinner.current_highest_bidder_id && bids.length > 0) {
      // Find the highest bid
      const highestBid = bids.reduce((max, bid) => bid.amount > max.amount ? bid : max, bids[0]);
      auctionWithWinner.current_highest_bidder_id = highestBid.user_id;
    }
    res.json({
      auction: auctionWithWinner,
      recentBids: recentBids,
      totalBids: bids.length
    });
  } catch (error) {
    console.error('Error fetching auction with bids:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getAuctionByIdForSeller(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const query = 'SELECT * FROM settled_auctions WHERE id = $1 AND seller_id = $2';
    const result = await pool.query(query, [id, user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ message: 'Server error' });
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
      return res.status(404).json({ message: 'Auction not found.' });
    }
    const auctionType = getAuctionType(auction);
    const countdown = getAuctionCountdown(auction);
    res.json({
      auctionType,
      ...countdown
    });
  } catch (error) {
    console.error('Error getting auction countdown:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Manual trigger to process a specific auction (for testing/fixing missed auctions)
async function processSpecificAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can manually process auctions.' });
    }
    const { id } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ message: 'Invalid auction ID format.' });
    }
    
    // Check if auction exists
    const auction = await SettledAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }
    
    // Process the auction
    await settledAuctionCron.processSpecificAuction(id);
    
    res.json({ message: `Auction ${id} processed successfully` });
  } catch (error) {
    console.error('Error manually processing auction:', error);
    res.status(500).json({ message: 'Server error' });
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
  processSpecificAuction
};

module.exports.upload = upload.single('image');
module.exports.uploadAuctionImage = uploadAuctionImage; 
const LiveAuction = require('../models/LiveAuction');
const { pool } = require('../db/init');
const multer = require('multer');
const { uploadImageToAzure } = require('../services/azureBlobService');
const Wallet = require('../models/Wallet');
const { scheduleAuctionProcessing, cancelAuctionProcessing } = require('../services/liveAuctionCron');
const { auctionCache } = require('../services/redisService');

// Create a new live auction
async function createLiveAuction(req, res) {
  try {
    const user = req.user;
    // Only sellers can create auctions
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create auctions.' });
    }
    
    // Ensure seller has a wallet (create if missing)
    let wallet = await Wallet.getWalletByUserId(user.id);
    if (!wallet) {
      try {
        console.log(`Creating wallet for seller ${user.id} during first live auction creation`);
        wallet = await Wallet.createWallet(user.id);
      } catch (walletErr) {
        console.error('Failed to create wallet for seller:', walletErr);
        return res.status(500).json({ error: 'Failed to create seller wallet. Please try again.' });
    }
    }
    
    const { title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, minBidIncrement, maxParticipants } = req.body;

    if (!title || !startTime || !endTime || !startingPrice || !maxParticipants) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) {
      return res.status(400).json({ error: 'Starting price must be a positive number.' });
    }
    if (isNaN(Number(maxParticipants)) || Number(maxParticipants) <= 0) {
      return res.status(400).json({ error: 'Max participants must be a positive number.' });
    }

    const auction = await LiveAuction.create({
      sellerId: user.id,
      title: title.trim(),
      description: description ? description.trim() : '',
      imageUrl: imageUrl ? imageUrl.trim() : null,
      startTime,
      endTime,
      startingPrice: Number(startingPrice),
      reservePrice: reservePrice !== undefined && reservePrice !== null && reservePrice !== '' ? Number(reservePrice) : null,
      maxParticipants: Number(maxParticipants),
      min_bid_increment: minBidIncrement !== undefined && minBidIncrement !== null && minBidIncrement !== '' ? Number(minBidIncrement) : 1,
      status: 'pending' // Default to pending for admin approval
    });
    // Do NOT schedule the auction here. Only schedule after admin approval.
    res.status(201).json({ auction });
  } catch (error) {
    console.error('Error creating live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get all approved live auctions (public only)
async function getLiveAuctionsByStatus(req, res) {
  try {
    const { status } = req.query;
    // Only allow public access to approved auctions
    if (!status || status === 'approved') {
      // Get all approved live auctions that haven't ended yet
      const now = new Date();
      const query = `
        SELECT * FROM live_auctions 
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
          type: 'live'
        };
        
        auctionsWithSellers.push(auctionWithSeller);
      }
      
      return res.json({ auctions: auctionsWithSellers });
    }
    // If status is not 'approved', do not allow (public endpoint)
    return res.status(403).json({ error: 'Forbidden: Only approved live auctions are public.' });
  } catch (error) {
    console.error('Error fetching live auctions:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get specific live auction by ID with seller information
async function getLiveAuctionById(req, res) {
  try {
    const { id } = req.params;
    
    // Get the live auction first
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    
    // Only allow access to approved auctions
    if (auction.status !== 'approved' && auction.status !== 'closed') {
      return res.status(403).json({ error: 'This live auction is not available.' });
    }
    
    // Get seller details separately
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
      type: 'live'
    };
    
    res.json({ auction: auctionWithSeller });
  } catch (error) {
    console.error('Error fetching live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Update a live auction
async function updateLiveAuction(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ error: 'You can only update your own live auctions.' });
    }
    // Prevent editing if auction is approved and start_time has passed
    if (auction.status === 'approved' && new Date(auction.start_time) <= new Date()) {
      return res.status(400).json({ error: 'Cannot edit a live auction that has already started.' });
    }
    
    const fields = req.body;
    
    // If the auction was previously approved or rejected and is being updated, set status back to pending
    if (auction.status === 'approved' || auction.status === 'rejected') {
      fields.status = 'pending';
      // Cancel any existing schedule for this auction
      cancelAuctionProcessing(id);
    }
    
    const updated = await LiveAuction.updateAuction(id, fields);
    if (!updated) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    
    const message = (auction.status === 'approved' || auction.status === 'rejected')
      ? 'Live auction updated and set to pending for admin approval.' 
      : 'Live auction updated.';
      
    res.json({ auction: updated, message });
  } catch (error) {
    console.error('Error updating live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Multer setup for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /api/seller/live-auction/upload-image
// Handles image upload for live auctions using Azure Blob Storage
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

// PATCH /api/live-auction/:id/approve - admin only
async function approveLiveAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve live auctions.' });
    }
    const { id } = req.params;
    const auction = await LiveAuction.updateAuction(id, { status: 'approved' });
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    // Schedule the auction for processing when it ends
    scheduleAuctionProcessing(id, auction.end_time);
    // Invalidate any existing cache for this auction (admin and public keys)
    await auctionCache.del(`admin:auctions:live`);
    await auctionCache.del(`live:auction:${id}:full`); // If you use a per-auction cache key, adjust as needed
    res.json({ auction, message: 'Live auction approved.' });
  } catch (error) {
    console.error('Error approving live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Admin: Get live auctions by status (pending, approved, etc.)
async function getAdminLiveAuctions(req, res) {
  try {
    const { status } = req.query;
    const auctions = await LiveAuction.findByStatus(status || 'pending');
    res.json({ auctions });
  } catch (error) {
    console.error('Error fetching admin live auctions:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Restart a live auction that didn't meet reserve price (seller only)
async function restartLiveAuction(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    
    // Check if user is the seller
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ error: 'You can only restart your own live auctions.' });
    }
    
    // Check if auction has a result and didn't meet reserve
    const LiveAuctionResult = require('../models/LiveAuctionResult');
    const result = await LiveAuctionResult.findByAuctionId(id);
    
    if (!result) {
      return res.status(400).json({ error: 'Auction has not ended yet.' });
    }
    
    if (result.status === 'won') {
      return res.status(400).json({ error: 'Cannot restart an auction that already has a winner.' });
    }
    
    // Reset auction status to approved (ready for bidding)
    const updated = await LiveAuction.updateAuction(id, { status: 'approved' });
    
    res.json({ 
      auction: updated, 
      message: 'Live auction restarted successfully. Bidding is now open again.' 
    });
  } catch (error) {
    console.error('Error restarting live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get bid history for a live auction
async function getLiveAuctionBids(req, res) {
  try {
    const { id } = req.params;
    
    // Check if auction exists and is approved
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    
    if (auction.status !== 'approved' && auction.status !== 'closed') {
      return res.status(403).json({ error: 'This live auction is not available.' });
    }
    
    // Get bid history with user names
    const bidsQuery = `
      SELECT 
        lb.id,
        lb.amount,
        lb.created_at,
        u.first_name,
        u.last_name,
        u.email,
        u.id as user_id
      FROM live_auction_bids lb
      JOIN users u ON lb.user_id = u.id
      WHERE lb.auction_id = $1
      ORDER BY lb.created_at DESC
      LIMIT 50
    `;
    
    const bidsResult = await pool.query(bidsQuery, [id]);
    
    // Format bids with user names and all fields needed by frontend
    const bids = bidsResult.rows.map(bid => ({
      id: bid.id,
      amount: bid.amount,
      created_at: bid.created_at,
      first_name: bid.first_name,
      last_name: bid.last_name,
      email: bid.email,
      user_name: `${bid.first_name} ${bid.last_name}`,
      user_id: bid.user_id // Use user_id, not email
    }));
    
    res.json({ bids });
  } catch (error) {
    console.error('Error fetching live auction bids:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get specific live auction by ID for the logged-in seller
async function getLiveAuctionByIdForSeller(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const auction = await LiveAuction.findById(id);
    if (!auction || auction.seller_id !== user.id) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    // Allow viewing even if closed
    res.json({ auction });
  } catch (error) {
    console.error('Error fetching live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get all live auctions for a specific seller (including closed ones for winner info)
async function getLiveAuctionsForSeller(req, res) {
  try {
    const user = req.user;
    // Get all auctions for the seller (including closed ones for winner info)
    const query = 'SELECT * FROM live_auctions WHERE seller_id = $1 ORDER BY created_at DESC';
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
    console.error('Error fetching seller live auctions:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// DELETE /api/seller/auctions/live/:id - delete a live auction (seller only)
async function deleteLiveAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can delete live auctions.' });
    }
    const { id } = req.params;
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ error: 'You can only delete your own live auctions.' });
    }
    if (auction.status === 'closed') {
      return res.status(400).json({ error: 'Cannot delete a closed auction.' });
    }
    await LiveAuction.deleteById(id);
    res.json({ message: 'Live auction deleted successfully.' });
  } catch (error) {
    console.error('Error deleting live auction:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Add this function for live auction bid placement (if not present, create it)
async function placeLiveBid(req, res) {
  try {
    const user = req.user;
    const { id } = req.params; // auction id
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
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Live auction not found.' });
    }
    // Prevent seller from bidding on their own auction
    if (auction.seller_id === user.id) {
      return res.status(400).json({ error: 'Sellers cannot bid on their own listings.' });
    }
    if (auction.status !== 'approved') {
      return res.status(400).json({ error: 'Auction is not open for bidding.' });
    }
    const now = new Date();
    const endTime = new Date(auction.end_time);
    if (now > endTime) {
      return res.status(400).json({ error: 'Auction has ended.' });
    }
    const startTime = new Date(auction.start_time);
    if (now < startTime) {
      return res.status(400).json({ error: 'Auction has not started yet.' });
    }
    // Determine minimum bid amount
    const currentBid = auction.current_highest_bid || auction.starting_price;
    const minIncrement = auction.min_bid_increment || 1;
    const minBidAmount = Number(currentBid) + Number(minIncrement);
    if (bidAmount < minBidAmount) {
      return res.status(400).json({ error: `Bid must be at least $${minBidAmount.toFixed(2)}` });
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
    // Check if user already has a block for this auction
    const existingBlock = await Wallet.getWalletBlock(user.id, id);
    if (!existingBlock) {
      await Wallet.createWalletBlock(user.id, id, bidAmount);
    } else {
      // Update block amount if needed (not strictly necessary for first version)
    }
    // --- END WALLET CHECK ---

    // Remove previous highest bidder's wallet block (if any and not the current user)
    const previousHighestBidderId = auction.current_highest_bidder_id;
    if (previousHighestBidderId && previousHighestBidderId !== user.id) {
      await Wallet.removeWalletBlock(previousHighestBidderId, id);
    }

    // Store the bid
    const LiveAuctionBid = require('../models/LiveAuctionBid');
    const bid = await LiveAuctionBid.create({
      auctionId: id,
      userId: user.id,
      amount: bidAmount
    });
    // Update auction with new highest bid
    await LiveAuction.updateAuction(id, {
      current_highest_bid: bidAmount,
      current_highest_bidder_id: user.id,
      bid_count: (auction.bid_count || 0) + 1
    });
    res.json({
      message: 'Bid placed successfully',
      bid
    });
  } catch (error) {
    console.error('Error placing live auction bid:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  createLiveAuction,
  getLiveAuctionsByStatus,
  getLiveAuctionById,
  updateLiveAuction,
  upload: upload.single('image'),
  uploadAuctionImage,
  approveLiveAuction,
  getAdminLiveAuctions,
  restartLiveAuction,
  getLiveAuctionBids,
  getLiveAuctionByIdForSeller,
  getLiveAuctionsForSeller,
  deleteLiveAuction,
  placeLiveBid
}; 
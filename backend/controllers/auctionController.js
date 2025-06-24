const SettledAuction = require('../models/SettledAuction');
const { pool } = require('../db/init');
const multer = require('multer');
const { uploadImageToAzure } = require('../services/azureBlobService');

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
    const auctions = await SettledAuction.findByStatus('approved');
    res.json(auctions);
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
    const auctions = await SettledAuction.findBySeller(user.id);
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching seller auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createAuction,
  listPendingAuctions,
  approveAuction,
  getAllApprovedAuctions,
  updateAuction,
  getMyAuctions
};

module.exports.upload = upload.single('image');
module.exports.uploadAuctionImage = uploadAuctionImage; 
const LiveAuction = require('../models/LiveAuction');
const multer = require('multer');
const { uploadImageToAzure } = require('../services/azureBlobService');

// Create a new live auction
async function createLiveAuction(req, res) {
  try {
    const user = req.user;
    if (!user || user.role !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can create live auctions.' });
    }
    const { title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, maxParticipants } = req.body;

    if (!title || !startTime || !endTime || !startingPrice || !maxParticipants) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    if (isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) {
      return res.status(400).json({ message: 'Starting price must be a positive number.' });
    }
    if (isNaN(Number(maxParticipants)) || Number(maxParticipants) <= 0) {
      return res.status(400).json({ message: 'Max participants must be a positive number.' });
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
      maxParticipants: Number(maxParticipants)
    });
    res.status(201).json(auction);
  } catch (error) {
    console.error('Error creating live auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Get all approved live auctions (public only)
async function getLiveAuctionsByStatus(req, res) {
  try {
    const { status } = req.query;
    // Only allow public access to approved auctions
    if (!status || status === 'approved') {
      const auctions = await LiveAuction.findByStatus('approved');
      return res.json(auctions);
    }
    // If status is not 'approved', do not allow (public endpoint)
    return res.status(403).json({ message: 'Forbidden: Only approved live auctions are public.' });
  } catch (error) {
    console.error('Error fetching live auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Update a live auction
async function updateLiveAuction(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const auction = await LiveAuction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: 'Live auction not found.' });
    }
    if (auction.seller_id !== user.id) {
      return res.status(403).json({ message: 'You can only update your own live auctions.' });
    }
    const fields = req.body;
    const updated = await LiveAuction.updateAuction(id, fields);
    if (!updated) {
      return res.status(400).json({ message: 'No valid fields to update.' });
    }
    res.json({ auction: updated, message: 'Live auction updated.' });
  } catch (error) {
    console.error('Error updating live auction:', error);
    res.status(500).json({ message: 'Server error' });
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
      return res.status(403).json({ message: 'Only admins can approve live auctions.' });
    }
    const { id } = req.params;
    const auction = await LiveAuction.updateAuction(id, { status: 'approved' });
    if (!auction) {
      return res.status(404).json({ message: 'Live auction not found.' });
    }
    res.json({ auction, message: 'Live auction approved.' });
  } catch (error) {
    console.error('Error approving live auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Admin: Get live auctions by status (pending, approved, etc.)
async function getAdminLiveAuctions(req, res) {
  try {
    const { status } = req.query;
    const auctions = await LiveAuction.findByStatus(status || 'pending');
    res.json(auctions);
  } catch (error) {
    console.error('Error fetching admin live auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createLiveAuction,
  getLiveAuctionsByStatus,
  updateLiveAuction,
  upload: upload.single('image'),
  uploadAuctionImage,
  approveLiveAuction,
  getAdminLiveAuctions
}; 
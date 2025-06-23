const SettledAuction = require('../models/SettledAuction');
const { pool } = require('../db/init');

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
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for start or end time.' });
    }
    if (start >= end) {
      return res.status(400).json({ message: 'Start time must be before end time.' });
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
    // Respond with the created auction
    res.status(201).json(auction);
  } catch (error) {
    // Log and return server error
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
    // Approve the auction in the database
    const auction = await SettledAuction.approveAuction(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found.' });
    }
    res.json(auction);
  } catch (error) {
    // Log and return server error
    console.error('Error approving auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createAuction,
  listPendingAuctions,
  approveAuction
}; 
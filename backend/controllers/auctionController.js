const { pool } = require('../db/init');
const Auction = require('../models/Auction');

// GET /api/auctions
exports.getAllAuctions = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM auctions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/auctions/:id/countdown
exports.getAuctionCountdown = async (req, res) => {
  const { id } = req.params;
  const auction = await Auction.findById(id);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const now = new Date();
  const start = new Date(auction.start_time);
  const end = new Date(auction.end_time);

  let status, timeRemaining;

  if (now < start) {
    status = 'pre-auction';
    timeRemaining = Math.floor((start - now) / 1000); // seconds
  } else if (now >= start && now < end) {
    status = 'active';
    timeRemaining = Math.floor((end - now) / 1000); // seconds
  } else {
    status = 'ended';
    timeRemaining = 0;
  }

  res.json({
    status,
    timeRemaining,
    startTime: auction.start_time,
    endTime: auction.end_time
  });
}; 
// In-memory state manager for live auctions
// Stores: current highest bid, bidder, timer, last 15-20 bids, auction status

const auctions = new Map(); // auctionId -> { currentBid, currentBidder, bids: [], status, timer }
const LiveAuctionResult = require('../models/LiveAuctionResult');

function initAuction(auctionId, startingPrice, reservePrice, minIncrement = 1, startTime) {
  auctions.set(auctionId, {
    currentBid: startingPrice,
    currentBidder: null,
    reservePrice: reservePrice,
    minIncrement: minIncrement,
    bids: [],
    status: 'open',
    timer: null,
    timerEnd: null,
    startTime: startTime
  });
}

function getAuction(auctionId) {
  return auctions.get(auctionId);
}

function updateAuction(auctionId, data) {
  if (!auctions.has(auctionId)) return;
  Object.assign(auctions.get(auctionId), data);
}

function addBid(auctionId, bid) {
  const auction = auctions.get(auctionId);
  if (!auction) return;
  auction.bids.push(bid);
  // Keep only last 20 bids
  if (auction.bids.length > 20) auction.bids.shift();
}

// Remove manual close: closeAuction should do nothing
function closeAuction(auctionId) {
  // Manual close is disabled. Auctions can only be closed by timer.
  // This function is intentionally left blank.
  // If needed, you can throw an error here.
  // throw new Error('Manual close is disabled.');
}

function removeAuction(auctionId) {
  auctions.delete(auctionId);
}

function setTimer(auctionId, duration, onEnd) {
  const auction = auctions.get(auctionId);
  if (!auction) return;
  if (auction.timer) clearTimeout(auction.timer);
  auction.timerEnd = Date.now() + duration;
  auction.timer = setTimeout(() => {
    auction.status = 'closed';
    auction.timer = null;
    auction.timerEnd = null;
    // Settle the auction (funds, wallet blocks, etc.)
    LiveAuctionResult.finalizeAuction(auctionId);
    if (onEnd) onEnd();
  }, duration);
}

function clearTimer(auctionId) {
  const auction = auctions.get(auctionId);
  if (auction && auction.timer) {
    clearTimeout(auction.timer);
    auction.timer = null;
    auction.timerEnd = null;
  }
}

function getCurrentState(auctionId) {
  const auction = auctions.get(auctionId);
  if (!auction) return null;
  return {
    currentBid: auction.currentBid,
    currentBidder: auction.currentBidder,
    reservePrice: auction.reservePrice,
    minIncrement: auction.minIncrement,
    bids: auction.bids,
    status: auction.status,
    timerEnd: auction.timerEnd
  };
}

module.exports = {
  initAuction,
  getAuction,
  updateAuction,
  addBid,
  closeAuction,
  removeAuction,
  setTimer,
  clearTimer,
  getCurrentState
}; 
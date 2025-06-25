require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDatabase, testConnection } = require('./db/init');
const { verifyEmailService } = require('./services/emailService');
const authRoutes = require('./routes/auth');
const sellerRoutes = require('./routes/sellerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const liveAuctionRoutes = require('./routes/liveAuctionRoutes');
const auctionsRoutes = require('./routes/auctionsRoutes');
const http = require('http');
const { Server } = require('socket.io');
const LiveAuctionModel = require('./models/LiveAuction');
const { verifySocketToken } = require('./middleware/jwtauth');
const liveAuctionState = require('./services/liveAuctionState');
const LiveAuctionBid = require('./models/LiveAuctionBid');
const LiveAuctionResult = require('./models/LiveAuctionResult');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/live-auction', liveAuctionRoutes);
app.use('/api/auctions', auctionsRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to JustBet!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    console.log('Database: Connected');
    
    // Initialize database schema
    await initDatabase();
    console.log('Database: Initialized');
    
    // Test email service connection
    try {
      await verifyEmailService();
      console.log('Email Service: Connected');
    } catch (emailError) {
      console.log('Email Service: Not Available');
    }
    
    // Start the server
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      }
    });

    io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error: No token provided'));
      const user = await verifySocketToken(token);
      if (!user) return next(new Error('Authentication error: Invalid token'));
      socket.user = user;
      next();
    });

    // Placeholder for live auction socket logic
    io.on('connection', (socket) => {
      // User info is available as socket.user
      console.log('Socket connected:', socket.id, 'User:', socket.user?.id);

      // Join auction room
      socket.on('join_auction', async ({ auctionId }) => {
        // Fetch auction from DB
        const auction = await LiveAuctionModel.findById(auctionId);
        if (!auction || auction.status !== 'approved') {
          socket.emit('join_error', 'Auction not found or not approved.');
          return;
        }
        
        // Clear any existing in-memory state for restarted auctions
        const existingState = liveAuctionState.getAuction(auctionId);
        if (existingState && existingState.status === 'closed') {
          liveAuctionState.removeAuction(auctionId);
        }
        
        // Initialize in-memory state if not present
        let state = liveAuctionState.getAuction(auctionId);
        if (!state) {
          liveAuctionState.initAuction(
            auctionId,
            Number(auction.starting_price),
            auction.reserve_price !== null ? Number(auction.reserve_price) : null,
            1 // minIncrement, can be extended to be dynamic
          );
          state = liveAuctionState.getAuction(auctionId);
          // Start auction timer (from DB endTime or 30s if already started)
          const now = Date.now();
          const endTime = new Date(auction.end_time).getTime();
          if (endTime > now) {
            liveAuctionState.setTimer(auctionId, endTime - now, () => handleAuctionEnd(auctionId));
          } else {
            // Auction already ended
            liveAuctionState.closeAuction(auctionId);
          }
        }
        socket.join(auctionId);
        // Send current auction state to user
        socket.emit('auction_state', liveAuctionState.getCurrentState(auctionId));
        // Optionally, broadcast join to others
        socket.to(auctionId).emit('user_joined', { userId: socket.user.id });
      });

      // Place bid
      socket.on('place_bid', async ({ auctionId, amount }) => {
        const state = liveAuctionState.getAuction(auctionId);
        if (!state || state.status !== 'open') {
          socket.emit('bid_error', 'Auction not open for bidding.');
          return;
        }
        // Validate bid
        const bidAmount = Number(amount);
        if (isNaN(bidAmount) || bidAmount < state.currentBid + state.minIncrement) {
          socket.emit('bid_error', `Bid must be at least ${(state.currentBid + state.minIncrement).toFixed(2)}`);
          return;
        }
        // Accept bid (mock wallet check)
        const bid = {
          userId: socket.user.id,
          amount: bidAmount,
          time: Date.now()
        };
        state.currentBid = bidAmount;
        state.currentBidder = socket.user.id;
        liveAuctionState.addBid(auctionId, bid);
        // Persist only last 5 bids in DB
        try {
          const dbBids = await LiveAuctionBid.findByAuctionId(auctionId);
          if (dbBids.length >= 5) {
            await LiveAuctionBid.deleteOldestBid(auctionId);
          }
          await LiveAuctionBid.create({ auctionId, userId: socket.user.id, amount: bidAmount });
        } catch (err) {
          console.error('Error persisting live auction bid:', err);
        }
        // Reset timer to 30s
        liveAuctionState.setTimer(auctionId, 30000, () => handleAuctionEnd(auctionId));
        // Broadcast new bid to all users in room
        io.to(auctionId).emit('bid_update', {
          currentBid: state.currentBid,
          currentBidder: state.currentBidder,
          bids: state.bids,
          timerEnd: state.timerEnd
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        // No special cleanup needed for now
      });

      // Auction end logic
      async function handleAuctionEnd(auctionId) {
        const state = liveAuctionState.getAuction(auctionId);
        if (!state) return;
        liveAuctionState.closeAuction(auctionId);
        
        // Determine winner and status
        let winner = null;
        let message = '';
        let status = 'no_winner';
        let reserveMet = false;
        
        if (state.reservePrice !== null && state.currentBid < state.reservePrice) {
          message = 'No winner matched the Reserved Price';
          status = 'reserve_not_met';
        } else if (state.currentBidder) {
          winner = state.currentBidder;
          message = 'Auction ended. Winner: ' + winner;
          status = 'won';
          reserveMet = true;
        } else {
          message = 'Auction ended. No bids placed.';
          status = 'no_bids';
        }
        
        // Save result to database
        try {
          await LiveAuctionResult.create({
            auctionId,
            winnerId: winner,
            finalBid: state.currentBid,
            reserveMet,
            status
          });
          console.log(`Auction result saved for auction ${auctionId}: ${status}`);
        } catch (err) {
          console.error('Error saving auction result:', err);
        }
        
        io.to(auctionId).emit('auction_end', {
          winner,
          finalBid: state.currentBid,
          message,
          status,
          reserveMet
        });
        
        // Remove in-memory state after short delay
        setTimeout(() => liveAuctionState.removeAuction(auctionId), 60000);
      }
    });

    httpServer.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start the server if we're not in a test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
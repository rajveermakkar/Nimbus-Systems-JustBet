require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDatabase, testConnection, pool } = require('./db/init');
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
        
        // Check if auction is already closed
        if (auction.status === 'closed') {
          socket.emit('join_error', 'This auction has already ended.');
          return;
        }
        
        // Check participant limit before joining
        const room = io.sockets.adapter.rooms.get(auctionId);
        const currentParticipantCount = room ? room.size : 0;
        
        if (currentParticipantCount >= auction.max_participants) {
          socket.emit('join_error', `Auction is at maximum capacity (${auction.max_participants} participants).`);
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
          // Use current highest bid from DB if available, otherwise use starting price
          const currentBid = auction.current_highest_bid || Number(auction.starting_price);
          
          liveAuctionState.initAuction(
            auctionId,
            currentBid,
            auction.reserve_price !== null ? Number(auction.reserve_price) : null,
            1 // minIncrement, can be extended to be dynamic
          );
          state = liveAuctionState.getAuction(auctionId);
          
          // Set the current bidder if there was a previous bid
          if (auction.current_highest_bidder_id) {
            state.currentBidder = auction.current_highest_bidder_id;
          }
          
          // Check if auction has passed its end time
          const now = Date.now();
          const endTime = new Date(auction.end_time).getTime();
          if (endTime <= now) {
            // Auction has passed its end time, close it
            liveAuctionState.closeAuction(auctionId);
          } else {
            // Auction is still within its time window, but no countdown timer until first bid
            // The auction will stay open until end_time or until countdown timer expires after bids
            state.endTime = endTime;
            
            // Set up a timer to check end time periodically
            const checkEndTime = () => {
              const currentTime = Date.now();
              if (currentTime >= endTime) {
                handleAuctionEnd(auctionId);
              } else {
                // Check again in 10 seconds
                setTimeout(checkEndTime, 10000);
              }
            };
            setTimeout(checkEndTime, 10000);
          }
        }
        
        socket.join(auctionId);
        
        // Get updated participant count after joining
        const updatedRoom = io.sockets.adapter.rooms.get(auctionId);
        const participantCount = updatedRoom ? updatedRoom.size : 1;
        
        // Get existing bid history from database
        let existingBids = [];
        try {
          const dbBids = await LiveAuctionBid.findByAuctionIdWithNames(auctionId);
          existingBids = dbBids;
        } catch (err) {
          console.error('Error fetching existing bids:', err);
        }
        
        // Send current auction state to user with existing bids
        const currentState = liveAuctionState.getCurrentState(auctionId);
        socket.emit('auction_state', {
          ...currentState,
          existingBids: existingBids
        });
        
        // Broadcast join to others with participant count
        socket.to(auctionId).emit('user_joined', { 
          userId: socket.user.id,
          participantCount: participantCount
        });
        
        // Send participant count to the joining user
        socket.emit('user_joined', { 
          userId: socket.user.id,
          participantCount: participantCount
        });
      });

      // Place bid
      socket.on('place_bid', async ({ auctionId, amount }) => {
        const state = liveAuctionState.getAuction(auctionId);
        if (!state || state.status !== 'open') {
          socket.emit('bid_error', 'Auction not open for bidding.');
          return;
        }
        
        // Check if auction has reached its end time
        const now = Date.now();
        if (state.endTime && now >= state.endTime) {
          socket.emit('bid_error', 'Auction has ended.');
          return;
        }
        
        // Validate bid
        const bidAmount = Number(amount);
        if (isNaN(bidAmount) || bidAmount < state.currentBid + state.minIncrement) {
          socket.emit('bid_error', `Bid must be at least ${(state.currentBid + state.minIncrement).toFixed(2)}`);
          return;
        }
        
        // Check if this is the first bid (no current bidder)
        const isFirstBid = !state.currentBidder;
        
        // Accept bid (mock wallet check)
        const bid = {
          userId: socket.user.id,
          amount: bidAmount,
          time: Date.now()
        };
        state.currentBid = bidAmount;
        state.currentBidder = socket.user.id;
        liveAuctionState.addBid(auctionId, bid);
        
        // Persist bid and update auction in DB
        try {
          // Save the bid
          const dbBids = await LiveAuctionBid.findByAuctionId(auctionId);
          if (dbBids.length >= 5) {
            await LiveAuctionBid.deleteOldestBid(auctionId);
          }
          await LiveAuctionBid.create({ auctionId, userId: socket.user.id, amount: bidAmount });
          
          // Update the live auction with current highest bid
          await LiveAuctionModel.updateAuction(auctionId, {
            current_highest_bid: bidAmount,
            current_highest_bidder_id: socket.user.id
          });
          
        } catch (err) {
          console.error('Error persisting live auction bid:', err);
        }
        
        // Start or reset countdown timer
        liveAuctionState.setTimer(auctionId, 120000, () => handleAuctionEnd(auctionId));
        
        // Get updated bid history with user names
        let updatedBids = [];
        try {
          updatedBids = await LiveAuctionBid.findByAuctionIdWithNames(auctionId);
        } catch (err) {
          console.error('Error fetching updated bids:', err);
        }
        
        // Broadcast new bid to all users in room
        io.to(auctionId).emit('bid_update', {
          currentBid: state.currentBid,
          currentBidder: state.currentBidder,
          bids: updatedBids,
          timerEnd: state.timerEnd
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        // Update participant count for all rooms this user was in
        socket.rooms.forEach((roomId) => {
          if (roomId !== socket.id) { // socket.id is also in rooms
            const room = io.sockets.adapter.rooms.get(roomId);
            // User is already removed from room, so just use current size
            const participantCount = room ? room.size : 0;
            console.log(`User left room ${roomId}, new count: ${participantCount}`);
            io.to(roomId).emit('user_joined', { 
              userId: socket.user?.id,
              participantCount: participantCount
            });
          }
        });
      });

      // Handle manual leave auction
      socket.on('leave_auction', ({ auctionId }) => {
        console.log('User manually leaving auction:', auctionId);
        socket.leave(auctionId);
        
        // Get updated participant count after leaving
        const room = io.sockets.adapter.rooms.get(auctionId);
        const participantCount = room ? room.size : 0;
        console.log(`User left room ${auctionId}, new count: ${participantCount}`);
        
        // Broadcast updated count to remaining users
        io.to(auctionId).emit('user_joined', { 
          userId: socket.user?.id,
          participantCount: participantCount
        });
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
          // Fetch winner's user details
          try {
            const winnerQuery = 'SELECT first_name, last_name, email FROM users WHERE id = $1';
            const winnerResult = await pool.query(winnerQuery, [state.currentBidder]);
            const winnerUser = winnerResult.rows[0];
            
            winner = {
              user_id: state.currentBidder,
              user_name: winnerUser ? `${winnerUser.first_name} ${winnerUser.last_name}` : 'Unknown User',
              amount: state.currentBid
            };
            message = 'Auction ended. Winner: ' + winner.user_name;
            status = 'won';
            reserveMet = true;
          } catch (err) {
            console.error('Error fetching winner details:', err);
            winner = {
              user_id: state.currentBidder,
              user_name: 'Unknown User',
              amount: state.currentBid
            };
            message = 'Auction ended. Winner: Unknown User';
            status = 'won';
            reserveMet = true;
          }
        } else {
          message = 'Auction ended. No bids placed.';
          status = 'no_bids';
        }
        
        // Save result to database
        try {
          await LiveAuctionResult.create({
            auctionId,
            winnerId: winner ? winner.user_id : null,
            finalBid: state.currentBid,
            reserveMet,
            status
          });
          
          // Update the live auction status to 'closed' in the database
          await LiveAuctionModel.updateAuction(auctionId, {
            status: 'closed'
          });
          
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
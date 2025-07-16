require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDatabase, testConnection, pool, queryWithRetry } = require('./db/init');
const { verifyEmailService } = require('./services/emailService');
const authRoutes = require('./routes/auth');
const sellerRoutes = require('./routes/sellerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const liveAuctionRoutes = require('./routes/liveAuctionRoutes');
const auctionsRoutes = require('./routes/auctionsRoutes');
const userProfileRouter = require('./routes/userProfile');
const http = require('http');
const { Server } = require('socket.io');
const LiveAuctionModel = require('./models/LiveAuction');
const { verifySocketToken } = require('./middleware/jwtauth');
const liveAuctionState = require('./services/liveAuctionState');
const LiveAuctionBid = require('./models/LiveAuctionBid');
const LiveAuctionResult = require('./models/LiveAuctionResult');
const ordersRouter = require('./routes/orders');
const walletRoutes = require('./routes/walletRoutes');
const bodyParser = require('body-parser');
const cookie = require('cookie'); // Add at the top if not present
const auctionEndLocks = new Set();
const os = require('os');

// Start settled auction cron job
if (process.env.NODE_ENV !== 'test') {
  require('./services/settledAuctionCron');
}

// Start account deletion cron job
require('./services/accountDeletionCron');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL|| 'http://localhost:5173',
  credentials: true 
}));
app.use(cookieParser());

// Stripe webhook needs raw body
app.use('/api/wallet/webhook', bodyParser.raw({ type: 'application/json' }));
// All other routes use JSON parser
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/live-auction', liveAuctionRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api/user', userProfileRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/wallet', walletRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to JustBet!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle database connection errors gracefully
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    console.error('Database connection error:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }
  
  // Handle other errors
  res.status(500).json({ error: 'Internal server error' });
});

// Add process error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
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
      // 1. Try to get token from auth field (preferred for frontend)
      let token = socket.handshake.auth?.token;

      // 2. If not present, try to get token from cookies (cookie name: 'token')
      if (!token && socket.handshake.headers?.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies['token'];
      }

      console.log('Socket handshake.auth:', socket.handshake.auth);
      console.log('Socket cookies:', socket.handshake.headers?.cookie);
      console.log('Token used for auth:', token);

      if (!token) {
        console.log('Socket auth failed: No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      const user = await verifySocketToken(token);
      if (!user) {
        console.log('Socket auth failed: Invalid token');
        return next(new Error('Authentication error: Invalid token'));
      }

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
        
        // Check if auction has passed its end time
        const now = Date.now();
        const endTime = new Date(auction.end_time).getTime();
        if (endTime <= now) {
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
          
          console.log('Initializing auction state:', {
            auctionId,
            auctionData: {
              current_highest_bid: auction.current_highest_bid,
              current_highest_bidder_id: auction.current_highest_bidder_id,
              starting_price: auction.starting_price,
              reserve_price: auction.reserve_price
            },
            calculatedCurrentBid: currentBid
          });
          
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
            console.log('Set current bidder from DB:', auction.current_highest_bidder_id);
          }
          
          // Load existing bids from database into memory
          try {
            const existingBids = await LiveAuctionBid.findByAuctionId(auctionId);
            if (existingBids.length > 0) {
              console.log('Loading existing bids into memory:', existingBids.length, 'bids');
              // Add the bids to the in-memory state
              existingBids.forEach(bid => {
                liveAuctionState.addBid(auctionId, {
                  userId: bid.user_id,
                  amount: bid.amount,
                  time: new Date(bid.created_at).getTime()
                });
              });
            }
          } catch (err) {
            console.error('Error loading existing bids:', err);
          }
          
          // Check if auction has passed its end time
          const now = Date.now();
          const endTime = new Date(auction.end_time).getTime();
          if (endTime <= now) {
            // Auction has passed its end time, close it
            liveAuctionState.closeAuction(auctionId);
            console.log(`Auction ${auctionId} has already ended, closing it`);
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
        console.log(`[BID] Received place_bid for auctionId=${auctionId}, userId=${socket.user.id}, amount=${amount}`);
        const state = liveAuctionState.getAuction(auctionId);
        if (!state || state.status !== 'open') {
          console.log(`[BID] Auction not open for bidding. auctionId=${auctionId}`);
          socket.emit('bid_error', 'Auction not open for bidding.');
          return;
        }
        // Double-check auction status in database
        try {
          const auctionCheck = await queryWithRetry(
            'SELECT * FROM live_auctions WHERE id = $1',
            [auctionId]
          );
          if (auctionCheck.rows.length === 0) {
            console.log(`[BID] Auction not found in DB. auctionId=${auctionId}`);
            socket.emit('bid_error', 'Auction not found.');
            return;
          }
          const auction = auctionCheck.rows[0];
          if (auction.status === 'closed') {
            console.log(`[BID] Auction is closed in DB. auctionId=${auctionId}`);
            socket.emit('bid_error', 'Auction has ended.');
            return;
          }
          // Check if auction has passed its end time
          const now = Date.now();
          const endTime = new Date(auction.end_time).getTime();
          if (endTime <= now) {
            console.log(`[BID] Auction has ended by time. auctionId=${auctionId}`);
            socket.emit('bid_error', 'Auction has ended.');
            return;
          }
        } catch (err) {
          console.error(`[BID] Error checking auction status:`, err);
          socket.emit('bid_error', 'Error checking auction status.');
          return;
        }
        // Prevent bidding before auction start time
        const now = Date.now();
        if (state.startTime && now < new Date(state.startTime).getTime()) {
          console.log(`[BID] Auction not started yet. auctionId=${auctionId}`);
          socket.emit('bid_error', 'Auction has not started yet.');
          return;
        }
        // Check if auction has reached its end time
        if (state.endTime && now >= state.endTime) {
          console.log(`[BID] Auction has ended by in-memory endTime. auctionId=${auctionId}`);
          socket.emit('bid_error', 'Auction has ended.');
          return;
        }
        // Validate bid
        const bidAmount = Number(amount);
        if (isNaN(bidAmount) || bidAmount < state.currentBid + state.minIncrement) {
          console.log(`[BID] Bid too low. auctionId=${auctionId}, userId=${socket.user.id}, amount=${amount}`);
          socket.emit('bid_error', `Bid must be at least ${(state.currentBid + state.minIncrement).toFixed(2)}`);
          return;
        }
        // --- WALLET CHECK AND SOFT-BLOCK ---
        try {
          const Wallet = require('./models/Wallet');
          const LiveAuctionBid = require('./models/LiveAuctionBid');
          // Get wallet
          const wallet = await Wallet.getWalletByUserId(socket.user.id);
          if (!wallet) {
            console.log(`[BID] Wallet not found. userId=${socket.user.id}`);
            socket.emit('bid_error', 'Wallet not found.');
            return;
          }
          const totalBlocked = await Wallet.getTotalBlockedAmount(socket.user.id);
          const available = Number(wallet.balance) - totalBlocked;
          if (available < bidAmount) {
            console.log(`[BID] Insufficient funds. userId=${socket.user.id}, available=${available}, bidAmount=${bidAmount}`);
            socket.emit('bid_error', 'Insufficient available wallet balance for this bid.');
            return;
          }
          // Check if user already has a block for this auction
          const existingBlock = await Wallet.getWalletBlock(socket.user.id, auctionId);
          if (!existingBlock) {
            await Wallet.createWalletBlock(socket.user.id, auctionId, bidAmount);
            console.log(`[BID] Created wallet block. userId=${socket.user.id}, auctionId=${auctionId}, amount=${bidAmount}`);
          }
          // Remove previous highest bidder's wallet block (if any and not the current user)
          const previousHighestBidderId = state.currentBidder;
          if (previousHighestBidderId && previousHighestBidderId !== socket.user.id) {
            await Wallet.removeWalletBlock(previousHighestBidderId, auctionId);
            console.log(`[BID] Removed previous highest bidder's block. userId=${previousHighestBidderId}, auctionId=${auctionId}`);
          }
          // Store the bid in DB
          console.log(`[BID] Inserting bid into DB. auctionId=${auctionId}, userId=${socket.user.id}, amount=${bidAmount}`);
          await LiveAuctionBid.create({ auctionId, userId: socket.user.id, amount: bidAmount });
          console.log(`[BID] Bid inserted into DB. auctionId=${auctionId}, userId=${socket.user.id}, amount=${bidAmount}`);
        } catch (err) {
          console.error(`[BID] Wallet/funds check or DB error:`, err);
          socket.emit('bid_error', 'Wallet/funds error: ' + (err.message || 'Unknown error'));
          return;
        }
        // Accept bid
        const bid = {
          userId: socket.user.id,
          amount: bidAmount,
          time: Date.now()
        };
        state.currentBid = bidAmount;
        state.currentBidder = socket.user.id;
        liveAuctionState.addBid(auctionId, bid);
        console.log(`[BID] Added bid to in-memory state. auctionId=${auctionId}, userId=${socket.user.id}, amount=${bidAmount}`);
        // Persist bid and update auction in DB
        try {
          const LiveAuctionModel = require('./models/LiveAuction');
          await LiveAuctionModel.updateAuction(auctionId, {
            current_highest_bid: bidAmount,
            current_highest_bidder_id: socket.user.id
          });
          console.log(`[BID] Updated auction in DB. auctionId=${auctionId}, userId=${socket.user.id}, amount=${bidAmount}`);
        } catch (err) {
          console.error(`[BID] Error updating auction in DB:`, err);
        }
        // Start or reset countdown timer
        liveAuctionState.setTimer(auctionId, 120000, () => handleAuctionEnd(auctionId)); // 2 minutes
        console.log(`[BID] Reset inactivity countdown timer for 2 minutes. auctionId=${auctionId}`);
        // Get updated bid history with user names
        let updatedBids = [];
        try {
          const LiveAuctionBid = require('./models/LiveAuctionBid');
          updatedBids = await LiveAuctionBid.findByAuctionIdWithNames(auctionId);
          console.log(`[BID] Loaded updated bid history for auctionId=${auctionId}, count=${updatedBids.length}`);
        } catch (err) {
          console.error(`[BID] Error fetching updated bids:`, err);
        }
        // Broadcast new bid to all users in room, always include user_name and user_id
        io.to(auctionId).emit('bid_update', {
          currentBid: state.currentBid,
          currentBidder: state.currentBidder,
          bids: updatedBids,
          timerEnd: state.timerEnd
        });
        console.log(`[BID] Broadcasted bid_update to room. auctionId=${auctionId}`);
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
        console.log(`[AUCTION END] Starting handleAuctionEnd for auctionId=${auctionId}`);
        
        // Check if auction is already closed in database FIRST
        try {
          const dbAuction = await LiveAuctionModel.findById(auctionId);
          if (dbAuction && dbAuction.status === 'closed') {
            console.log(`[AUCTION END] Auction ${auctionId} already closed in database, skipping.`);
            return;
          }
        } catch (err) {
          console.error(`[AUCTION END] Error checking auction status:`, err);
        }
        
        if (auctionEndLocks.has(auctionId)) {
          console.log(`[AUCTION END] handleAuctionEnd already running for auctionId=${auctionId}, skipping.`);
          return;
        }
        auctionEndLocks.add(auctionId);
        try {
          const state = liveAuctionState.getAuction(auctionId);
          if (!state) {
            console.log(`[AUCTION END] No in-memory state for auctionId=${auctionId}`);
            return;
          }
          
          // Check if result already exists in database
          const existingResult = await LiveAuctionResult.findByAuctionId(auctionId);
          if (existingResult) {
            console.log(`[AUCTION END] Result already exists for auctionId=${auctionId}, skipping processing.`);
            // Still update auction status to closed if needed
            await LiveAuctionModel.updateAuction(auctionId, { status: 'closed' });
            return;
          }
          
          console.log(`[AUCTION END] Closing auction in memory state. auctionId=${auctionId}`);
          liveAuctionState.closeAuction(auctionId);
          
          // Check what's actually in the database
          try {
            const dbCheck = await queryWithRetry(`
              SELECT 
                la.current_highest_bid,
                la.current_highest_bidder_id,
                la.starting_price,
                la.reserve_price,
                (SELECT COUNT(*) FROM live_auction_bids WHERE auction_id = $1) as bid_count,
                (SELECT MAX(amount) FROM live_auction_bids WHERE auction_id = $1) as max_bid_amount,
                (SELECT user_id FROM live_auction_bids WHERE auction_id = $1 ORDER BY amount DESC, created_at DESC LIMIT 1) as highest_bidder_from_bids
              FROM live_auctions la 
              WHERE la.id = $1
            `, [auctionId]);
            
            console.log('Database state at auction end:', {
              auctionId,
              dbState: dbCheck.rows[0],
              inMemoryState: {
                currentBid: state.currentBid,
                currentBidder: state.currentBidder,
                reservePrice: state.reservePrice,
                bids: state.bids
              }
            });
            
            // Use database state as the source of truth for winner determination
            const dbState = dbCheck.rows[0];
            const finalBid = dbState.current_highest_bid || state.currentBid;
            const finalBidder = dbState.current_highest_bidder_id || state.currentBidder;
            
            console.log('Using database state for winner determination:', {
              finalBid,
              finalBidder,
              reservePrice: dbState.reserve_price
            });
            
            // Determine winner and status
            let winner = null;
            let message = '';
            let status = 'no_winner';
            let reserveMet = false;
            
            if (dbState.reserve_price !== null && finalBid < dbState.reserve_price) {
              message = 'No winner matched the Reserved Price';
              status = 'reserve_not_met';
            } else if (finalBidder) {
              // Fetch winner's user details
              try {
                const winnerQuery = 'SELECT first_name, last_name, email FROM users WHERE id = $1';
                const winnerResult = await queryWithRetry(winnerQuery, [finalBidder]);
                const winnerUser = winnerResult.rows[0];
                
                console.log('Winner details from DB:', {
                  winnerId: finalBidder,
                  winnerUser: winnerUser
                });
                
                winner = {
                  user_id: finalBidder,
                  user_name: winnerUser ? `${winnerUser.first_name} ${winnerUser.last_name}` : 'Unknown User',
                  amount: finalBid
                };
                message = 'Auction ended. Winner: ' + winner.user_name;
                status = 'won';
                reserveMet = true;
              } catch (err) {
                console.error('Error fetching winner details:', err);
                winner = {
                  user_id: finalBidder,
                  user_name: 'Unknown User',
                  amount: finalBid
                };
                message = 'Auction ended. Winner: Unknown User';
                status = 'won';
                reserveMet = true;
              }
            } else {
              message = 'Auction ended. No bids were placed.';
              status = 'no_bids';
            }
            
            console.log('Final winner determination:', {
              winner,
              status,
              message,
              reserveMet
            });
            
            // Save result to database
            try {
              // Check if result already exists
              const existingResult = await queryWithRetry(
                'SELECT * FROM live_auction_results WHERE auction_id = $1',
                [auctionId]
              );
              
              if (existingResult.rows.length > 0) {
                console.log('WARNING: Result already exists for auction:', {
                  auctionId,
                  existingResult: existingResult.rows[0]
                });
                
                // Still send the auction_end event to connected clients
                const existingResultData = existingResult.rows[0];
                let winner = null;
                if (existingResultData.winner_id) {
                  try {
                    const winnerQuery = 'SELECT first_name, last_name, email FROM users WHERE id = $1';
                    const winnerResult = await queryWithRetry(winnerQuery, [existingResultData.winner_id]);
                    const winnerUser = winnerResult.rows[0];
                    winner = {
                      user_id: existingResultData.winner_id,
                      user_name: winnerUser ? `${winnerUser.first_name} ${winnerUser.last_name}` : 'Unknown User',
                      amount: existingResultData.final_bid
                    };
                  } catch (err) {
                    console.error('Error fetching winner details:', err);
                    winner = {
                      user_id: existingResultData.winner_id,
                      user_name: 'Unknown User',
                      amount: existingResultData.final_bid
                    };
                  }
                }
                
                io.to(auctionId).emit('auction_end', {
                  winner,
                  finalBid: existingResultData.final_bid,
                  message: existingResultData.status === 'won' ? 'Auction ended with winner' : 
                           existingResultData.status === 'reserve_not_met' ? 'Auction ended - Reserve price not met' :
                           existingResultData.status === 'no_bids' ? 'Auction ended - No bids were placed' : 'Auction ended',
                  status: existingResultData.status,
                  reserveMet: existingResultData.reserve_met
                });
                
                return; // Don't create duplicate results
              }
              
              await LiveAuctionResult.create({
                auctionId,
                winnerId: winner ? winner.user_id : null,
                finalBid: finalBid,
                reserveMet,
                status
              });
              
              console.log('Saved auction result to database:', {
                auctionId,
                winnerId: winner ? winner.user_id : null,
                finalBid: finalBid,
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
              finalBid: finalBid,
              message,
              status,
              reserveMet
            });
            
            // Remove in-memory state after short delay
            setTimeout(() => liveAuctionState.removeAuction(auctionId), 60000);
            
          } catch (err) {
            console.error('Error checking database state:', err);
            // Fallback to in-memory state if database check fails
            console.log('Falling back to in-memory state for winner determination');
            
            // Determine winner and status using in-memory state
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
                const winnerResult = await queryWithRetry(winnerQuery, [state.currentBidder]);
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
              message = 'Auction ended. No bids were placed.';
              status = 'no_bids';
            }
            
            // Save result to database
            try {
              // Check if result already exists
              const existingResult = await queryWithRetry(
                'SELECT * FROM live_auction_results WHERE auction_id = $1',
                [auctionId]
              );
              
              if (existingResult.rows.length > 0) {
                console.log('WARNING: Result already exists for auction:', {
                  auctionId,
                  existingResult: existingResult.rows[0]
                });
                
                // Still send the auction_end event to connected clients
                const existingResultData = existingResult.rows[0];
                let winner = null;
                if (existingResultData.winner_id) {
                  try {
                    const winnerQuery = 'SELECT first_name, last_name, email FROM users WHERE id = $1';
                    const winnerResult = await queryWithRetry(winnerQuery, [existingResultData.winner_id]);
                    const winnerUser = winnerResult.rows[0];
                    winner = {
                      user_id: existingResultData.winner_id,
                      user_name: winnerUser ? `${winnerUser.first_name} ${winnerUser.last_name}` : 'Unknown User',
                      amount: existingResultData.final_bid
                    };
                  } catch (err) {
                    console.error('Error fetching winner details:', err);
                    winner = {
                      user_id: existingResultData.winner_id,
                      user_name: 'Unknown User',
                      amount: existingResultData.final_bid
                    };
                  }
                }
                
                io.to(auctionId).emit('auction_end', {
                  winner,
                  finalBid: existingResultData.final_bid,
                  message: existingResultData.status === 'won' ? 'Auction ended with winner' : 
                           existingResultData.status === 'reserve_not_met' ? 'Auction ended - Reserve price not met' :
                           existingResultData.status === 'no_bids' ? 'Auction ended - No bids were placed' : 'Auction ended',
                  status: existingResultData.status,
                  reserveMet: existingResultData.reserve_met
                });
                
                return; // Don't create duplicate results
              }
              
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
        } finally {
          auctionEndLocks.delete(auctionId);
        }
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
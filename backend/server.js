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
const LiveAuction = require('./models/LiveAuction');

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
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      }
    });
    //Real time auction will be presented as event
    //so user will need a ticket to join and participate in auction
    //seler will determine how much participants can join and buy ticket

    // Simple Socket.IO connection and room join event
    // Track participants that have joined in memory
    const roomParticipants = {};
    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);
      // Join room with ticket and approval logic
      socket.on('joinRoom', async ({ roomId, userId, hasTicket }) => {
        // Ticket checking will be implemented later , 
        // after making wallet integration and checking with wallet, 
        // ticket will be bought and then user will join with real ticket
        if (!hasTicket) {
          socket.emit('joinError', 'You need a valid ticket to join this auction.');
          return;
        }
        const auction = await LiveAuction.findById(roomId);
        if (!auction || auction.status !== 'approved') {
          socket.emit('joinError', 'Auction is not approved or does not exist.');
          return;
        }
        roomParticipants[roomId] = roomParticipants[roomId] || new Set();
        if (roomParticipants[roomId].size >= auction.max_participants) {
          socket.emit('joinError', 'Auction room is full.');
          return;
        }
        // USer joining the aucton room
        socket.join(roomId);
        roomParticipants[roomId].add(userId);
        console.log(`User ${userId} joined room ${roomId}`);
        socket.emit('joinSuccess', 'Joined auction room successfully.');
        // Remove user from room on disconnect
        socket.on('disconnect', () => {
          if (roomParticipants[roomId]) {
            roomParticipants[roomId].delete(userId);
            if (roomParticipants[roomId].size === 0) {
              delete roomParticipants[roomId];
            }
          }
          console.log('User disconnected:', socket.id);
        });
      });
    });

    server.listen(port, () => {
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
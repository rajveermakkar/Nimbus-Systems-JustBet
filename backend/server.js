require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase, testConnection } = require('./db/init');
const authRoutes = require('./routes/auth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);

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
    // Test database connection first
    await testConnection();
    
    // Initialize database schema
    await initDatabase();
    
    // Start the server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
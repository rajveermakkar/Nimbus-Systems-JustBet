const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool, queryWithRetry } = require('../db/init');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const jwtauthMiddleware = require('../middleware/jwtauth');
const User = require('../models/User');
const userController = require('../controllers/userController');

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await queryWithRetry(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await queryWithRetry(
      `UPDATE users 
       SET verification_token = $1,
           verification_token_expires = $2
       WHERE email = $3`,
      [verificationToken, verificationExpires, email]
    );

    await sendVerificationEmail(email, verificationToken);

    res.json({ 
      message: 'Verification email sent successfully',
      email: user.email
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user
router.post('/register', userController.register);

// Verify email
router.get('/verify-email', userController.verifyEmail);

// Check user verification status
router.get('/user-status', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await queryWithRetry(
      'SELECT id, email, is_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('User status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', userController.login);

// Request password reset
router.post('/forgot-password', userController.forgotPassword);

// Reset password
router.post('/reset-password', userController.resetPassword);

// Get user profile
router.get('/profile', jwtauthMiddleware, userController.getProfile);

// Logout user
router.post('/logout', userController.logout);

// Refresh access token
router.post('/refresh-token', userController.refreshToken);

// Get user winnings (auctions they won)
router.get('/winnings', jwtauthMiddleware, userController.getWinnings);

// Get user bid history
router.get('/bid-history', jwtauthMiddleware, userController.getBidHistory);

// Get won auction details
router.get('/won-live-auction/:id', jwtauthMiddleware, userController.getWonLiveAuction);
router.get('/won-settled-auction/:id', jwtauthMiddleware, userController.getWonSettledAuction);

// Get won auction details (by type, from results table)
router.get('/won-auction/:type/:id', jwtauthMiddleware, userController.getWonAuction);

// Get settled auction result for winner announcement
router.get('/settled-auction-result/:id', jwtauthMiddleware, userController.getSettledAuctionResult);

// Get live auction result for winner announcement
router.get('/live-auction-result/:id', jwtauthMiddleware, userController.getLiveAuctionResult);

// Get user details by ID (for winner information)
router.get('/user/:id', jwtauthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await queryWithRetry(
      'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
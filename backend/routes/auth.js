const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/init');
const { sendVerificationEmail } = require('../services/emailService');

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Get user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await pool.query(
      `UPDATE users 
       SET verification_token = $1,
           verification_token_expires = $2
       WHERE email = $3`,
      [verificationToken, verificationExpires, email]
    );

    // Send new verification email
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

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  // Basic validation
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      const existingUser = emailCheck.rows[0];
      if (!existingUser.is_verified) {
        // If user exists but not verified, allow resending verification
        return res.status(400).json({ 
          error: 'Email already registered but not verified',
          isVerified: false,
          email: email,
          message: 'Please check your email for verification or request a new verification email'
        });
      }
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert new user with verification token
    const result = await pool.query(
      `INSERT INTO users (
        first_name, last_name, email, password, role,
        is_verified, verification_token, verification_token_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, first_name, last_name, email, role`,
      [
        firstName, 
        lastName, 
        email, 
        hashedPassword, 
        'user',
        false,
        verificationToken,
        verificationExpires
      ]
    );

    // Try to send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        user: result.rows[0],
        isVerified: false
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Still return success but with a different message
      res.status(201).json({
        message: 'Registration successful, but we could not send the verification email. Please contact support.',
        user: result.rows[0],
        verificationToken, // Include token in response for testing
        isVerified: false
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email endpoint
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    // Decode the token from URL
    const decodedToken = decodeURIComponent(token);
    
    // Verify token and update user
    const result = await pool.query(
      `UPDATE users 
       SET is_verified = true,
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE verification_token = $1 
       AND verification_token_expires > NOW()
       AND is_verified = false
       RETURNING id, email, is_verified`,
      [decodedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired verification token' 
      });
    }

    res.json({ 
      message: 'Email verified successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check user verification status
router.get('/user-status', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, is_verified FROM users WHERE email = $1',
      [email]
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

module.exports = router; 
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/init');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const jwtauthMiddleware = require('../middleware/jwtauth');

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query(
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

    await pool.query(
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

// Register user
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const emailCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (emailCheck.rows.length > 0) {
      const existingUser = emailCheck.rows[0];
      if (!existingUser.is_verified) {
        return res.status(400).json({ 
          error: 'Email already registered but not verified',
          isVerified: false,
          email: email,
          message: 'Please check your email for verification or request a new verification email'
        });
      }
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO users (
        first_name, last_name, email, password, role,
        is_verified, verification_token, verification_token_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, first_name, last_name, email, role`,
      [
        firstName, 
        lastName, 
        email.toLowerCase(), 
        hashedPassword, 
        'user',
        false,
        verificationToken,
        verificationExpires
      ]
    );

    try {
      await sendVerificationEmail(email, verificationToken);
      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        user: result.rows[0],
        isVerified: false
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(201).json({
        message: 'Registration successful, but we could not send the verification email. Please contact support.',
        user: result.rows[0],
        verificationToken,
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
    const decodedToken = decodeURIComponent(token);
    
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
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user in database
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // If user not found
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if email is verified
    if (!user.is_verified) {
      return res.status(401).json({ 
        error: 'Please verify your email first',
        email: user.email
      });
    }

    // Check if password is correct
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000 // 30 minutes
    });

    // Send response
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Forgot password endpoint - FIXED
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request for:', email);

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    console.log('User found:', result.rows.length > 0);

    if (result.rows.length === 0) {
      return res.json({ 
        message: 'If your email is registered, you will receive a password reset link'
      });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.status(400).json({ 
        error: 'Please verify your email first before resetting password',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    console.log('Generated reset token:', resetToken);

    await pool.query(
      `UPDATE users 
       SET reset_token = $1,
           reset_token_expires = $2
       WHERE email = $3`,
      [resetToken, resetExpires, email.toLowerCase()]
    );

    console.log('Updated user with reset token');

    // Send response immediately
    res.json({ 
      message: 'If your email is registered, you will receive a password reset link',
      success: true
    });
    console.log('Response sent to client');

    // Send email asynchronously after response
    console.log('Sending password reset email in background...');
    sendPasswordResetEmail(email, resetToken)
      .then(() => {
        console.log('Password reset email sent successfully');
      })
      .catch((error) => {
        console.error('Failed to send reset email:', error.message);
      });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM users 
       WHERE reset_token = $1 
       AND reset_token_expires > NOW()`,
      [token]
    );

    // console.log('User found with token:', result.rows.length > 0);

    if (result.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }

    const user = result.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users 
       SET password = $1,
           reset_token = NULL,
           reset_token_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, user.id]
    );
      
    res.json({ 
      message: 'Password has been reset successfully',
      success: true
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Internal server error'
    });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  // Remove cookie
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict'
  });
  
  res.json({ message: 'Logged out successfully' });
});

// Get user profile
router.get('/profile', jwtauthMiddleware, async (req, res) => {
  try {
    // Get user from database
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    // If user not found
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // Send user data
    res.json({
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
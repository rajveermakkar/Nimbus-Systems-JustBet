const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// Validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password.length >= 8;

// Error response helper
const errorResponse = (res, status, message) => res.status(status).json({ error: message });

const userController = {
  // Register new user
  async register(req, res) {
    try {
      const { firstName, lastName, email, password } = req.body;

      // Validate input
      if (!firstName || !lastName || !email || !password) {
        return errorResponse(res, 400, 'All fields (firstName, lastName, email, password) are required');
      }

      if (!validateEmail(email)) {
        return errorResponse(res, 400, 'Invalid email format');
      }

      if (!validatePassword(password)) {
        return errorResponse(res, 400, 'Password must be at least 8 characters long');
      }

      // Check if user exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return errorResponse(res, 400, 'Email already registered');
      }

      // Create user
      const user = await User.create({ firstName, lastName, email, password });

      // Generate verification token
      const verificationToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Save token and send email
      await User.setVerificationToken(user.id, verificationToken, expiresAt);
      await sendVerificationEmail(email, verificationToken);

      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return errorResponse(res, 400, 'Email and password are required');
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return errorResponse(res, 401, 'Invalid email or password');
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return errorResponse(res, 401, 'Invalid email or password');
      }

      // Check verification
      if (!user.is_verified) {
        return errorResponse(res, 401, 'Please verify your email first');
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000
      });

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
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return errorResponse(res, 400, 'Verification token is required');
      }

      const user = await User.findByVerificationToken(token);
      if (!user) {
        return errorResponse(res, 400, 'Invalid or expired verification token');
      }

      await User.updateVerificationStatus(user.id, true);
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Verification error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Request password reset
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return errorResponse(res, 400, 'Email is required');
      }

      if (!validateEmail(email)) {
        return errorResponse(res, 400, 'Invalid email format');
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return errorResponse(res, 404, 'User not found');
      }

      const resetToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await User.setResetToken(user.id, resetToken, expiresAt);
      await sendPasswordResetEmail(email, resetToken);

      res.json({ message: 'Password reset instructions sent to your email' });
    } catch (error) {
      console.error('Password reset request error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return errorResponse(res, 400, 'Token and password are required');
      }

      if (!validatePassword(password)) {
        return errorResponse(res, 400, 'Password must be at least 8 characters long');
      }

      const user = await User.findByResetToken(token);
      if (!user) {
        return errorResponse(res, 400, 'Invalid or expired reset token');
      }

      await User.updatePassword(user.id, password);
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Password reset error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Get user profile
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return errorResponse(res, 404, 'User not found');
      }

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
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Logout user
  logout(req, res) {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
  }
};

module.exports = userController; 
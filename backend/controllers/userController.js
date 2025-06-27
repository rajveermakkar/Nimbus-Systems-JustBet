const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const RefreshToken = require('../models/RefreshToken');
const crypto = require('crypto');

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password.length >= 8;

const errorResponse = (res, status, message) => res.status(status).json({ error: message });

// SESSION CONFIGURATION
// How long a user session (JWT) lasts, in minutes
const SESSION_DURATION_MINUTES = 60; // 1 hour
// How long before expiry to show the warning modal (frontend only)
const SESSION_WARNING_MINUTES = 10; // 10 minutes before expiry
// How long the refresh token lasts, in minutes
const REFRESH_TOKEN_DURATION_MINUTES = 1440; // 1 day

//conveting to seconds then miiiseconds
const SESSION_DURATION_MS = SESSION_DURATION_MINUTES * 60 * 1000;
const REFRESH_TOKEN_DURATION_MS = REFRESH_TOKEN_DURATION_MINUTES * 60 * 1000;
const SESSION_DURATION_STR = `${SESSION_DURATION_MINUTES}m`;

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
      // Block login if already logged in (valid refresh token cookie)
      const existingRefresh = req.cookies && req.cookies.refreshToken;
      if (existingRefresh) {
        const found = await RefreshToken.findByToken(existingRefresh);
        if (found && new Date(found.expires_at) > new Date()) {
          return errorResponse(res, 400, 'Already logged in. Please logout first.');
        }
      }
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
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          isApproved: user.is_approved 
        },
        process.env.JWT_SECRET,
        { expiresIn: SESSION_DURATION_STR }
      );
      // Invalidate previous refresh tokens for this user
      await RefreshToken.deleteByUser(user.id);
      // Generate new refresh token
      const refreshToken = crypto.randomBytes(40).toString('hex');
      const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_DURATION_MS);
      await RefreshToken.create({ userId: user.id, token: refreshToken, expiresAt: refreshExpires });
      // Set cookies
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: SESSION_DURATION_MS
      });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: REFRESH_TOKEN_DURATION_MS
      });
      res.json({
        message: 'Login successful',
        token,
        expiresIn: SESSION_DURATION_STR,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          isApproved: user.is_approved
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
      const user = await User.findById(req.user.id);
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
  async logout(req, res) {
    try {
      const refreshToken = req.cookies && req.cookies.refreshToken;
      if (refreshToken) {
        await RefreshToken.deleteByToken(refreshToken);
      }
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      });
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      });
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.clearCookie('token', { httpOnly: true, sameSite: 'strict', path: '/' });
      res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict', path: '/' });
      res.status(500).json({ error: 'Logout failed' });
    }
  },

  // Refresh access token using refresh token
  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies && req.cookies.refreshToken;
      if (!refreshToken) {
        return errorResponse(res, 401, 'No refresh token provided');
      }
      const found = await RefreshToken.findByToken(refreshToken);
      if (!found || new Date(found.expires_at) < new Date()) {
        // Invalidate cookie if expired/invalid
        await RefreshToken.deleteByToken(refreshToken);
        res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
        res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });
        return errorResponse(res, 401, 'Refresh token expired or invalid, please log in again');
      }
      // Get user
      const user = await User.findById(found.user_id);
      if (!user) {
        await RefreshToken.deleteByToken(refreshToken);
        res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
        res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });
        return errorResponse(res, 401, 'User not found');
      }
      // Issue new access token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          isApproved: user.is_approved 
        },
        process.env.JWT_SECRET,
        { expiresIn: SESSION_DURATION_STR }
      );
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: SESSION_DURATION_MS
      });
      res.json({
        message: 'Token refreshed',
        token,
        expiresIn: SESSION_DURATION_STR,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          isApproved: user.is_approved
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Get user winnings (with SQL JOINs for performance)
  async getWinnings(req, res) {
    try {
      const userId = req.user.id;
      const { type } = req.query;
      const { pool } = require('../db/init');
      let winnings = [];
      if (!type || type === 'all' || type === 'live') {
        const liveQuery = `
          SELECT lar.*, la.title, la.description, la.image_url, la.starting_price, la.end_time, la.status, u.first_name, u.last_name, 'live' as auction_type
          FROM live_auction_results lar
          JOIN live_auctions la ON lar.auction_id = la.id
          JOIN users u ON la.seller_id = u.id
          WHERE lar.winner_id = $1 AND lar.status = 'won'
          ORDER BY la.end_time DESC
        `;
        const liveRows = (await pool.query(liveQuery, [userId])).rows.map(row => ({
          ...row,
          seller_name: `${row.first_name} ${row.last_name}`
        }));
        winnings = winnings.concat(liveRows);
      }
      if (!type || type === 'all' || type === 'settled') {
        const settledQuery = `
          SELECT sar.*, sa.title, sa.description, sa.image_url, sa.starting_price, sa.end_time, sa.status, u.first_name, u.last_name, 'settled' as auction_type
          FROM settled_auction_results sar
          JOIN settled_auctions sa ON sar.auction_id = sa.id
          JOIN users u ON sa.seller_id = u.id
          WHERE sar.winner_id = $1 AND sar.status = 'won'
          ORDER BY sa.end_time DESC
        `;
        const settledRows = (await pool.query(settledQuery, [userId])).rows.map(row => ({
          ...row,
          seller_name: `${row.first_name} ${row.last_name}`
        }));
        winnings = winnings.concat(settledRows);
      }
      winnings.sort((a, b) => new Date(b.end_time) - new Date(a.end_time));
      res.json({ winnings });
    } catch (error) {
      console.error('Get winnings error:', error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  },

  // Get user bid history (with SQL JOINs for performance)
  async getBidHistory(req, res) {
    try {
      const userId = req.user.id;
      const { pool } = require('../db/init');
      // Get live auction bids
      const liveBidsQuery = `
        SELECT 
          lb.id,
          lb.amount,
          lb.created_at,
          la.id as auction_id,
          la.title,
          la.image_url,
          la.status,
          la.end_time,
          u.first_name,
          u.last_name,
          'live' as auction_type,
          CASE 
            WHEN la.current_highest_bidder_id = $1 THEN true 
            ELSE false 
          END as is_winning_bid
        FROM live_auction_bids lb
        JOIN live_auctions la ON lb.auction_id = la.id
        JOIN users u ON la.seller_id = u.id
        WHERE lb.user_id = $1
        ORDER BY lb.created_at DESC
      `;
      // Get settled auction bids
      const settledBidsQuery = `
        SELECT 
          b.id,
          b.amount,
          b.created_at,
          sa.id as auction_id,
          sa.title,
          sa.image_url,
          sa.status,
          sa.end_time,
          u.first_name,
          u.last_name,
          'settled' as auction_type,
          CASE 
            WHEN sa.current_highest_bidder_id = $1 THEN true 
            ELSE false 
          END as is_winning_bid
        FROM settled_auction_bids b
        JOIN settled_auctions sa ON b.auction_id = sa.id
        JOIN users u ON sa.seller_id = u.id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
      `;
      const [liveBids, settledBids] = await Promise.all([
        pool.query(liveBidsQuery, [userId]),
        pool.query(settledBidsQuery, [userId])
      ]);
      const bidHistory = [
        ...liveBids.rows.map(row => ({ ...row, seller_name: `${row.first_name} ${row.last_name}` })),
        ...settledBids.rows.map(row => ({ ...row, seller_name: `${row.first_name} ${row.last_name}` }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json({ bidHistory });
    } catch (error) {
      console.error('Get bid history error:', error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  },

  // Get won live auction details
  async getWonLiveAuction(req, res) {
    try {
      const userId = req.user.id;
      const auctionId = req.params.id;
      const { pool } = require('../db/init');

      // Simple query to get auction details
      const auctionQuery = `
        SELECT 
          id,
          title,
          description,
          image_url,
          starting_price,
          current_highest_bid as final_bid,
          end_time,
          status,
          seller_id
        FROM live_auctions
        WHERE id = $1 
        AND current_highest_bidder_id = $2 
        AND status = 'closed'
      `;

      const auctionResult = await pool.query(auctionQuery, [auctionId, userId]);
      
      if (auctionResult.rows.length === 0) {
        return errorResponse(res, 404, 'Auction not found or you did not win this auction');
      }

      const auction = auctionResult.rows[0];

      // Simple query to get seller details
      const sellerQuery = `
        SELECT first_name, last_name, email
        FROM users
        WHERE id = $1
      `;

      const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
      
      if (sellerResult.rows.length > 0) {
        const seller = sellerResult.rows[0];
        auction.seller_name = `${seller.first_name} ${seller.last_name}`;
        auction.seller_email = seller.email;
      } else {
        auction.seller_name = 'Unknown Seller';
        auction.seller_email = 'Unknown';
      }

      auction.type = auction.type || 'live';

      res.json({ auction });
    } catch (error) {
      console.error('Get won live auction error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Get settled auction result for winner announcement
  async getSettledAuctionResult(req, res) {
    try {
      const auctionId = req.params.id;
      const { pool } = require('../db/init');

      // Get the auction result
      const resultQuery = `
        SELECT 
          sar.*,
          u.first_name,
          u.last_name,
          u.email
        FROM settled_auction_results sar
        LEFT JOIN users u ON sar.winner_id = u.id
        WHERE sar.auction_id = $1
      `;

      const result = await pool.query(resultQuery, [auctionId]);
      
      if (result.rows.length === 0) {
        return errorResponse(res, 404, 'Auction result not found');
      }

      const auctionResult = result.rows[0];
      
      // Add winner name if there is a winner
      if (auctionResult.winner_id) {
        auctionResult.winner_name = `${auctionResult.first_name} ${auctionResult.last_name}`;
      }

      res.json({ result: auctionResult });
    } catch (error) {
      console.error('Get settled auction result error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Get live auction result for winner announcement
  async getLiveAuctionResult(req, res) {
    try {
      const auctionId = req.params.id;
      const { pool } = require('../db/init');

      // Get the auction result
      const resultQuery = `
        SELECT 
          lar.*,
          u.first_name,
          u.last_name,
          u.email
        FROM live_auction_results lar
        LEFT JOIN users u ON lar.winner_id = u.id
        WHERE lar.auction_id = $1
      `;

      const result = await pool.query(resultQuery, [auctionId]);
      
      if (result.rows.length === 0) {
        return errorResponse(res, 404, 'Auction result not found');
      }

      const auctionResult = result.rows[0];
      
      // Add winner name if there is a winner
      if (auctionResult.winner_id) {
        auctionResult.winner_name = `${auctionResult.first_name} ${auctionResult.last_name}`;
      }

      res.json({ result: auctionResult });
    } catch (error) {
      console.error('Get live auction result error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Get won settled auction details
  async getWonSettledAuction(req, res) {
    try {
      const userId = req.user.id;
      const auctionId = req.params.id;
      const { pool } = require('../db/init');

      // Simple query to get auction details
      const auctionQuery = `
        SELECT 
          id,
          title,
          description,
          image_url,
          starting_price,
          current_highest_bid as final_bid,
          end_time,
          status,
          seller_id
        FROM settled_auctions
        WHERE id = $1 
        AND current_highest_bidder_id = $2 
        AND status = 'closed'
      `;

      const auctionResult = await pool.query(auctionQuery, [auctionId, userId]);
      
      if (auctionResult.rows.length === 0) {
        return errorResponse(res, 404, 'Auction not found or you did not win this auction');
      }

      const auction = auctionResult.rows[0];

      // Simple query to get seller details
      const sellerQuery = `
        SELECT first_name, last_name, email
        FROM users
        WHERE id = $1
      `;

      const sellerResult = await pool.query(sellerQuery, [auction.seller_id]);
      
      if (sellerResult.rows.length > 0) {
        const seller = sellerResult.rows[0];
        auction.seller_name = `${seller.first_name} ${seller.last_name}`;
        auction.seller_email = seller.email;
      } else {
        auction.seller_name = 'Unknown Seller';
        auction.seller_email = 'Unknown';
      }

      auction.type = auction.type || 'settled';

      res.json({ auction });
    } catch (error) {
      console.error('Get won settled auction error:', error);
      errorResponse(res, 500, 'Something went wrong');
    }
  },

  // Get won auction details (junior-level, from results table, for both types)
  async getWonAuction(req, res) {
    try {
      const userId = req.user.id;
      const { id, type } = req.params;
      const { pool } = require('../db/init');
      let result = null;
      let auction = null;
      let sellerName = 'Unknown';
      let auctionType = type || 'settled';
      if (auctionType === 'live') {
        const resultRes = await pool.query('SELECT * FROM live_auction_results WHERE auction_id = $1 AND winner_id = $2', [id, userId]);
        result = resultRes.rows[0];
        if (result) {
          const auctionRes = await pool.query('SELECT * FROM live_auctions WHERE id = $1', [id]);
          auction = auctionRes.rows[0];
          if (auction) {
            const sellerRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [auction.seller_id]);
            if (sellerRes.rows[0]) {
              sellerName = sellerRes.rows[0].first_name + ' ' + sellerRes.rows[0].last_name;
            }
          }
        }
      } else {
        const resultRes = await pool.query('SELECT * FROM settled_auction_results WHERE auction_id = $1 AND winner_id = $2', [id, userId]);
        result = resultRes.rows[0];
        if (result) {
          const auctionRes = await pool.query('SELECT * FROM settled_auctions WHERE id = $1', [id]);
          auction = auctionRes.rows[0];
          if (auction) {
            const sellerRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [auction.seller_id]);
            if (sellerRes.rows[0]) {
              sellerName = sellerRes.rows[0].first_name + ' ' + sellerRes.rows[0].last_name;
            }
          }
        }
      }
      if (!result || !auction) {
        return res.status(404).json({ error: 'Auction not found or you did not win this auction' });
      }
      res.json({
        auction: {
          ...auction,
          final_bid: result.final_bid,
          seller_name: sellerName,
          type: auctionType
        }
      });
    } catch (error) {
      console.error('Get won auction error:', error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  }
};

module.exports = userController; 
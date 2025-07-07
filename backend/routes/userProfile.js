const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const jwtauthMiddleware = require('../middleware/jwtauth');

// Middleware: require authentication (assume req.user.id is set)
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/user/profile
router.get('/profile', jwtauthMiddleware, requireAuth, async (req, res) => {
  try {
    // Get basic user info
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Get profile info
    const profileResult = await pool.query(
      'SELECT avatar_url, phone, address, city, state, country, postal_code FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};

    res.json({ ...user, ...profile });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/user/profile
router.patch('/profile', jwtauthMiddleware, requireAuth, async (req, res) => {
  const { first_name, last_name, avatar_url, phone, address, city, state, country, postal_code } = req.body;
  try {
    // Update users table (first_name, last_name)
    if (first_name || last_name) {
      await pool.query(
        'UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name) WHERE id = $3',
        [first_name, last_name, req.user.id]
      );
    }
    // Upsert into user_profiles
    await pool.query(
      `INSERT INTO user_profiles (user_id, avatar_url, phone, address, city, state, country, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         avatar_url = COALESCE($2, user_profiles.avatar_url),
         phone = COALESCE($3, user_profiles.phone),
         address = COALESCE($4, user_profiles.address),
         city = COALESCE($5, user_profiles.city),
         state = COALESCE($6, user_profiles.state),
         country = COALESCE($7, user_profiles.country),
         postal_code = COALESCE($8, user_profiles.postal_code),
         updated_at = CURRENT_TIMESTAMP
      `,
      [req.user.id, avatar_url, phone, address, city, state, country, postal_code]
    );
    // Return updated profile
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
      [req.user.id]
    );
    const profileResult = await pool.query(
      'SELECT avatar_url, phone, address, city, state, country, postal_code FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ ...userResult.rows[0], ...profileResult.rows[0] });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router; 
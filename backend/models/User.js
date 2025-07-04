const { pool, queryWithRetry } = require('../db/init');
const bcrypt = require('bcrypt');

const User = {
  // Create a new user
  async create({ firstName, lastName, email, password, role = 'buyer', isApproved = false }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (first_name, last_name, email, password, role, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name, last_name, email, role, is_approved, created_at
    `;
    const result = await queryWithRetry(query, [firstName, lastName, email.toLowerCase(), hashedPassword, role, isApproved]);
    return result.rows[0];
  },

  // Find user by email
  async findByEmail(email) {
    const result = await queryWithRetry('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return result.rows[0];
  },

  // Find user by ID
  async findById(id) {
    const result = await queryWithRetry('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Update user verification status
  async updateVerificationStatus(userId, isVerified) {
    const query = `
      UPDATE users 
      SET is_verified = $1, 
          verification_token = NULL,
          verification_token_expires = NULL
      WHERE id = $2
      RETURNING id, email, is_verified
    `;
    const result = await queryWithRetry(query, [isVerified, userId]);
    return result.rows[0];
  },

  // Set verification token
  async setVerificationToken(userId, token, expiresAt) {
    const query = `
      UPDATE users 
      SET verification_token = $1,
          verification_token_expires = $2
      WHERE id = $3
      RETURNING id, email, verification_token_expires
    `;
    const result = await queryWithRetry(query, [token, expiresAt, userId]);
    return result.rows[0];
  },

  // Set reset token
  async setResetToken(userId, token, expiresAt) {
    const query = `
      UPDATE users 
      SET reset_token = $1,
          reset_token_expires = $2
      WHERE id = $3
      RETURNING id, email, reset_token_expires
    `;
    const result = await queryWithRetry(query, [token, expiresAt, userId]);
    return result.rows[0];
  },

  // Update password
  async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = `
      UPDATE users 
      SET password = $1,
          reset_token = NULL,
          reset_token_expires = NULL
      WHERE id = $2
      RETURNING id, email
    `;
    const result = await queryWithRetry(query, [hashedPassword, userId]);
    return result.rows[0];
  },

  // Find user by verification token
  async findByVerificationToken(token) {
    const query = `
      SELECT * FROM users 
      WHERE verification_token = $1 
      AND verification_token_expires > NOW()
    `;
    const result = await queryWithRetry(query, [token]);
    return result.rows[0];
  },

  // Find user by reset token
  async findByResetToken(token) {
    const query = `
      SELECT * FROM users 
      WHERE reset_token = $1 
      AND reset_token_expires > NOW()
    `;
    const result = await queryWithRetry(query, [token]);
    return result.rows[0];
  },

  // Update user role and approval status with business details
  async updateRoleAndApproval(userId, role, isApproved, businessDetails = null) {
    const query = `
      UPDATE users 
      SET role = $1,
          is_approved = $2,
          business_name = $3,
          business_description = $4,
          business_address = $5,
          business_phone = $6
      WHERE id = $7
      RETURNING id, email, role, is_approved, business_name, business_description, 
                business_address, business_phone
    `;
    const result = await queryWithRetry(query, [
      role, 
      isApproved, 
      businessDetails?.businessName || null,
      businessDetails?.businessDescription || null,
      businessDetails?.businessAddress || null,
      businessDetails?.businessPhone || null,
      userId
    ]);
    return result.rows[0];
  },

  // Get all pending seller approvals with business details
  async getPendingSellers() {
    const query = `
      SELECT id, first_name, last_name, email, role, is_approved, created_at,
             business_name, business_description, business_address, 
             business_phone
      FROM users
      WHERE role = 'seller' AND is_approved = false
    `;
    const result = await queryWithRetry(query);
    return result.rows;
  },

  // Count total users
  async countAll() {
    const result = await queryWithRetry('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count, 10);
  },

  // Count users by role
  async countByRole(role) {
    const result = await queryWithRetry('SELECT COUNT(*) FROM users WHERE role = $1', [role]);
    return parseInt(result.rows[0].count, 10);
  },

  // Count pending seller requests
  async countPendingSellerRequests() {
    const result = await queryWithRetry("SELECT COUNT(*) FROM users WHERE role = 'seller' AND is_approved = false");
    return parseInt(result.rows[0].count, 10);
  },

  // Get active ban for a user
  async getActiveBan(userId) {
    const query = `SELECT * FROM user_bans WHERE user_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY issued_at DESC LIMIT 1`;
    const result = await queryWithRetry(query, [userId]);
    return result.rows[0];
  },

  // Count previous bans for progressive logic
  async countPreviousBans(userId) {
    const query = `SELECT COUNT(*) FROM user_bans WHERE user_id = $1`;
    const result = await queryWithRetry(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  },

  // Progressive ban logic using user_bans table
  async banUser(userId, adminId, reason) {
    const previousBans = await this.countPreviousBans(userId);
    let expiresAt = null;
    if (previousBans === 0) {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
    } else if (previousBans === 1) {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } // 2+ is permanent (expiresAt stays null)
    const query = `
      INSERT INTO user_bans (user_id, admin_id, reason, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await queryWithRetry(query, [userId, adminId, reason, expiresAt]);
    return result.rows[0];
  },

  // Unban user (set is_active = false, lifted_at, lifted_by)
  async unbanUser(userId, adminId) {
    const activeBan = await this.getActiveBan(userId);
    if (!activeBan) throw new Error('No active ban to lift.');
    if (!activeBan.expires_at) throw new Error('Cannot unban a permanently banned user.');
    const query = `
      UPDATE user_bans
      SET is_active = false, lifted_at = NOW(), lifted_by = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryWithRetry(query, [adminId, activeBan.id]);
    return result.rows[0];
  },

  // Get ban history for a user
  async getBanHistory(userId) {
    const query = `
      SELECT 
        ub.*,
        admin.first_name as admin_first_name,
        admin.last_name as admin_last_name,
        lifted_admin.first_name as lifted_by_first_name,
        lifted_admin.last_name as lifted_by_last_name
      FROM user_bans ub
      LEFT JOIN users admin ON ub.admin_id = admin.id
      LEFT JOIN users lifted_admin ON ub.lifted_by = lifted_admin.id
      WHERE ub.user_id = $1
      ORDER BY ub.issued_at DESC
    `;
    const result = await queryWithRetry(query, [userId]);
    return result.rows;
  },

  // Get ban statistics for admin dashboard
  async getBanStats() {
    // Total bans
    const totalBansRes = await queryWithRetry('SELECT COUNT(*) FROM user_bans');
    // Active bans
    const activeBansRes = await queryWithRetry('SELECT COUNT(*) FROM user_bans WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())');
    // Permanent bans
    const permanentBansRes = await queryWithRetry('SELECT COUNT(*) FROM user_bans WHERE is_active = true AND expires_at IS NULL');
    // Bans in last 7 days
    const last7DaysRes = await queryWithRetry(`SELECT COUNT(*) FROM user_bans WHERE issued_at >= NOW() - INTERVAL '7 days'`);
    // Bans in last 30 days
    const last30DaysRes = await queryWithRetry(`SELECT COUNT(*) FROM user_bans WHERE issued_at >= NOW() - INTERVAL '30 days'`);
    // Most common reasons
    const commonReasonsRes = await queryWithRetry(`SELECT reason, COUNT(*) as count FROM user_bans GROUP BY reason ORDER BY count DESC LIMIT 5`);
    return {
      totalBans: parseInt(totalBansRes.rows[0].count, 10),
      activeBans: parseInt(activeBansRes.rows[0].count, 10),
      permanentBans: parseInt(permanentBansRes.rows[0].count, 10),
      bansLast7Days: parseInt(last7DaysRes.rows[0].count, 10),
      bansLast30Days: parseInt(last30DaysRes.rows[0].count, 10),
      mostCommonReasons: commonReasonsRes.rows
    };
  },

  // Get all users
  async getAll() {
    const result = await queryWithRetry('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }
};

module.exports = User; 
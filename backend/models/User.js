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

  // Update user role and approval status with business details and optional rejection reason
  async updateRoleAndApproval(userId, role, isApproved, businessDetails = null, rejectionReason = null) {
    let query, params;
    if (role === 'seller' && isApproved === false && rejectionReason) {
      // Set rejection reason when rejecting
      query = `
        UPDATE users 
        SET role = $1,
            is_approved = $2,
            business_name = $3,
            business_description = $4,
            business_address = $5,
            business_phone = $6,
            seller_rejection_reason = $7
        WHERE id = $8
        RETURNING id, email, role, is_approved, business_name, business_description, 
                  business_address, business_phone, seller_rejection_reason
      `;
      params = [
        role, 
        isApproved, 
        businessDetails?.businessName || null,
        businessDetails?.businessDescription || null,
        businessDetails?.businessAddress || null,
        businessDetails?.businessPhone || null,
        rejectionReason,
        userId
      ];
    } else if (role === 'seller' && isApproved === false && !rejectionReason) {
      // Clear rejection reason when reapplying
      query = `
        UPDATE users 
        SET role = $1,
            is_approved = $2,
            business_name = $3,
            business_description = $4,
            business_address = $5,
            business_phone = $6,
            seller_rejection_reason = NULL
        WHERE id = $7
        RETURNING id, email, role, is_approved, business_name, business_description, 
                  business_address, business_phone, seller_rejection_reason
      `;
      params = [
        role, 
        isApproved, 
        businessDetails?.businessName || null,
        businessDetails?.businessDescription || null,
        businessDetails?.businessAddress || null,
        businessDetails?.businessPhone || null,
        userId
      ];
    } else {
      // Default: do not touch rejection reason
      query = `
        UPDATE users 
        SET role = $1,
            is_approved = $2,
            business_name = $3,
            business_description = $4,
            business_address = $5,
            business_phone = $6
        WHERE id = $7
        RETURNING id, email, role, is_approved, business_name, business_description, 
                  business_address, business_phone, seller_rejection_reason
      `;
      params = [
        role, 
        isApproved, 
        businessDetails?.businessName || null,
        businessDetails?.businessDescription || null,
        businessDetails?.businessAddress || null,
        businessDetails?.businessPhone || null,
        userId
      ];
    }
    const result = await queryWithRetry(query, params);
    return result.rows[0];
  },

  // Get all pending seller approvals with business details
  async getPendingSellers() {
    const query = `
      SELECT id, first_name, last_name, email, role, is_approved, created_at,
             business_name, business_description, business_address, 
             business_phone
      FROM users
      WHERE role = 'seller' AND is_approved = false AND (seller_rejection_reason IS NULL OR seller_rejection_reason = '')
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

  // Get all users
  async getAll() {
    const result = await queryWithRetry('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  },

  // Set Stripe customer ID
  async setStripeCustomerId(userId, customerId) {
    const query = `
      UPDATE users SET stripe_customer_id = $1 WHERE id = $2 RETURNING *
    `;
    const result = await queryWithRetry(query, [customerId, userId]);
    return result.rows[0];
  },

  // Ban a user with progressive logic
  async banUser(userId, reason) {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');
    let banCount = user.ban_count || 0;
    banCount++;
    let banDuration = null;
    let banExpiry = null;
    let isPermanent = false;
    if (banCount === 1) {
      banDuration = 7; // days
    } else if (banCount === 2) {
      banDuration = 30;
    } else {
      isPermanent = true;
    }
    if (!isPermanent) {
      banExpiry = new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000);
    }
    // Update ban history
    const prevHistory = user.ban_history || [];
    const newRecord = {
      date: new Date().toISOString(),
      reason,
      duration: isPermanent ? 'permanent' : `${banDuration} days`,
    };
    const newHistory = [...prevHistory, newRecord];
    const query = `
      UPDATE users SET 
        ban_count = $1,
        is_banned = true,
        ban_reason = $2,
        ban_expiry = $3,
        ban_history = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await queryWithRetry(query, [banCount, reason, banExpiry, JSON.stringify(newHistory), userId]);
    return result.rows[0];
  },

  // Unban a user
  async unbanUser(userId) {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');
    const query = `
      UPDATE users SET 
        is_banned = false,
        ban_reason = NULL,
        ban_expiry = NULL
      WHERE id = $1
      RETURNING *
    `;
    const result = await queryWithRetry(query, [userId]);
    return result.rows[0];
  },

  // Get ban history for a user
  async getBanHistory(userId) {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');
    return user.ban_history || [];
  },

  // Schedule account deletion (set status to 'inactive' and set deletionScheduledAt)
  async scheduleDeletion(userId, scheduledAt) {
    const query = `
      UPDATE users SET status = 'inactive', deletionScheduledAt = $1 WHERE id = $2 RETURNING *
    `;
    const result = await queryWithRetry(query, [scheduledAt, userId]);
    return result.rows[0];
  },

  // Reactivate user (set status to 'active' and clear deletionScheduledAt)
  async reactivate(userId) {
    const query = `
      UPDATE users SET status = 'active', deletionScheduledAt = NULL WHERE id = $1 RETURNING *
    `;
    const result = await queryWithRetry(query, [userId]);
    return result.rows[0];
  }
};

module.exports = User; 
const { pool } = require('../db/init');
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
    const result = await pool.query(query, [firstName, lastName, email, hashedPassword, role, isApproved]);
    return result.rows[0];
  },

  // Find user by email
  async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  // Find user by ID
  async findById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
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
    const result = await pool.query(query, [isVerified, userId]);
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
    const result = await pool.query(query, [token, expiresAt, userId]);
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
    const result = await pool.query(query, [token, expiresAt, userId]);
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
    const result = await pool.query(query, [hashedPassword, userId]);
    return result.rows[0];
  },

  // Find user by verification token
  async findByVerificationToken(token) {
    const query = `
      SELECT * FROM users 
      WHERE verification_token = $1 
      AND verification_token_expires > NOW()
    `;
    const result = await pool.query(query, [token]);
    return result.rows[0];
  },

  // Find user by reset token
  async findByResetToken(token) {
    const query = `
      SELECT * FROM users 
      WHERE reset_token = $1 
      AND reset_token_expires > NOW()
    `;
    const result = await pool.query(query, [token]);
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
          business_phone = $6,
          business_website = $7,
          business_documents = $8
      WHERE id = $9
      RETURNING id, email, role, is_approved, business_name, business_description, 
                business_address, business_phone, business_website, business_documents
    `;
    const result = await pool.query(query, [
      role, 
      isApproved, 
      businessDetails?.businessName || null,
      businessDetails?.businessDescription || null,
      businessDetails?.businessAddress || null,
      businessDetails?.businessPhone || null,
      businessDetails?.businessWebsite || null,
      businessDetails?.businessDocuments || null,
      userId
    ]);
    return result.rows[0];
  },

  // Get all pending seller approvals with business details
  async getPendingSellers() {
    const query = `
      SELECT id, first_name, last_name, email, role, is_approved, created_at,
             business_name, business_description, business_address, 
             business_phone, business_website, business_documents
      FROM users
      WHERE role = 'seller' AND is_approved = false
    `;
    const result = await pool.query(query);
    return result.rows;
  }
};

module.exports = User; 
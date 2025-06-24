const { pool } = require('../db/init');

const RefreshToken = {
  async create({ userId, token, expiresAt }) {
    const result = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *`,
      [userId, token, expiresAt]
    );
    return result.rows[0];
  },
  async findByToken(token) {
    const result = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token = $1`,
      [token]
    );
    return result.rows[0];
  },
  async findByUser(userId) {
    const result = await pool.query(
      `SELECT * FROM refresh_tokens WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  },
  async deleteByUser(userId) {
    await pool.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1`,
      [userId]
    );
  },
  async deleteByToken(token) {
    await pool.query(
      `DELETE FROM refresh_tokens WHERE token = $1`,
      [token]
    );
  }
};

module.exports = RefreshToken; 
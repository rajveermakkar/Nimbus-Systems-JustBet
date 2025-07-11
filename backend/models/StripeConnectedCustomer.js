const { queryWithRetry } = require('../db/init');

const StripeConnectedCustomer = {
  async findByUserAndAccount(userId, connectedAccountId) {
    const result = await queryWithRetry(
      'SELECT * FROM stripe_connected_customers WHERE user_id = $1 AND connected_account_id = $2',
      [userId, connectedAccountId]
    );
    return result.rows[0];
  },
  
  async findByUserId(userId) {
    const result = await queryWithRetry(
      'SELECT * FROM stripe_connected_customers WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  },
  
  async create(userId, connectedAccountId, customerId) {
    const result = await queryWithRetry(
      'INSERT INTO stripe_connected_customers (user_id, connected_account_id, customer_id) VALUES ($1, $2, $3) RETURNING *',
      [userId, connectedAccountId, customerId]
    );
    return result.rows[0];
  },
  
  // New method for admin accounts
  async createAdminAccount(userId, stripeAccountId) {
    const result = await queryWithRetry(
      'INSERT INTO stripe_connected_customers (user_id, stripe_account_id, account_type) VALUES ($1, $2, $3) RETURNING *',
      [userId, stripeAccountId, 'admin']
    );
    return result.rows[0];
  }
};

module.exports = StripeConnectedCustomer; 
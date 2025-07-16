const { pool } = require('../db/init');

const OrderDocument = {
  // Create a new document record
  async create({ orderId, type, url, walletTxnId }) {
    const query = `
      INSERT INTO order_documents (order_id, type, url, wallet_txn_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [orderId, type, url, walletTxnId]);
    return result.rows[0];
  },

  // Find document by order and type
  async findByOrderAndType(orderId, type) {
    const query = 'SELECT * FROM order_documents WHERE order_id = $1 AND type = $2';
    const result = await pool.query(query, [orderId, type]);
    return result.rows[0];
  },

  // Find all documents for an order
  async findAllByOrder(orderId) {
    const query = 'SELECT * FROM order_documents WHERE order_id = $1';
    const result = await pool.query(query, [orderId]);
    return result.rows;
  },

  // Update document URL (if re-generated)
  async updateUrl(id, url) {
    const query = 'UPDATE order_documents SET url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [url, id]);
    return result.rows[0];
  }
};

module.exports = OrderDocument; 
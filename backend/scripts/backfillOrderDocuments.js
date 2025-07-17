require('dotenv').config();

const { pool } = require('../db/init');
const { getOrderPdfData } = require('../services/pdfDataService');
const { generateAndStoreOrderDocument } = require('../services/pdfService');
const OrderDocument = require('../models/orderDocument');

async function backfillOrderDocuments() {
  // Get all completed orders (status = 'delivered' or similar)
  const ordersResult = await pool.query("SELECT * FROM orders WHERE status IN ('delivered', 'shipped', 'under_process')");
  const orders = ordersResult.rows;
  console.log(`Found ${orders.length} orders to process.`);

  for (const order of orders) {
    try {
      // Check if invoice exists
      const invoiceDoc = await OrderDocument.findByOrderAndType(order.id, 'invoice');
      if (!invoiceDoc) {
        const data = await getOrderPdfData(order.id);
        await generateAndStoreOrderDocument(data, 'invoice');
        console.log(`Generated invoice for order ${order.id}`);
      }
      // Check if certificate exists
      const certDoc = await OrderDocument.findByOrderAndType(order.id, 'certificate');
      if (!certDoc) {
        const data = await getOrderPdfData(order.id);
        await generateAndStoreOrderDocument(data, 'certificate');
        console.log(`Generated certificate for order ${order.id}`);
      }
    } catch (err) {
      console.error(`Error processing order ${order.id}:`, err.message);
    }
  }
  console.log('Backfill complete.');
}

if (require.main === module) {
  backfillOrderDocuments().then(() => process.exit(0));
} 
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OrderDocument = require('../models/orderDocument');
const { uploadFileToAzure } = require('./azureBlobService');

// Helper to generate a PDF buffer
function generateInvoiceBuffer(data) {
  return new Promise((resolve, reject) => {
    if (!data.auction) {
      return reject(new Error('Auction data not found for this order.'));
    }
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // --- JustBet Watermark ---
    doc.save();
    doc.fontSize(36)
      .fillColor('#eeeeee')
      .opacity(0.15)
      .rotate(-30, { origin: [300, 200] })
      .text('JustBet', 100, 150, { align: 'center', width: 400 });
    doc.restore();
    doc.opacity(1);
    doc.fillColor('black');
    doc.y = 60; // Reset y position for main content

    // --- Header ---
    doc.fontSize(28).text('Invoice', { align: 'center', underline: true });
    doc.moveDown(1.5);

    // --- Invoice Info ---
    doc.fontSize(14);
    doc.text(`Invoice Number: ${data.order.id}`, { align: 'left' });
    doc.text(`Date: ${new Date(data.order.created_at).toLocaleDateString()}`, { align: 'left' });
    doc.moveDown(0.5);

    // --- Customer & Seller ---
    doc.text(`Customer: ${data.winner.first_name} ${data.winner.last_name}`, { align: 'left' });
    doc.font('Helvetica-Bold').text(`Seller: ${data.seller.first_name} ${data.seller.last_name}`, { align: 'left' });
    doc.font('Helvetica');
    doc.moveDown(0.5);

    // --- Auction Title ---
    doc.fontSize(20).text(`${data.auction.title}`, { align: 'left', underline: true });
    doc.fontSize(14);
    doc.moveDown(0.5);

    // --- Final Amount ---
    doc.text(`Final Amount: $${data.auction.current_highest_bid || data.auction.final_bid}`, { align: 'left' });
    doc.moveDown(0.5);

    // --- References ---
    if (data.walletTxn) {
      doc.text(`Payment Reference: ${data.walletTxn.id}`, { align: 'left' });
      doc.text(`Wallet Transaction Ref: ${data.walletTxn.reference_id || 'N/A'}`, { align: 'left' });
    }
    doc.moveDown(1);

    // --- Shipping Address ---
    doc.font('Helvetica-Bold').text('Shipping Address:', { align: 'left', underline: true });
    doc.font('Helvetica');
    doc.text(`${data.order.shipping_address}`, { align: 'left' });
    doc.text(`${data.order.shipping_city}, ${data.order.shipping_state} ${data.order.shipping_postal_code}`, { align: 'left' });
    doc.text(`${data.order.shipping_country}`, { align: 'left' });

    doc.end();
  });
}

function generateCertificateBuffer(data) {
  return new Promise((resolve, reject) => {
    if (!data.auction) {
      return reject(new Error('Auction data not found for this order.'));
    }
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
    doc.fontSize(28).text('Certificate of Ownership', { align: 'center', underline: true });
    doc.moveDown(2);
    doc.fontSize(16).text('This is to certify that', { align: 'center' });
    doc.moveDown();
    doc.fontSize(22).text(`${data.winner.first_name} ${data.winner.last_name}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('is the rightful owner of', { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text(data.auction.title, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(14).text(`Date: ${new Date(data.order.created_at).toLocaleDateString()}`, 100, 600);
    doc.text('Signature: ____________________', 350, 600);
    if (data.walletTxn) {
      doc.text(`Payment Reference: ${data.walletTxn.id}`, 100, 650);
    }
    doc.end();
  });
}

async function generateAndStoreOrderDocument(orderPdfData, type) {
  let buffer;
  if (type === 'invoice') {
    buffer = await generateInvoiceBuffer(orderPdfData);
  } else if (type === 'certificate') {
    buffer = await generateCertificateBuffer(orderPdfData);
  } else {
    throw new Error('Unknown document type');
  }

  // Prepare file object for Azure upload
  const file = {
    originalname: `${type}_${orderPdfData.order.id}.pdf`,
    buffer,
    mimetype: 'application/pdf',
    size: buffer.length
  };
  const url = await uploadFileToAzure(file);

  // Store in order_documents
  const docRecord = await OrderDocument.create({
    orderId: orderPdfData.order.id,
    type,
    url,
    walletTxnId: orderPdfData.walletTxnId // use walletTxnId
  });
  return docRecord;
}

module.exports = {
  generateAndStoreOrderDocument
}; 
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

    // --- Color scheme ---
    const primary = '#2A2A72';
    const secondary = '#666666';
    const accent = '#cccccc';
    const black = '#333333';

    // --- Header ---
    let y = 50;
    doc.font('Helvetica-Bold').fontSize(36)
      .fillColor(primary)
      .text('Invoice', 50, y);
    y += doc.heightOfString('Invoice', { width: 495 }) + 5;
    doc.font('Helvetica').fontSize(14)
      .fillColor(secondary)
      .text('Justbet Auction House', 50, y);
    y += doc.heightOfString('Justbet Auction House', { width: 495 }) + 10;
    doc.moveTo(50, y)
      .lineTo(545, y)
      .lineWidth(1)
      .stroke(accent);
    y += 15;

    // --- Invoice details (left) ---
    doc.fontSize(10)
      .fillColor(secondary)
      .text(`Invoice #${data.order.id}`, 50, y)
      .text(`Date: ${new Date(data.order.created_at).toLocaleDateString()}`, 50, y + 15);
    let detailsBlockHeight = 30;

    // --- Seller info (right) ---
    const company = data.seller || {};
    let sellerY = y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(black)
      .text('Seller Name:', 400, sellerY, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(black)
      .text((company.company_name || company.first_name + ' ' + company.last_name || ''), 400, sellerY + 12, { align: 'right' });
    sellerY += 28;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(black)
      .text('Seller Email:', 400, sellerY, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(black)
      .text(company.email || '', 400, sellerY + 12, { align: 'right' });
    sellerY += 28;
    doc.font('Helvetica').fontSize(10).fillColor(black)
      .text(company.company_address || '', 400, sellerY, { align: 'right' })
      .text(company.company_city ? `${company.company_city}, ${company.company_state || ''} ${company.company_zip || ''}` : '', 400, sellerY + 15, { align: 'right' });
    if (company.phone) doc.text(company.phone, 400, sellerY + 30, { align: 'right' });

    // --- Shipping address and payment reference ---
    y += detailsBlockHeight + 10;
    if (data.order.shipping_address) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(black)
        .text('Shipping Address:', 50, y);
      y += doc.heightOfString('Shipping Address:', { width: 400 }) + 2;
      doc.font('Helvetica').fontSize(10).fillColor(secondary)
        .text(data.order.shipping_address, 50, y);
      y += doc.heightOfString(data.order.shipping_address, { width: 400 }) + 2;
      if (data.order.shipping_city || data.order.shipping_state || data.order.shipping_postal_code) {
        const cityLine = `${data.order.shipping_city || ''}, ${data.order.shipping_state || ''} ${data.order.shipping_postal_code || ''}`;
        doc.text(cityLine, 50, y);
        y += doc.heightOfString(cityLine, { width: 400 }) + 2;
      }
      if (data.order.shipping_country) {
        doc.text(data.order.shipping_country, 50, y);
        y += doc.heightOfString(data.order.shipping_country, { width: 400 }) + 2;
      }
      y += 8;
    }
    if (data.walletTxn && data.walletTxn.id) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(black)
        .text('Payment Reference:', 50, y);
      y += doc.heightOfString('Payment Reference:', { width: 400 }) + 2;
      doc.font('Helvetica').fontSize(10).fillColor(secondary)
        .text(data.walletTxn.id, 50, y);
      y += doc.heightOfString(data.walletTxn.id, { width: 400 }) + 8;
    }

    // --- Bill To ---
    y += 10;
    doc.fillColor(black).font('Helvetica-Bold').fontSize(12).text('Bill To:', 50, y);
    y += doc.heightOfString('Bill To:', { width: 400 }) + 2;
    const winner = data.winner || {};
    doc.fillColor(secondary).font('Helvetica').fontSize(10)
      .text(winner.first_name + ' ' + winner.last_name, 50, y);
    y += doc.heightOfString(winner.first_name + ' ' + winner.last_name, { width: 400 }) + 2;
    if (winner.address) {
      doc.text(winner.address, 50, y);
      y += doc.heightOfString(winner.address, { width: 400 }) + 2;
    }
    if (winner.city) {
      const cityLine = `${winner.city}, ${winner.state || ''} ${winner.postal_code || ''}`;
      doc.text(cityLine, 50, y);
      y += doc.heightOfString(cityLine, { width: 400 }) + 2;
    }
    if (winner.email) {
      doc.text(winner.email, 50, y);
      y += doc.heightOfString(winner.email, { width: 400 }) + 2;
    }
    y += 10;

    // --- Table header ---
    const tableTop = Math.max(y, 320);
    doc.fillColor(black).fontSize(10)
      .text('Description', 50, tableTop)
      .text('Qty', 350, tableTop)
      .text('Rate', 400, tableTop)
      .text('Amount', 500, tableTop);
    doc.moveTo(50, tableTop + 15)
      .lineTo(545, tableTop + 15)
      .stroke(accent);

    // --- Items ---
    let position = tableTop + 30;
    doc.fillColor(secondary);
    const items = data.items || [
      { description: data.auction.title, quantity: 1, rate: data.auction.current_highest_bid || data.auction.final_bid }
    ];
    items.forEach(item => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const amount = quantity * rate;
      doc.text(item.description, 50, position)
        .text(quantity.toString(), 350, position)
        .text(`$${rate.toFixed(2)}`, 400, position)
        .text(`$${amount.toFixed(2)}`, 500, position);
      position += 20;
    });

    // --- Totals ---
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    let tax = 0;
    let total = subtotal;
    if (data.taxRate && data.taxRate > 0) {
      tax = subtotal * data.taxRate;
      total = subtotal + tax;
      doc.fillColor(secondary)
        .text(`Subtotal: $${subtotal.toFixed(2)}`, 450, position + 20, { align: 'right' })
        .text(`Tax (${(data.taxRate * 100).toFixed(0)}%): $${tax.toFixed(2)}`, 450, position + 35, { align: 'right' });
      doc.moveTo(400, position + 55)
        .lineTo(545, position + 55)
        .stroke(accent);
      doc.fillColor(primary).fontSize(12)
        .text(`Total: $${total.toFixed(2)}`, 450, position + 65, { align: 'right' });
    } else {
      doc.moveTo(400, position + 10)
        .lineTo(545, position + 10)
        .stroke(accent);
      doc.fillColor(primary).fontSize(12)
        .text(`Total: $${subtotal.toFixed(2)}`, 450, position + 20, { align: 'right' });
    }

    // --- Notes, payment terms, payment info ---
    let notesY = position + (data.taxRate ? 120 : 80);
    if (data.notes) {
      doc.fillColor(secondary).fontSize(10)
        .text('Notes:', 50, notesY)
        .text(data.notes, 50, notesY + 15, { width: 400 });
      notesY += 40;
    }
    if (data.paymentTerms) {
      doc.fillColor(secondary).fontSize(10)
        .text('Payment Terms:', 50, notesY)
        .text(data.paymentTerms, 50, notesY + 15, { width: 400 });
      notesY += 40;
    }
    if (data.paymentInfo) {
      doc.fillColor(secondary).fontSize(10)
        .text('Payment Information:', 50, notesY)
        .text(data.paymentInfo, 50, notesY + 15, { width: 400 });
    }

    doc.end();
  });
}

function generateCertificateBuffer(data) {
  return new Promise((resolve, reject) => {
    if (!data.auction) {
      return reject(new Error('Auction data not found for this order.'));
    }
    const doc = new PDFDocument({
      layout: 'portrait',
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 }
    });
    doc.addPage = () => doc;
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // --- Layout constants ---
    const borderWidth = 20;
    const borderColor = '#2A2A72';
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const marginTop = doc.page.margins.top;
    const marginBottom = doc.page.margins.bottom;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const safeBottom = pageHeight - marginBottom - 40;

    // --- Fill border area ---
    doc.save();
    doc.rect(0, 0, pageWidth, pageHeight).fill(borderColor);
    doc.restore();
    // --- Fill white content area ---
    doc.save();
    doc.rect(borderWidth, borderWidth, pageWidth - 2 * borderWidth, pageHeight - 2 * borderWidth).fill('#fff');
    doc.restore();
    // --- Draw border stroke for sharp edge ---
    doc.rect(borderWidth, borderWidth, pageWidth - 2 * borderWidth, pageHeight - 2 * borderWidth).stroke(borderColor);

    // --- Draw watermark (smaller, always fits) ---
    doc.save();
    doc.fillOpacity(0.08);
    doc.fill(borderColor);
    doc.font('Helvetica-Bold');
    doc.fontSize(70);
    const watermarkText = 'JUSTBET';
    const watermarkWidth = doc.widthOfString(watermarkText);
    const watermarkHeight = doc.currentLineHeight();
    const wmX = (pageWidth - watermarkWidth) / 2;
    const wmY = (pageHeight - watermarkHeight) / 2 + 10;
    doc.rotate(-30, { origin: [pageWidth / 2, pageHeight / 2] });
    doc.text(watermarkText, wmX, wmY, { align: 'center', width: watermarkWidth, lineBreak: false });
    doc.rotate(30, { origin: [pageWidth / 2, pageHeight / 2] });
    doc.restore();
    doc.fillOpacity(1);

    // --- Header ---
    let y = marginTop + 10;
    doc.fill('#2A2A72').font('Helvetica-Bold').fontSize(32)
      .text('CERTIFICATE OF OWNERSHIP', marginLeft, y, { align: 'center', width: contentWidth });
    // Add margin before JUSTBET Auction House
    y += 98;
    doc.fill('#000').font('Helvetica-Bold').fontSize(16)
      .text('JUSTBET Auction House', marginLeft, y, { align: 'center', width: contentWidth });

    // --- Centered Main Content Block ---
    const blockLines = [
      { text: 'This certifies that', font: ['#333', 'Helvetica', 13] },
      { text: `${data.winner.first_name} ${data.winner.last_name}`, font: ['#3c096c', 'Helvetica-Bold', 18] },
      { text: 'is hereby recognized as the rightful owner of:', font: ['#333', 'Helvetica', 13] },
      { text: data.auction.title, font: ['#3c096c', 'Helvetica-Bold', 16] },
      { text: 'Acquired through a successful bid at the JUSTBET Auction held on', font: ['#333', 'Helvetica', 13] },
      { text: new Date(data.order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), font: ['#3c096c', 'Helvetica-Bold', 14] },
      { text: 'Certificate ID:', font: ['#333', 'Helvetica', 13] },
      { text: data.order.id || data.order.certificate_id || 'N/A', font: ['#3c096c', 'Helvetica-Bold', 13] }
    ];
    const lineHeights = [20, 24, 20, 22, 18, 20, 18, 18];
    const blockHeight = lineHeights.reduce((a, b) => a + b, 0);
    const blockStartY = Math.round((pageHeight - marginTop - marginBottom - blockHeight) / 2 + marginTop);
    y = blockStartY;
    for (let i = 0; i < blockLines.length; i++) {
      const [color, font, size] = blockLines[i].font;
      doc.fill(color).font(font).fontSize(size)
        .text(blockLines[i].text, marginLeft, y, { align: 'center', width: contentWidth });
      y += lineHeights[i];
    }

    // --- Signature and Date Issued (above footer, left/right) ---
    const sigY = pageHeight - marginBottom - 70;
    const sigX = marginLeft + 10;
    const sigWidth = 180;
    const dateX = pageWidth - marginRight - sigWidth;
    doc.fill('#3c096c').font('Helvetica-Bold').fontSize(13)
      .text('JUSTBET', sigX, sigY, { width: sigWidth, align: 'center' });
    doc.fill('#333').font('Helvetica').fontSize(11)
      .text('Authorized by JUSTBET Auction House', sigX, sigY + 14, { width: sigWidth, align: 'center' });
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fill('#333').font('Helvetica').fontSize(11)
      .text(`Date Issued: ${currentDate}`, dateX, sigY, { width: sigWidth, align: 'center' });

    // --- Footer (always at the bottom, never on a new page) ---
    const footerY = pageHeight - marginBottom - 20;
    doc.fill('#777').font('Helvetica').fontSize(10)
      .text('JUSTBET Auction House | All Rights Reserved', marginLeft, footerY, { align: 'center', width: contentWidth });
    doc.text('For inquiries, please contact support@justbet.com', marginLeft, footerY + 12, { align: 'center', width: contentWidth });

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
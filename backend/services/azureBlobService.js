const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const CONTAINER_NAME = process.env.AZURE_BLOB_CONTAINER || 'auction-images';
const PDF_CONTAINER_NAME = process.env.AZURE_PDF_CONTAINER || 'order-documents';

const allowedExtensions = ['.png', '.jpg', '.jpeg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const allowedPdfExtensions = ['.pdf'];
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

async function uploadImageToAzure(file) {
  if (!file) throw new Error('No file provided');
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error('Invalid file type. Only png, jpg, jpeg allowed.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('File too large. Max size is 5MB.');
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  await containerClient.createIfNotExists();
  const blobName = `${uuidv4()}${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype }
  });
  // Public URL
  const url = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;
  return url;
}

async function uploadFileToAzure(file) {
  if (!file) throw new Error('No file provided');
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedPdfExtensions.includes(ext)) {
    throw new Error('Invalid file type. Only PDF allowed.');
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new Error('File too large. Max size is 10MB.');
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(PDF_CONTAINER_NAME);
  await containerClient.createIfNotExists();
  const blobName = `${uuidv4()}${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype }
  });
  // Public URL
  const url = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${PDF_CONTAINER_NAME}/${blobName}`;
  return url;
}

module.exports = {
  uploadImageToAzure,
  uploadFileToAzure
}; 
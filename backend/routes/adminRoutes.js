const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const jwtauthMiddleware = require('../middleware/jwtauth');
const roleAuth = require('../middleware/roleAuth');

// All routes require authentication and admin role
router.use(jwtauthMiddleware);
router.use(roleAuth(['admin']));

// Get all pending seller approvals
router.get('/pending-sellers', adminController.getPendingSellers);

// Approve or reject a seller
router.patch('/sellers/:userId/approve', adminController.handleSellerApproval);

module.exports = router; 
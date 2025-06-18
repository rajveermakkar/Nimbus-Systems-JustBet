const User = require('../models/User');
const { generateToken } = require('../utils/tokenUtils');

const sellerController = {
  // Request to become a seller
  async requestSellerRole(req, res) {
    try {
      const userId = req.user.id;
      const {
        businessName,
        businessDescription,
        businessAddress,
        businessPhone,
        businessWebsite,
        businessDocuments
      } = req.body;

      // Validate required business fields
      if (!businessName || !businessDescription || !businessAddress || !businessPhone) {
        return res.status(400).json({
          error: 'Missing required business information. Please provide business name, description, address, and phone number.'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role === 'seller') {
        return res.status(400).json({ error: 'User is already a seller' });
      }

      // Update user role to seller (pending approval) with business details
      const businessDetails = {
        businessName,
        businessDescription,
        businessAddress,
        businessPhone,
        businessWebsite,
        businessDocuments
      };

      const updatedUser = await User.updateRoleAndApproval(userId, 'seller', false, businessDetails);
      
      // Generate new token with updated role
      const token = generateToken(updatedUser);

      res.json({
        message: 'Seller role request submitted successfully. Waiting for admin approval.',
        user: {
          ...updatedUser,
          businessDetails: {
            businessName: updatedUser.business_name,
            businessDescription: updatedUser.business_description,
            businessAddress: updatedUser.business_address,
            businessPhone: updatedUser.business_phone,
            businessWebsite: updatedUser.business_website,
            businessDocuments: updatedUser.business_documents
          }
        },
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error submitting seller role request' });
    }
  },

  // Get seller request status
  async getSellerRequestStatus(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate new token with current status
      const token = generateToken(user);

      res.json({
        role: user.role,
        isApproved: user.is_approved,
        status: user.role === 'seller' 
          ? (user.is_approved ? 'approved' : 'pending')
          : 'not_requested',
        businessDetails: user.role === 'seller' ? {
          businessName: user.business_name,
          businessDescription: user.business_description,
          businessAddress: user.business_address,
          businessPhone: user.business_phone,
          businessWebsite: user.business_website,
          businessDocuments: user.business_documents
        } : null,
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Error fetching seller request status' });
    }
  }
};

module.exports = sellerController; 
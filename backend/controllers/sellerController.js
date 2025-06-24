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
        businessPhone
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
        businessPhone
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
            businessPhone: updatedUser.business_phone
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

      console.log('Seller status check for user:', {
        id: user.id,
        role: user.role,
        is_approved: user.is_approved,
        business_name: user.business_name
      });

      // Generate new token with current status
      const token = generateToken(user);

      const response = {
        role: user.role,
        isApproved: user.is_approved,
        status: user.role === 'seller' 
          ? (user.is_approved ? 'approved' : 'pending')
          : 'not_requested',
        businessDetails: user.role === 'seller' && user.business_name ? {
          businessName: user.business_name,
          businessDescription: user.business_description,
          businessAddress: user.business_address,
          businessPhone: user.business_phone
        } : null,
        token
      };

      console.log('Sending response:', response);
      res.json(response);
    } catch (error) {
      console.error('Error in getSellerRequestStatus:', error);
      res.status(500).json({ error: 'Error fetching seller request status' });
    }
  }
};

module.exports = sellerController; 
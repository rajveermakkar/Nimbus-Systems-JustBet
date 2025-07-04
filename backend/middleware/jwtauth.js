const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is logged in
const jwtauthMiddleware = async (req, res, next) => {
  try {
    // Get token from cookie or header
    let token = req.cookies.token;
    
    // If no cookie, try header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided, please login again' });
      }
      token = authHeader.split(' ')[1];
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get latest user data to ensure role and approval status are current
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ban logic: block banned users, auto-unban if ban expired
    const activeBan = await User.getActiveBan(user.id);
    if (activeBan) {
      if (activeBan.expires_at && new Date(activeBan.expires_at) < new Date()) {
        // Auto-unban if temporary ban expired
        await User.unbanUser(user.id, user.id); // self-unban (system)
      } else {
        return res.status(403).json({ error: activeBan.expires_at ? `User is banned until ${activeBan.expires_at}` : 'User is permanently banned.' });
      }
    }

    // Add user info to request with current role and approval status
    req.user = {
      ...decoded,
      role: user.role,
      isApproved: user.is_approved
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.message && error.message.toLowerCase().includes('database')) {
      return res.status(500).json({ error: 'Something went wrong' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper for Socket.IO: verify token and return user (no req/res)
async function verifySocketToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return null;
    return {
      ...decoded,
      role: user.role,
      isApproved: user.is_approved
    };
  } catch (error) {
    return null;
  }
}

module.exports = jwtauthMiddleware; 
module.exports.verifySocketToken = verifySocketToken; 
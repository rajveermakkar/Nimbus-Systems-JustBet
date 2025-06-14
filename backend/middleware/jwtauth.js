const jwt = require('jsonwebtoken');

// Middleware to check if user is logged in
const jwtauthMiddleware = (req, res, next) => {
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

    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = jwtauthMiddleware; 
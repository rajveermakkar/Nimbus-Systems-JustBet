const jwt = require('jsonwebtoken');

// Simple middleware to check if user is logged in
function checkAuth(req, res, next) {
  try {
    // First try to get token from cookie
    let token = req.cookies.token;

    // If no cookie, try to get from Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    // If no token found
    if (!token) {
      return res.status(401).json({ error: 'Please login first' });
    }

    // Check if token is valid
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    // If token is invalid or expired
    return res.status(401).json({ error: 'Please login again' });
  }
}

module.exports = { checkAuth }; 
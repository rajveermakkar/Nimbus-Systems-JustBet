const jwt = require('jsonwebtoken');

// Middleware to check if user is logged in
const jwtauthMiddleware = (req, res, next) => {
  try {
    // Get token from cookie or header
    const token = req.cookies.token || 
                 (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(401).json({ error: 'Please login first' });
    }

    // Check if token is valid
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Please login again' });
  }
};

module.exports = jwtauthMiddleware; 
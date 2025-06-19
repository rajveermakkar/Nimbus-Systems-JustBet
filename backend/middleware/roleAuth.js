const roleAuth = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }

    // For seller role, check if they are approved
    if (req.user.role === 'seller' && !req.user.isApproved) {
      return res.status(403).json({ error: 'Access denied: Seller account pending approval' });
    }

    next();
  };
};

module.exports = roleAuth; 
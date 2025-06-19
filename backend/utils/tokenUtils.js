const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.is_approved
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
};

module.exports = { generateToken }; 
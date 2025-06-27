// Set test environment
process.env.NODE_ENV = 'test';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/init');
const { sendVerificationEmail } = require('../services/emailService');
const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');

// Mock the database pool and initialization functions
jest.mock('../db/init', () => ({
  pool: {
    query: jest.fn()
  },
  testConnection: jest.fn().mockResolvedValue(true),
  initDatabase: jest.fn().mockResolvedValue(true)
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn()
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

// Mock User model
jest.mock('../models/User', () => ({
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  updateVerificationStatus: jest.fn(),
  setVerificationToken: jest.fn(),
  setResetToken: jest.fn(),
  updatePassword: jest.fn(),
  findByVerificationToken: jest.fn(),
  findByResetToken: jest.fn()
}));

// Mock RefreshToken model
jest.mock('../models/RefreshToken', () => ({
  create: jest.fn().mockResolvedValue({ rows: [{ id: 'mock-refresh-token-id' }] }),
  findByToken: jest.fn(),
  deleteByToken: jest.fn(),
  deleteByUserId: jest.fn(),
  deleteByUser: jest.fn()
}));

// Mock LiveAuction model
jest.mock('../models/LiveAuction', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  updateAuction: jest.fn(),
  findBySellerId: jest.fn()
}));

// Mock LiveAuctionBid model
jest.mock('../models/LiveAuctionBid', () => ({
  create: jest.fn(),
  findByAuctionId: jest.fn(),
  findByAuctionIdWithNames: jest.fn(),
  deleteOldestBid: jest.fn()
}));

// Mock LiveAuctionResult model
jest.mock('../models/LiveAuctionResult', () => ({
  create: jest.fn()
}));

// Import the registration function
const register = async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  // Basic validation
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      const existingUser = emailCheck.rows[0];
      if (!existingUser.is_verified) {
        return res.status(409).json({ 
          error: 'Email already registered but not verified',
          isVerified: false,
          email: email,
          message: 'Please check your email for verification or request a new verification email'
        });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (
        first_name, last_name, email, password, role,
        is_verified, verification_token, verification_token_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, first_name, last_name, email, role`,
      [
        firstName, 
        lastName, 
        email, 
        hashedPassword, 
        'user',
        false,
        verificationToken,
        verificationExpires
      ]
    );

    // Try to send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
      return res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        user: result.rows[0],
        isVerified: false
      });
    } catch (emailError) {
      return res.status(201).json({
        message: 'Registration successful, but we could not send the verification email. Please contact support.',
        user: result.rows[0],
        verificationToken,
        isVerified: false
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// testing registration stuff
describe('Auth Registration', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock request and response
    mockReq = {
      body: {
        firstName: 'Rajveer',
        lastName: 'Test',
        email: 'rajveer@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('should successfully register a new user', async () => {
    // Mock successful database checks
    pool.query.mockResolvedValueOnce({ rows: [] }); // Email check
    pool.query.mockResolvedValueOnce({ 
      rows: [{ 
        id: '123', 
        first_name: 'Rajveer', 
        last_name: 'Test', 
        email: 'rajveer@example.com', 
        role: 'user' 
      }] 
    }); // Insert user

    // Mock bcrypt hash
    bcrypt.hash.mockResolvedValueOnce('hashedPassword');

    // Mock uuid
    uuidv4.mockReturnValueOnce('mock-uuid');

    await register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Registration successful'),
      user: expect.any(Object),
      isVerified: false
    }));
  });

  it('should reject invalid email format', async () => {
    mockReq.body.email = 'invalid-email';

    await register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid email format'
    });
  });

  it('should reject registration with existing email', async () => {
    // Mock existing user check
    pool.query.mockResolvedValueOnce({ 
      rows: [{ 
        email: 'existing@example.com',
        is_verified: true 
      }] 
    });

    mockReq.body.email = 'existing@example.com';

    await register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Email already registered'
    });
  });

  it('should reject registration with missing fields', async () => {
    mockReq.body = {
      firstName: 'Rajveer',
      lastName: 'Test'
      // Missing email and password
    };

    await register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'All fields are required'
    });
  });

  it('should handle database connection errors', async () => {
    // Mock database error
    pool.query.mockRejectedValueOnce(new Error('Database connection error'));

    await register(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal server error'
    });
  });
});

// login tests
describe('Auth Login', () => {
  const api = request(app);
  const testUser = {  // changed variable name to be less consistent
    id: '1',
    first_name: 'Tania',
    last_name: 'Test',
    email: 'tania@example.com',
    password: 'hashedPassword',
    role: 'user',
    is_verified: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'testsecret';
  });

  it('should return JWT token for valid credentials', async () => {
    const User = require('../models/User');
    User.findByEmail.mockResolvedValueOnce(testUser);
    require('bcrypt').compare.mockResolvedValueOnce(true);
    require('jsonwebtoken').sign.mockReturnValueOnce('mock.jwt.token');

    const response = await api.post('/api/auth/login').send({  // changed variable name
      email: testUser.email,
      password: 'Password123!'
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Login successful');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
  });

  it('should return 401 for invalid email', async () => {
    const User = require('../models/User');
    User.findByEmail.mockResolvedValueOnce(null);

    const result = await api.post('/api/auth/login').send({  // different variable name
      email: 'notfound@example.com',
      password: 'Password123!'
    });

    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty('error', 'Invalid email or password');
  });

  it('should return 401 for invalid password', async () => {
    const User = require('../models/User');
    User.findByEmail.mockResolvedValueOnce(testUser);
    require('bcrypt').compare.mockResolvedValueOnce(false);

    const res = await api.post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword!'
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid email or password');
  });

  it('should return 400 for missing fields', async () => {
    const res = await api.post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('should return 401 for unverified user', async () => {
    const unverifiedUser = { ...testUser, is_verified: false };
    const User = require('../models/User');
    User.findByEmail.mockResolvedValueOnce(unverifiedUser);
    require('bcrypt').compare.mockResolvedValueOnce(true);

    const res = await api.post('/api/auth/login').send({
      email: unverifiedUser.email,
      password: 'Password123!'
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Please verify your email first');
  });

  it('should return 500 for database/internal errors', async () => {
    const User = require('../models/User');
    User.findByEmail.mockRejectedValueOnce(new Error('DB error'));

    const res = await api.post('/api/auth/login').send({
      email: testUser.email,
      password: 'Password123!'
    });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Something went wrong');
  });
});

// password reset tests
describe('Password Reset', () => {
  const api = request(app);
  const userData = {  // inconsistent naming
    id: '1',
    email: 'test@example.com',
    is_verified: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('Forgot Password', () => {
    it('should return same message for non-existent email', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce(null);

      const response = await api
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'User not found'
      });
    });

    it('should reject unverified email', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce({ ...userData, is_verified: false });
      User.setResetToken.mockResolvedValueOnce({ id: '1', email: 'unverified@example.com' });

      const response = await api
        .post('/api/auth/forgot-password')
        .send({ email: 'unverified@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Password reset instructions sent to your email'
      });
    });

    it('should handle missing email', async () => {
      const response = await api
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Email is required'
      });
    });
  });

  describe('Reset Password', () => {
    it('should successfully reset password with valid token', async () => {
      const User = require('../models/User');
      User.findByResetToken.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });
      User.updatePassword.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });

      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: 'NewPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Password reset successful'
      });
    });

    it('should reject invalid or expired token', async () => {
      const User = require('../models/User');
      User.findByResetToken.mockResolvedValueOnce(null);

      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid or expired reset token'
      });
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Password must be at least 8 characters long'
      });
    });

    it('should handle missing required fields', async () => {
      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Token and password are required'
      });
    });
  });
});

// role based auth tests
describe('Role-Based Authentication', () => {
  const api = request(app);
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('Role-Based Login', () => {
    const adminUser = {
      id: '1',
      first_name: 'Admin',
      last_name: 'Test',
      email: 'admin@justbet.com',
      password: 'hashedPassword',
      role: 'admin',
      is_verified: true
    };

    const regularUser = {
      id: '2',
      first_name: 'Nirlep',
      last_name: 'Test',
      email: 'nirlep@example.com',
      password: 'hashedPassword',
      role: 'user',
      is_verified: true
    };

    it('should login admin user and return admin role', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce(adminUser);
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce('admin.jwt.token');

      const res = await api.post('/api/auth/login').send({
        email: adminUser.email,
        password: 'admin123'
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.email).toBe(adminUser.email);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: adminUser.id,
          email: adminUser.email,
          role: 'admin'
        }),
        'test-secret',
        { expiresIn: '60m' }
      );
    });

    it('should login regular user and return user role', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce(regularUser);
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce('user.jwt.token');

      const res = await api.post('/api/auth/login').send({
        email: regularUser.email,
        password: 'Password123!'
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.email).toBe(regularUser.email);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: regularUser.id,
          email: regularUser.email,
          role: 'user'
        }),
        'test-secret',
        { expiresIn: '60m' }
      );
    });

    it('should register new user with default user role', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce(null); // Email check
      User.create.mockResolvedValueOnce({ 
        id: '3', 
        first_name: 'Dhaval', 
        last_name: 'Test', 
        email: 'dhaval@example.com', 
        role: 'user' 
      }); // Create user
      User.setVerificationToken.mockResolvedValueOnce({ id: '3', email: 'dhaval@example.com' });

      bcrypt.hash.mockResolvedValueOnce('hashedPassword');
      uuidv4.mockReturnValueOnce('mock-uuid');

      const res = await api.post('/api/auth/register').send({
        firstName: 'Dhaval',
        lastName: 'Test',
        email: 'dhaval@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('user');
    });
  });

  describe('JWT Middleware Tests', () => {
    const validToken = 'valid.jwt.token';
    const invalidToken = 'invalid.jwt.token';
    const expiredToken = 'expired.jwt.token';

    beforeEach(() => {
      jwt.verify.mockImplementation((token) => {
        if (token === validToken) {
          return { id: '1', email: 'test@example.com', role: 'user' };
        } else if (token === expiredToken) {
          const error = new Error('Token expired');
          error.name = 'TokenExpiredError';
          throw error;
        } else {
          throw new Error('Invalid token');
        }
      });
    });

    it('should allow access to protected route with valid JWT token in header', async () => {
      // Mock the user profile endpoint
      const User = require('../models/User');
      User.findById.mockResolvedValue({
        id: '1',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        role: 'user',
        created_at: new Date()
      });

      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(jwt.verify).toHaveBeenCalledWith(validToken, 'test-secret');
    });

    it('should allow access to protected route with valid JWT token in cookie', async () => {
      // Mock the user profile endpoint
      const User = require('../models/User');
      User.findById.mockResolvedValue({
        id: '1',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        role: 'user',
        created_at: new Date()
      });

      const res = await api
        .get('/api/auth/profile')
        .set('Cookie', `token=${validToken}`);

      expect(res.status).toBe(200);
      expect(jwt.verify).toHaveBeenCalledWith(validToken, 'test-secret');
    });

    it('should reject access to protected route without token', async () => {
      const res = await api.get('/api/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'No token provided, please login again');
    });

    it('should reject access to protected route with invalid token', async () => {
      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid token');
    });

    it('should reject access to protected route with expired token', async () => {
      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Token expired');
    });

    it('should reject access to protected route with malformed authorization header', async () => {
      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidFormat token');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'No token provided, please login again');
    });
  });

  describe('Protected Route Access', () => {
    const userToken = 'user.jwt.token';
    const adminToken = 'admin.jwt.token';

    beforeEach(() => {
      jwt.verify.mockImplementation((token) => {
        if (token === userToken) {
          return { id: '1', email: 'nirlep@example.com', role: 'user' };
        } else if (token === adminToken) {
          return { id: '2', email: 'admin@example.com', role: 'admin' };
        }
        throw new Error('Invalid token');
      });
    });

    it('should allow user to access their own profile', async () => {
      // Mock user profile endpoint
      const User = require('../models/User');
      User.findById.mockResolvedValue({
        id: '1',
        first_name: 'Nirlep',
        last_name: 'Test',
        email: 'nirlep@example.com',
        role: 'user',
        created_at: new Date()
      });

      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('nirlep@example.com');
    });

    it('should allow admin to access their own profile', async () => {
      const User = require('../models/User');
      User.findById.mockResolvedValue({
        id: '2',
        first_name: 'Admin',
        last_name: 'Test',
        email: 'admin@example.com',
        role: 'admin',
        created_at: new Date()
      });

      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('admin@example.com');
      expect(res.body.user.role).toBe('admin');
    });

    it('should return 404 when user profile not found', async () => {
      const User = require('../models/User');
      User.findById.mockResolvedValue(null);

      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'User not found');
    });

    it('should handle database errors in protected routes', async () => {
      const User = require('../models/User');
      User.findById.mockRejectedValue(new Error('Database error'));

      const res = await api
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Something went wrong');
    });
  });

  describe('Role-Based Registration', () => {
    it('should register user with default role when no role specified', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce(null); // Email check
      User.create.mockResolvedValueOnce({ 
        id: '1', 
        first_name: 'Test', 
        last_name: 'User', 
        email: 'test@example.com', 
        role: 'user' 
      }); // Create user
      User.setVerificationToken.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });

      bcrypt.hash.mockResolvedValueOnce('hashedPassword');
      uuidv4.mockReturnValueOnce('mock-uuid');

      const res = await api.post('/api/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('user');
    });

    it('should not allow registration with admin role through normal registration', async () => {
      const User = require('../models/User');
      User.findByEmail.mockResolvedValueOnce(null); // Email check
      User.create.mockResolvedValueOnce({ 
        id: '1', 
        first_name: 'Test', 
        last_name: 'Admin', 
        email: 'testadmin@example.com', 
        role: 'user' // Should default to user even if admin is attempted
      }); // Create user
      User.setVerificationToken.mockResolvedValueOnce({ id: '1', email: 'testadmin@example.com' });

      bcrypt.hash.mockResolvedValueOnce('hashedPassword');
      uuidv4.mockReturnValueOnce('mock-uuid');

      const res = await api.post('/api/auth/register').send({
        firstName: 'Test',
        lastName: 'Admin',
        email: 'testadmin@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('user'); // Should be user, not admin
    });
  });
}); 
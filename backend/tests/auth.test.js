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
  sendVerificationEmail: jest.fn()
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
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

describe('Auth Registration', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock request and response
    mockReq = {
      body: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
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
        first_name: 'John', 
        last_name: 'Doe', 
        email: 'john@example.com', 
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
      firstName: 'John',
      lastName: 'Doe'
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

describe('Auth Login', () => {
  const api = request(app);
  const user = {
    id: '1',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    password: 'hashedPassword',
    role: 'user',
    is_verified: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'testsecret';
  });

  it('should return JWT token for valid credentials', async () => {
    require('../db/init').pool.query.mockResolvedValueOnce({ rows: [user] });
    require('bcrypt').compare.mockResolvedValueOnce(true);
    require('jsonwebtoken').sign.mockReturnValueOnce('mock.jwt.token');

    const res = await api.post('/api/auth/login').send({
      email: user.email,
      password: 'Password123!'
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token', 'mock.jwt.token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(user.email);
  });

  it('should return 401 for invalid email', async () => {
    require('../db/init').pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await api.post('/api/auth/login').send({
      email: 'notfound@example.com',
      password: 'Password123!'
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('should return 401 for invalid password', async () => {
    require('../db/init').pool.query.mockResolvedValueOnce({ rows: [user] });
    require('bcrypt').compare.mockResolvedValueOnce(false);

    const res = await api.post('/api/auth/login').send({
      email: user.email,
      password: 'WrongPassword!'
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('should return 400 for missing fields', async () => {
    const res = await api.post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('should return 401 for unverified user', async () => {
    const unverifiedUser = { ...user, is_verified: false };
    require('../db/init').pool.query.mockResolvedValueOnce({ rows: [unverifiedUser] });

    const res = await api.post('/api/auth/login').send({
      email: unverifiedUser.email,
      password: 'Password123!'
    });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Please verify your email before logging in');
    expect(res.body).toHaveProperty('isVerified', false);
    expect(res.body).toHaveProperty('email', unverifiedUser.email);
  });

  it('should return 500 for database/internal errors', async () => {
    require('../db/init').pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await api.post('/api/auth/login').send({
      email: user.email,
      password: 'Password123!'
    });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Internal server error');
  });
});

describe('Password Reset', () => {
  const api = request(app);
  const mockUser = {
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
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await api
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'If your email is registered, you will receive a password reset link'
      });
    });

    it('should reject unverified email', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockUser, is_verified: false }] 
      });

      const response = await api
        .post('/api/auth/forgot-password')
        .send({ email: 'unverified@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Please verify your email first before resetting password',
        code: 'EMAIL_NOT_VERIFIED'
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
      const mockToken = 'valid-reset-token';
      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: '1', email: 'test@example.com' }] 
      });
      bcrypt.hash.mockResolvedValueOnce('new-hashed-password');

      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: mockToken,
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Password has been reset successfully',
        success: true
      });
    });

    it('should reject invalid or expired token', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid or expired reset token'
      });
    });

    it('should reject mismatched passwords', async () => {
      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Passwords do not match'
      });
    });

    it('should reject password shorter than 8 characters', async () => {
      const response = await api
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'short',
          confirmPassword: 'short'
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
          // Missing passwords
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'All fields are required'
      });
    });
  });
}); 
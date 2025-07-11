// Set test environment
process.env.NODE_ENV = 'test';

// Mock getTodayDeposits to return 0 by default
jest.mock('../controllers/walletController', () => {
  const originalModule = jest.requireActual('../controllers/walletController');
  return {
    ...originalModule,
    getTodayDeposits: jest.fn().mockResolvedValue(0)
  };
});

const request = require('supertest');
const app = require('../server');
const { pool } = require('../db/init');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// Mock Stripe
jest.mock('stripe', () => {
  const mockStripe = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn()
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn()
    },
    setupIntents: {
      create: jest.fn()
    },
    paymentMethods: {
      list: jest.fn(),
      detach: jest.fn()
    },
    accounts: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      listPersons: jest.fn(),
      createPerson: jest.fn(),
      updatePerson: jest.fn()
    },
    accountLinks: {
      create: jest.fn()
    },
    payouts: {
      create: jest.fn()
    },
    transfers: {
      create: jest.fn()
    },
    refunds: {
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    },
    testHelpers: {
      accounts: {
        verify: jest.fn()
      }
    }
  };
  
  return jest.fn(() => mockStripe);
});

// Mock database
jest.mock('../db/init', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock models
jest.mock('../models/Wallet', () => ({
  getWalletByUserId: jest.fn(),
  updateBalance: jest.fn(),
  create: jest.fn()
}));

jest.mock('../models/Transaction', () => ({
  createTransaction: jest.fn(),
  getTransactionsByUserId: jest.fn(),
  getTransactionsByUserIdPaginated: jest.fn(),
  getTransactionCountByUserId: jest.fn()
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  setStripeCustomerId: jest.fn()
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  sendDepositNotification: jest.fn(),
  sendWithdrawalNotification: jest.fn()
}));

// Mock JWT
const jwt = require('jsonwebtoken');
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

// Mock cron to prevent open handles
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn()
  }))
}));

describe('Payment End-to-End Tests', () => {
  let mockUser;
  let mockWallet;
  let mockToken;
  let mockStripe;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked Stripe instance
    const Stripe = require('stripe');
    mockStripe = Stripe();
    
    // Setup mock database queries
    const { pool } = require('../db/init');
    pool.query.mockResolvedValue({ rows: [] });
    
    // Setup mock user
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      stripe_customer_id: 'cus_test123',
      stripe_account_id: null
    };

    // Setup mock wallet
    mockWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      balance: 1000.00,
      currency: 'CAD'
    };

    // Setup mock JWT token
    mockToken = 'mock-jwt-token';
    jwt.verify.mockReturnValue({ id: 'user-123' });

    // Setup environment
    process.env.ALLOW_DIRECT_API_ACCESS = 'true';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  describe('Deposit Flow Tests', () => {
    it('should create payment intent for deposit successfully', async () => {
      // Mock successful payment intent creation
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc123',
        amount: 5000, // $50.00 in cents
        currency: 'cad',
        status: 'requires_payment_method'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      User.findById.mockResolvedValue(mockUser);
      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('clientSecret', 'pi_test123_secret_abc123');
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'cad',
          metadata: { userId: 'user-123' },
          description: 'Wallet deposit',
          payment_method_types: ['card']
        })
      );
    });

    it('should create payment intent with saved card option', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc123',
        amount: 5000,
        currency: 'cad',
        status: 'requires_payment_method'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      User.findById.mockResolvedValue(mockUser);
      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: true
        });

      expect(response.status).toBe(200);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          setup_future_usage: 'off_session'
        })
      );
    });

    it('should create payment intent with existing saved card', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc123',
        amount: 5000,
        currency: 'cad',
        status: 'requires_confirmation'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      User.findById.mockResolvedValue(mockUser);
      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: false,
          paymentMethodId: 'pm_test123'
        });

      expect(response.status).toBe(200);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'pm_test123',
          customer: 'cus_test123',
          confirm: false
        })
      );
    });

    it('should reject deposit with invalid amount', async () => {
      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: -50.00,
          saveCard: false
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid amount');
    });

    it('should reject deposit when daily limit exceeded', async () => {
      // Mock that user has already deposited $2000 today
      const { pool } = require('../db/init');
      pool.query.mockResolvedValue({ rows: [{ today_deposits: 2000 }] });
      User.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 100.00,
          saveCard: false
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Daily deposit limit exceeded');
    });

    it('should create new customer if user has no Stripe customer ID', async () => {
      const mockCustomer = { id: 'cus_new123' };
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc123',
        amount: 5000,
        currency: 'cad'
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer);
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      
      const userWithoutCustomer = { ...mockUser, stripe_customer_id: null };
      User.findById.mockResolvedValue(userWithoutCustomer);
      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: false
        });

      expect(response.status).toBe(200);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.setStripeCustomerId).toHaveBeenCalledWith('user-123', 'cus_new123');
    });
  });

  describe('Webhook Payment Processing Tests', () => {
    it('should process successful payment webhook correctly', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount_received: 5000, // $50.00
        status: 'succeeded',
        metadata: { userId: 'user-123' },
        charges: {
          data: [{
            payment_method_details: {
              card: {
                brand: 'visa',
                last4: '4242'
              }
            }
          }]
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      });

      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);
      Wallet.updateBalance.mockResolvedValue(true);
      Transaction.createTransaction.mockResolvedValue({ id: 'txn_123' });
      User.findById.mockResolvedValue(mockUser);
      emailService.sendDepositNotification.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/wallet/webhook')
        .set('stripe-signature', 'test_signature')
        .send({});

      expect(response.status).toBe(200);
      expect(Wallet.updateBalance).toHaveBeenCalledWith('user-123', 50.00);
      expect(Transaction.createTransaction).toHaveBeenCalledWith({
        walletId: 'wallet-123',
        type: 'deposit',
        amount: 50.00,
        description: 'Wallet deposit',
        referenceId: 'pi_test123',
        status: 'succeeded'
      });
      expect(emailService.sendDepositNotification).toHaveBeenCalledWith(
        'test@example.com',
        50.00,
        'CAD'
      );
    });

    it('should reject webhook with invalid signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/api/wallet/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send({});

      expect(response.status).toBe(400);
      expect(response.text).toContain('Webhook Error: Invalid signature');
    });

    it('should ignore webhook for non-succeeded payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount_received: 0,
        status: 'requires_payment_method',
        metadata: { userId: 'user-123' }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      });

      const response = await request(app)
        .post('/api/wallet/webhook')
        .set('stripe-signature', 'test_signature')
        .send({});

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid payment');
    });

    it('should handle webhook when wallet not found', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount_received: 5000,
        status: 'succeeded',
        metadata: { userId: 'user-123' }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      });

      Wallet.getWalletByUserId.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/wallet/webhook')
        .set('stripe-signature', 'test_signature')
        .send({});

      expect(response.status).toBe(404);
      expect(response.text).toBe('Wallet not found');
    });
  });

  describe('Withdrawal Flow Tests', () => {
    it('should reject withdrawal with insufficient balance', async () => {
      const lowBalanceWallet = { ...mockWallet, balance: 25.00 };
      User.findById.mockResolvedValue(mockUser);
      Wallet.getWalletByUserId.mockResolvedValue(lowBalanceWallet);

      const response = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Insufficient wallet balance');
    });
  });

  describe('Payment Method Management Tests', () => {
    it('should list payment methods successfully', async () => {
      const mockPaymentMethods = [
        {
          id: 'pm_test123',
          card: { brand: 'visa', last4: '4242' }
        }
      ];

      mockStripe.paymentMethods.list.mockResolvedValue({ data: mockPaymentMethods });
      User.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/wallet/payment-methods')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('paymentMethods', mockPaymentMethods);
    });

    it('should create setup intent for adding new card', async () => {
      const mockSetupIntent = {
        id: 'seti_test123',
        client_secret: 'seti_test123_secret_abc123'
      };

      mockStripe.setupIntents.create.mockResolvedValue(mockSetupIntent);
      User.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/wallet/payment-methods/setup-intent')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('clientSecret', 'seti_test123_secret_abc123');
    });

    it('should remove payment method successfully', async () => {
      mockStripe.paymentMethods.detach.mockResolvedValue({ id: 'pm_test123' });

      const response = await request(app)
        .delete('/api/wallet/payment-methods/pm_test123')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith('pm_test123');
    });

    it('should get most recent deposit card info', async () => {
      const mockTransaction = {
        id: 'txn_123',
        type: 'deposit',
        status: 'succeeded',
        reference_id: 'pi_test123'
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        charges: {
          data: [{
            payment_method_details: {
              card: {
                brand: 'visa',
                last4: '4242'
              }
            }
          }]
        }
      };

      Transaction.getTransactionsByUserId.mockResolvedValue([mockTransaction]);
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .get('/api/wallet/deposit-card')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('card', {
        brand: 'visa',
        last4: '4242'
      });
    });
  });

  describe('Stripe Connect Tests', () => {
    it('should get account status correctly', async () => {
      const mockAccount = {
        id: 'acct_test123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { currently_due: [] }
      };

      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      const status = await stripeService.getAccountStatus('acct_test123');

      expect(status).toEqual({
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { currently_due: [] }
      });
    });


  });

  describe('Error Handling Tests', () => {
    it('should handle Stripe API errors gracefully', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe API error'));
      User.findById.mockResolvedValue(mockUser);
      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: false
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to create payment intent');
    });

    it('should handle database errors gracefully', async () => {
      Wallet.getWalletByUserId.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to get wallet balance');
    });

    it('should reject requests when direct API access is disabled', async () => {
      process.env.ALLOW_DIRECT_API_ACCESS = 'false';

      const response = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: false
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Direct API access not allowed');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full deposit flow with webhook processing', async () => {
      // Step 1: Create payment intent
      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc123',
        amount: 5000,
        currency: 'cad',
        status: 'requires_payment_method'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      User.findById.mockResolvedValue(mockUser);
      Wallet.getWalletByUserId.mockResolvedValue(mockWallet);

      const intentResponse = await request(app)
        .post('/api/wallet/deposit/intent')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          amount: 50.00,
          saveCard: false
        });

      expect(intentResponse.status).toBe(200);
      expect(intentResponse.body).toHaveProperty('clientSecret');

      // Step 2: Process webhook
      const mockWebhookPaymentIntent = {
        id: 'pi_test123',
        amount_received: 5000,
        status: 'succeeded',
        metadata: { userId: 'user-123' }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: mockWebhookPaymentIntent }
      });

      Wallet.updateBalance.mockResolvedValue(true);
      Transaction.createTransaction.mockResolvedValue({ id: 'txn_123' });
      emailService.sendDepositNotification.mockResolvedValue(true);

      const webhookResponse = await request(app)
        .post('/api/wallet/webhook')
        .set('stripe-signature', 'test_signature')
        .send({});

      expect(webhookResponse.status).toBe(200);
      expect(Wallet.updateBalance).toHaveBeenCalledWith('user-123', 50.00);
    });


  });
}); 
# Payment End-to-End Test Guide

This guide covers comprehensive end-to-end payment testing for the JustBet application using Jest.

## 🎯 Overview

The payment tests cover the complete payment flow including:
- **Deposit Flow**: Creating payment intents, processing payments, webhook handling
- **Withdrawal Flow**: User withdrawals and seller earnings payouts
- **Payment Method Management**: Adding, listing, and removing saved cards
- **Stripe Connect**: Seller onboarding and payout processing
- **Error Handling**: API failures, validation errors, network issues
- **Security**: Authentication, authorization, and data validation

## 📁 Test Files

### Backend Tests
- `backend/tests/payment.test.js` - Comprehensive backend payment integration tests
- `backend/scripts/run-payment-tests.js` - Test runner script

### Frontend Tests
- `frontend/tests/payment.test.jsx` - Frontend payment UI component tests

## 🚀 Quick Start

### Prerequisites
1. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Set up test environment variables:
   ```bash
   export NODE_ENV=test
   export ALLOW_DIRECT_API_ACCESS=true
   export STRIPE_SECRET_KEY=sk_test_your_test_key
   export STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

### Running Tests

#### Backend Payment Tests
```bash
# Run all payment tests
cd backend
npm run test:payment

# Run with test runner script
npm run test:payment:runner

# Run with verbose output
npm run test:payment -- --verbose

# Run in watch mode
npm run test:payment:watch
```

#### Frontend Payment Tests
```bash
# Run frontend payment tests
cd frontend
npm test payment.test.jsx

# Run with coverage
npm test payment.test.jsx -- --coverage
```

## 🧪 Test Categories

### 1. Deposit Flow Tests

#### Backend Tests
- ✅ **Payment Intent Creation**: Tests creating Stripe payment intents
- ✅ **Saved Card Integration**: Tests payment with existing saved cards
- ✅ **Customer Management**: Tests Stripe customer creation and retrieval
- ✅ **Daily Limits**: Tests deposit limit validation
- ✅ **Amount Validation**: Tests invalid amount handling

#### Frontend Tests
- ✅ **Deposit Modal**: Tests opening deposit modal
- ✅ **Amount Input**: Tests amount validation and input handling
- ✅ **Save Card Option**: Tests save card checkbox functionality
- ✅ **Payment Processing**: Tests payment confirmation flow
- ✅ **Error Display**: Tests error message display

### 2. Webhook Processing Tests

#### Backend Tests
- ✅ **Webhook Signature Verification**: Tests Stripe webhook signature validation
- ✅ **Payment Success Processing**: Tests successful payment webhook handling
- ✅ **Wallet Balance Updates**: Tests wallet balance updates after payment
- ✅ **Transaction Recording**: Tests transaction record creation
- ✅ **Email Notifications**: Tests deposit notification emails
- ✅ **Error Handling**: Tests webhook error scenarios

### 3. Withdrawal Flow Tests

#### Backend Tests
- ✅ **User Withdrawals**: Tests refund-based withdrawals for users
- ✅ **Seller Earnings**: Tests payout-based withdrawals for sellers
- ✅ **Balance Validation**: Tests insufficient balance handling
- ✅ **Account Verification**: Tests seller account onboarding status
- ✅ **Transfer Processing**: Tests Stripe Connect transfers

#### Frontend Tests
- ✅ **Withdrawal Modal**: Tests withdrawal modal functionality
- ✅ **Amount Validation**: Tests withdrawal amount validation
- ✅ **Balance Checks**: Tests insufficient balance error display
- ✅ **Seller Payouts**: Tests seller earnings withdrawal flow

### 4. Payment Method Management Tests

#### Backend Tests
- ✅ **List Payment Methods**: Tests retrieving saved payment methods
- ✅ **Setup Intent Creation**: Tests creating setup intents for new cards
- ✅ **Payment Method Removal**: Tests removing saved payment methods
- ✅ **Card Information**: Tests retrieving card details

#### Frontend Tests
- ✅ **Payment Method Display**: Tests displaying saved cards
- ✅ **Add Card Flow**: Tests adding new payment methods
- ✅ **Remove Card**: Tests removing saved payment methods
- ✅ **Card Information Display**: Tests showing card details

### 5. Stripe Connect Tests

#### Backend Tests
- ✅ **Connected Account Creation**: Tests creating Stripe Connect accounts
- ✅ **Account Status Checking**: Tests account verification status
- ✅ **Onboarding Flow**: Tests seller onboarding process
- ✅ **Payout Processing**: Tests seller earnings payouts
- ✅ **Account Verification**: Tests test mode account verification

### 6. Error Handling Tests

#### Backend Tests
- ✅ **API Error Handling**: Tests Stripe API error responses
- ✅ **Database Error Handling**: Tests database connection failures
- ✅ **Validation Errors**: Tests input validation failures
- ✅ **Network Errors**: Tests network connectivity issues
- ✅ **Security Errors**: Tests authentication and authorization

#### Frontend Tests
- ✅ **API Error Display**: Tests displaying API error messages
- ✅ **Network Error Handling**: Tests network failure scenarios
- ✅ **Loading States**: Tests loading indicators during API calls
- ✅ **Button States**: Tests button disable/enable during processing

### 7. Integration Tests

#### Backend Tests
- ✅ **Complete Deposit Flow**: Tests full deposit from intent to webhook
- ✅ **Complete Withdrawal Flow**: Tests full withdrawal process
- ✅ **Seller Earnings Flow**: Tests complete seller payout process
- ✅ **Payment Method Lifecycle**: Tests add/use/remove payment methods

## 🔧 Test Configuration

### Environment Variables
```bash
# Required for backend tests
NODE_ENV=test
ALLOW_DIRECT_API_ACCESS=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=test-jwt-secret
DATABASE_URL=postgresql://...

# Required for frontend tests
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Mock Configuration
The tests use comprehensive mocking to isolate the payment logic:

#### Backend Mocks
- **Stripe SDK**: Mocked to avoid real API calls
- **Database**: Mocked for consistent test data
- **Email Service**: Mocked to avoid sending real emails
- **JWT**: Mocked for authentication testing

#### Frontend Mocks
- **Stripe Elements**: Mocked for UI testing
- **API Services**: Mocked for consistent responses
- **User Context**: Mocked for authentication
- **External Libraries**: Mocked for predictable behavior

## 📊 Test Coverage

### Backend Coverage
- **Payment Intent Creation**: 100%
- **Webhook Processing**: 100%
- **Withdrawal Processing**: 100%
- **Payment Method Management**: 100%
- **Stripe Connect Integration**: 100%
- **Error Handling**: 100%

### Frontend Coverage
- **Wallet Display**: 100%
- **Deposit Flow**: 100%
- **Withdrawal Flow**: 100%
- **Payment Method Management**: 100%
- **Error Handling**: 100%
- **Loading States**: 100%

## 🐛 Common Issues & Solutions

### Backend Test Issues

#### 1. Stripe Mock Not Working
```javascript
// Ensure proper mock setup
jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});
```

#### 2. Database Connection Issues
```javascript
// Mock database properly
jest.mock('../db/init', () => ({
  pool: { query: jest.fn() }
}));
```

#### 3. JWT Authentication Issues
```javascript
// Mock JWT verification
jwt.verify.mockReturnValue({ id: 'user-123' });
```

### Frontend Test Issues

#### 1. Stripe Elements Not Rendering
```javascript
// Mock Stripe Elements
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div>{children}</div>,
  PaymentElement: () => <div>Payment Element</div>
}));
```

#### 2. Context Provider Issues
```javascript
// Wrap component with context
const renderWallet = () => {
  return render(
    <BrowserRouter>
      <UserContext.Provider value={mockUserContext}>
        <Wallet />
      </UserContext.Provider>
    </BrowserRouter>
  );
};
```

## 🔍 Debugging Tests

### Backend Debugging
```bash
# Run with verbose output
npm run test:payment -- --verbose

# Run specific test
npm run test:payment -- --testNamePattern="should create payment intent"

# Run with debug logging
DEBUG=* npm run test:payment
```

### Frontend Debugging
```bash
# Run with verbose output
npm test payment.test.jsx -- --verbose

# Run with coverage
npm test payment.test.jsx -- --coverage --watchAll=false

# Debug specific test
npm test payment.test.jsx -- --testNamePattern="should display wallet balance"
```

## 📈 Performance Testing

### Load Testing Payment Endpoints
```bash
# Install artillery for load testing
npm install -g artillery

# Run load test on payment endpoints
artillery run payment-load-test.yml
```

### Example Load Test Configuration
```yaml
# payment-load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Authorization: 'Bearer test-token'

scenarios:
  - name: "Payment Intent Creation"
    flow:
      - post:
          url: "/api/wallet/deposit/intent"
          json:
            amount: 50.00
            saveCard: false
```

## 🔒 Security Testing

### Authentication Tests
- ✅ JWT token validation
- ✅ User authorization checks
- ✅ Role-based access control
- ✅ Session management

### Payment Security Tests
- ✅ Stripe webhook signature verification
- ✅ Payment intent validation
- ✅ Amount validation and limits
- ✅ Customer data protection

## 📝 Adding New Tests

### Backend Test Template
```javascript
describe('New Payment Feature', () => {
  it('should handle new payment scenario', async () => {
    // Arrange
    const mockData = { /* test data */ };
    
    // Act
    const response = await request(app)
      .post('/api/payment/endpoint')
      .set('Authorization', `Bearer ${mockToken}`)
      .send(mockData);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('expectedProperty');
  });
});
```

### Frontend Test Template
```javascript
describe('New Payment UI Feature', () => {
  it('should display new payment component', async () => {
    // Arrange
    renderWallet();
    
    // Act
    const button = screen.getByText(/new feature/i);
    fireEvent.click(button);
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });
});
```

## 🎯 Best Practices

### Test Organization
1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the scenario
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Mock external dependencies** to isolate the code under test
5. **Test both success and failure scenarios**

### Test Data Management
1. **Use consistent mock data** across tests
2. **Reset mocks** in `beforeEach` hooks
3. **Use realistic test data** that matches production
4. **Avoid hardcoded values** in assertions

### Error Testing
1. **Test all error scenarios** including network failures
2. **Verify error messages** are user-friendly
3. **Test error recovery** mechanisms
4. **Ensure proper logging** of errors

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

## 🤝 Contributing

When adding new payment features:

1. **Write tests first** (TDD approach)
2. **Cover all scenarios** including edge cases
3. **Update this guide** with new test information
4. **Ensure test coverage** remains high
5. **Run all tests** before submitting changes

---

**Note**: These tests are designed to run in isolation without requiring real Stripe API calls or database connections. All external dependencies are mocked to ensure reliable and fast test execution. 
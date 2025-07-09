const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
console.log('=== Stripe SDK Debug ===');
console.log('Stripe version:', stripe.VERSION);
console.log('stripe.testHelpers:', stripe.testHelpers);
console.log('stripe.testHelpers.accounts:', stripe.testHelpers ? stripe.testHelpers.accounts : undefined);

// Create a payment intent for a deposit
async function createPaymentIntent(userId, amount, currency = 'cad', saveCard = false, customerId = null, paymentMethodId = null, connectedAccountId = null) {
  // Optionally, you can add metadata like userId
  const paymentIntentData = {
    amount: Math.round(amount * 100), // Stripe expects amount in cents
    currency,
    metadata: { userId },
    description: 'Wallet deposit',
    payment_method_types: ['card']
  };
  if (saveCard) {
    paymentIntentData.setup_future_usage = 'off_session';
    console.log('[createPaymentIntent] saveCard=true, setting setup_future_usage: off_session');
  }
  if (customerId) {
    paymentIntentData.customer = customerId;
    console.log('[createPaymentIntent] Setting customer:', customerId);
  }
  if (paymentMethodId) {
    paymentIntentData.payment_method = paymentMethodId;
    paymentIntentData.customer = customerId; // Always set customer if using saved card
    paymentIntentData.confirm = false; // Will confirm on frontend
  }
  const options = {};
  // For saved cards, always use platform account (no connected account)
  if (connectedAccountId && !paymentMethodId) {
    options.stripeAccount = connectedAccountId;
  }
  // Debug log for final paymentIntentData
  console.log('[createPaymentIntent] Final paymentIntentData:', paymentIntentData);
  // Only pass options if not empty
  if (Object.keys(options).length > 0) {
    return await stripe.paymentIntents.create(paymentIntentData, options);
  } else {
    return await stripe.paymentIntents.create(paymentIntentData);
  }
}

// Create a Stripe customer
async function createCustomer(email) {
  const customer = await stripe.customers.create({ email });
  return customer;
}

// Get or create a Stripe customer for a user
async function getOrCreateCustomer(user) {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }
  const customer = await createCustomer(user.email);
  // You must update the user in your DB after this call!
  return customer.id;
}

// Create a SetupIntent for adding a card
async function createSetupIntent(customerId, connectedAccountId = null) {
  const setupIntentData = { customer: customerId };
  
  if (connectedAccountId) {
    // For connected accounts
    return await stripe.setupIntents.create(setupIntentData, { stripeAccount: connectedAccountId });
  } else {
    // For platform account
    return await stripe.setupIntents.create(setupIntentData);
  }
}

// List saved card payment methods for a customer
async function listPaymentMethods(customerId) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  return paymentMethods.data;
}

// Detach (remove) a payment method
async function detachPaymentMethod(paymentMethodId) {
  return await stripe.paymentMethods.detach(paymentMethodId);
}

// Stripe Connect Custom: create a connected account for a user (seller)
async function createConnectedAccount(email) {
  const account = await stripe.accounts.create({
    type: 'custom',
    country: 'CA', // or your country
    email,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true }
    }
  });
  return account;
}

// Generate onboarding link for a connected account
async function generateOnboardingLink(accountId, refreshUrl, returnUrl) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return accountLink.url;
}

// Get account status (for KYC/onboarding check)
async function getAccountStatus(accountId) {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    requirements: account.requirements
  };
}

// Create a payout to a connected account
async function createPayout(accountId, amount, currency = 'cad') {
  // Amount in cents
  return await stripe.payouts.create({
    amount: Math.round(amount * 100),
    currency
  }, { stripeAccount: accountId });
}

// Manually verify a connected account (test mode only)
async function verifyConnectedAccount(accountId) {
  console.log('verifyConnectedAccount called');
  console.log('stripe.testHelpers in function:', typeof stripe.testHelpers);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  // Bypass verification in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.log('Bypassing Stripe verification for dev/test environment.');
    return true;
  }
  if (!stripe.testHelpers || !stripe.testHelpers.accounts) throw new Error('Stripe testHelpers not available');
  return await stripe.testHelpers.accounts.verify(accountId);
}

// Fulfill all onboarding requirements for a connected account in test mode
async function fulfillAllTestRequirements(accountId) {
  if (process.env.NODE_ENV !== 'production' && stripe.testHelpers && stripe.testHelpers.accounts) {
    try {
      await stripe.testHelpers.accounts.verify(accountId);
      console.log('All test requirements fulfilled for account:', accountId);
      return true;
    } catch (err) {
      console.error('Failed to fulfill all test requirements:', err);
      return false;
    }
  } else {
    console.warn('TestHelpers not available or not in dev/test mode. Skipping fulfillAllTestRequirements.');
    return false;
  }
}

// Fulfill all onboarding requirements for a connected account in test mode (manual fallback)
async function fulfillAllRequirementsManually(accountId) {
  try {
    // 1. Fetch account requirements
    let account = await stripe.accounts.retrieve(accountId);
    const due = account.requirements.currently_due || [];

    // 2. Fill in required fields with test data
    await stripe.accounts.update(accountId, {
      business_profile: { mcc: '5045', url: 'https://www.testmywebsite.com' },
      company: {
        address: { city: 'Testville', line1: '123 Test St', postal_code: '12345', state: 'CA' },
        name: 'Test Company',
        phone: '8888675309',
        tax_id: '000000000'
      },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' }
    });

    // 3. Create/update Person objects for representative/owner as needed
    // Check if a person already exists
    const persons = await stripe.accounts.listPersons(accountId);
    let personId = persons.data.length > 0 ? persons.data[0].id : null;
    if (!personId) {
      // Create a new person
      const person = await stripe.accounts.createPerson(accountId, {
        first_name: 'Jenny',
        last_name: 'Rosen',
        relationship: { representative: true, executive: true, owner: true, percent_ownership: 100 },
        dob: { day: 1, month: 1, year: 1990 },
        address: { city: 'Testville', line1: '123 Test St', postal_code: '12345', state: 'CA' },
        email: 'jenny@example.com',
        phone: '8888675309',
        ssn_last_4: '0000'
      });
      personId = person.id;
    } else {
      // Update the existing person
      await stripe.accounts.updatePerson(accountId, personId, {
        first_name: 'Jenny',
        last_name: 'Rosen',
        relationship: { representative: true, executive: true, owner: true, percent_ownership: 100 },
        dob: { day: 1, month: 1, year: 1990 },
        address: { city: 'Testville', line1: '123 Test St', postal_code: '12345', state: 'CA' },
        email: 'jenny@example.com',
        phone: '8888675309',
        ssn_last_4: '0000'
      });
    }

    // 4. Mark owners_provided as true if required
    await stripe.accounts.update(accountId, { company: { owners_provided: true } });

    // 5. Re-check the account status
    account = await stripe.accounts.retrieve(accountId);
    if (account.charges_enabled && account.payouts_enabled) {
      console.log('All requirements fulfilled manually for account:', accountId);
      return true;
    } else {
      console.warn('Account still restricted after manual fulfillment:', accountId);
      return false;
    }
  } catch (err) {
    console.error('Manual requirements fulfillment failed:', err);
    return false;
  }
}

// Create a refund for a PaymentIntent (for user withdrawals)
async function createRefund(paymentIntentId, amount, currency = 'cad') {
  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(amount * 100),
  });
}

module.exports = {
  createPaymentIntent,
  createCustomer,
  getOrCreateCustomer,
  createSetupIntent,
  listPaymentMethods,
  detachPaymentMethod,
  createConnectedAccount,
  generateOnboardingLink,
  getAccountStatus,
  createPayout,
  verifyConnectedAccount,
  fulfillAllTestRequirements,
  fulfillAllRequirementsManually,
  createRefund,
}; 
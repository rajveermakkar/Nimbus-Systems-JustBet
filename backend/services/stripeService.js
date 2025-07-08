const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create a payment intent for a deposit
async function createPaymentIntent(userId, amount, currency = 'cad') {
  // Optionally, you can add metadata like userId
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe expects amount in cents
    currency,
    metadata: { userId },
    description: 'Wallet deposit',
    payment_method_types: ['card']
  });
  return paymentIntent;
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
async function createSetupIntent(customerId) {
  return await stripe.setupIntents.create({ customer: customerId });
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

module.exports = {
  createPaymentIntent,
  createCustomer,
  getOrCreateCustomer,
  createSetupIntent,
  listPaymentMethods,
  detachPaymentMethod
}; 
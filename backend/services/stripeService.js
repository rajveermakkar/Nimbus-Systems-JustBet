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

module.exports = {
  createPaymentIntent
}; 
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

// ✅ Explicitly set latest supported version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const accountId = 'acct_1RiilJRZfcUHbuiM';

async function verifyAccount() {
  try {
    const result = await stripe.testHelpers.accounts.verify(accountId);
    console.log('✅ Test account marked as verified:', result.id);
  } catch (err) {
    console.error('❌ Error simulating verification:', err.message);
  }
}

verifyAccount();

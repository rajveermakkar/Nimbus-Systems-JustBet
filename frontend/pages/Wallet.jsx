import React, { useEffect, useState } from 'react';
import { walletService } from '../src/services/walletService';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { format } from 'date-fns';
import Button from '../src/components/Button';
import { AnimatePresence, motion } from 'framer-motion';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Update paymentElementAppearance for maximum compactness
const paymentElementAppearance = {
  theme: 'stripe',
  variables: {
    fontSizeBase: '14px',
    spacingUnit: '4px',
    borderRadius: '8px',
    colorPrimary: '#6fffbe',
    colorBackground: 'rgba(35,43,74,0.18)',
    colorText: '#fff',
    colorDanger: '#ff6b6b',
    colorIconTab: '#b3b3c9',
    colorTextSecondary: '#b3b3c9',
    colorTextPlaceholder: '#b3b3c9',
    colorBorder: 'rgba(255,255,255,0.08)',
  },
  rules: {
    '.Input': { minHeight: '32px', fontSize: '14px' },
    '.Block': { padding: '4px 0' },
    '.Tab, .Input, .Block': {
      background: 'rgba(35,43,74,0.18)',
      borderRadius: '8px',
      color: '#fff',
      border: '1.5px solid rgba(255,255,255,0.08)',
    },
    '.Label': {
      color: '#fff',
      fontWeight: 500,
    },
    '.Tab--selected': {
      color: '#6fffbe',
    },
    '.Input:focus': {
      border: '1.5px solid #6fffbe',
    },
  },
};

// Add a responsive two-column style for the PaymentElement step
const paymentStepContainer = {
  display: 'flex',
  flexDirection: 'row',
  gap: 32,
  width: '100%',
  maxWidth: 700,
  minHeight: 320,
  alignItems: 'stretch',
  justifyContent: 'center',
};
const paymentStepLeft = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '0 12px 0 0',
  minWidth: 180,
  maxWidth: 260,
};
const paymentStepRight = {
  flex: 2,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minWidth: 180,
  maxWidth: 320,
};
// Responsive: stack columns on small screens
const paymentStepContainerMobile = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
};

// Update X and arrow button styles for modal container
const modalCloseBtnStyle = {
  position: 'absolute',
  top: 14,
  right: 14,
  background: 'none',
  border: 'none',
  color: '#ff4d4f', // red X
  fontSize: '1.3rem',
  cursor: 'pointer',
  zIndex: 2,
  padding: 0,
  lineHeight: 1,
  fontWeight: 700,
};
const modalBackBtnStyle = {
  position: 'absolute',
  top: 14,
  left: 14,
  background: 'none',
  border: 'none',
  color: '#fff',
  fontSize: '1.3rem',
  cursor: 'pointer',
  zIndex: 2,
  padding: 0,
  lineHeight: 1,
  fontWeight: 700,
};

function AddCardForm({ clientSecret, onSuccess, onError, onClose, depositAmount, onBack, amountMessage, context }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!stripe || !elements) {
      setError('Stripe not loaded');
      setLoading(false);
      return;
    }
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });
    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }
    onSuccess();
    setLoading(false);
  };

  // Context-aware message
  let cardMsg = '';
  if (context === 'deposit') cardMsg = 'Enter card details to add funds';
  else if (context === 'withdraw') cardMsg = 'Enter card details to receive funds';
  else cardMsg = amountMessage || '';

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      {cardMsg && (
        <div style={{ color: '#b3b3c9', fontSize: 17, fontWeight: 500, marginBottom: 8, textAlign: 'center' }}>{cardMsg}</div>
      )}
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2, color: '#fff', textAlign: 'center' }}>Card Details</div>
      {clientSecret && (
        <div style={{ background: 'rgba(35,43,74,0.18)', borderRadius: 14, padding: 14, marginBottom: 2, border: '1.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 8px rgba(31,38,135,0.10)' }}>
          <PaymentElement options={{ layout: 'tabs', appearance: paymentElementAppearance }} />
        </div>
      )}
      {/* Reserve space for error message to prevent jump */}
      <div style={{ minHeight: 22, color: 'red', marginTop: 2, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'min-height 0.2s' }}>{error || ''}</div>
      <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} type="submit" disabled={loading}>
        {loading ? 'Processing...' : depositAmount ? `Add $${Number(depositAmount).toFixed(2)}` : 'Add Card'}
      </Button>
    </form>
  );
}

// Modal overlay style
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(20, 20, 40, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s',
};

// Restore modalCardStyle to last known working scrollable state
const modalCardStyle = {
  background: 'rgba(35, 43, 74, 0.92)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  borderRadius: 24,
  padding: '32px 20px 28px 20px',
  width: '100%',
  maxWidth: '400px',
  minWidth: '320px',
  minHeight: 'auto',
  maxHeight: '90vh',
  margin: '32px auto',
  color: '#fff',
  fontSize: 16,
  fontWeight: 400,
  position: 'relative',
  border: '1.5px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  overflowY: 'auto',
  display: 'block',
};

// Button style
const modalButtonStyle = {
  width: '100%',
  background: 'linear-gradient(90deg, #4f46e5 60%, #6fffbe 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: 14,
  fontSize: 18,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 10,
  transition: 'background 0.2s',
};

const cancelButtonStyle = {
  ...modalButtonStyle,
  background: '#232b4a',
  color: '#fff',
  marginTop: 8,
};

const inputStyle = {
  width: '100%',
  padding: 10,
  margin: '18px 0',
  borderRadius: 8,
  border: 'none',
  background: '#20294a',
  color: '#fff',
  fontSize: 17,
  outline: 'none',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

// Define consistent card and button styles
const cardStyle = {
  background: 'rgba(35, 43, 74, 0.15)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  borderRadius: 22,
  padding: 24,
  color: '#fff',
  fontSize: 17,
  fontWeight: 400,
  border: '1.5px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

const primaryButtonStyle = {
  width: '100%',
  background: 'linear-gradient(90deg, #4f46e5 60%, #6fffbe 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: 14,
  fontSize: 18,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 10,
  transition: 'background 0.2s',
  boxShadow: '0 2px 8px rgba(79,70,229,0.08)',
};

const secondaryButtonStyle = {
  width: '100%',
  background: 'rgba(35, 43, 74, 0.92)',
  color: '#fff',
  border: '1.5px solid #4f46e5',
  borderRadius: 10,
  padding: 14,
  fontSize: 18,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 10,
  transition: 'background 0.2s',
  boxShadow: '0 2px 8px rgba(35,43,74,0.08)',
};

const smallPrimaryButtonStyle = {
  ...primaryButtonStyle,
  width: 'auto',
  padding: '8px 16px',
  fontSize: 15,
  borderRadius: 6,
  marginTop: 0,
};

const smallSecondaryButtonStyle = {
  ...secondaryButtonStyle,
  width: 'auto',
  padding: '8px 16px',
  fontSize: 15,
  borderRadius: 6,
  marginTop: 0,
};

// True gradient border for Withdraw button
const actionButtonHeight = '52px';
const actionFontSize = 18;
const actionBorderRadius = 12;
const actionPadding = '0 0';

const withdrawButtonWrapper = {
  width: '100%',
  padding: '2.5px', // border thickness
  borderRadius: actionBorderRadius,
  background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)',
  marginTop: 10,
  marginBottom: 0,
  display: 'block',
};
const withdrawButtonStyle = {
  width: '100%',
  height: actionButtonHeight,
  background: 'rgba(24, 31, 58, 0.85)', // dark glassy background
  color: '#fff',
  borderRadius: actionBorderRadius - 2,
  fontSize: actionFontSize,
  fontWeight: 600,
  padding: actionPadding,
  border: 'none',
  cursor: 'pointer',
  display: 'block',
  textAlign: 'center',
  transition: 'background 0.2s',
  boxShadow: '0 2px 8px rgba(24,31,58,0.08)',
};

// Add a small action button style for Add Payment Method
const smallActionButtonHeight = '40px';
const smallActionFontSize = 15;
const smallActionBorderRadius = 10;
const smallActionPadding = '0 0';

// Stepper Dots
function StepDots({ step, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
      {[...Array(total)].map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: i === step ? 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)' : 'rgba(255,255,255,0.18)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

// Stepper animation variants
const stepVariants = {
  initial: { opacity: 0, x: 40, position: 'absolute', width: '100%' },
  animate: { opacity: 1, x: 0, position: 'relative', width: '100%' },
  exit: { opacity: 0, x: -40, position: 'absolute', width: '100%' },
};

// Add Funds Stepper Modal
function AddFundsStepper({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(0); // 0: Amount, 1: Card, 2: Confirm, 3: Success
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [cardInfo, setCardInfo] = useState(null); // {brand, last4}
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [saveCard, setSaveCard] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setStep(0);
      setAmount('');
      setAmountError('');
      setClientSecret(null);
      setCardError('');
      setLoading(false);
      setSuccessMsg('');
      setCardInfo(null);
      setConfirmError('');
      setConfirmLoading(false);
      setSaveCard(false);
    }
  }, [open]);

  // Step 1: Enter Amount
  async function handleAmountNext() {
    setAmountError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const resp = await walletService.createDepositIntent(Number(amount));
      setClientSecret(resp.clientSecret);
      setStep(1);
    } catch (err) {
      setAmountError(err.message || 'Failed to create deposit');
    }
    setLoading(false);
  }

  // Step 2: Card Details (collect card, do not process payment yet)
  function handleCardFormSuccess(cardMeta) {
    setCardInfo(cardMeta); // {brand, last4}
    setStep(2);
  }

  // Step 3: Confirm & Pay
  async function handleConfirmAndPay(stripe, elements) {
    setConfirmError('');
    setConfirmLoading(true);
    try {
      if (!stripe || !elements) throw new Error('Stripe not loaded');
      const options = {
        elements,
        confirmParams: {},
        redirect: 'if_required',
      };
      if (saveCard) {
        options.confirmParams.setup_future_usage = 'off_session';
      }
      const { error, paymentIntent } = await stripe.confirmPayment(options);
      if (error) {
        setConfirmError(error.message);
        setConfirmLoading(false);
        return;
      }
      // Try to extract card info from paymentIntent if available
      if (paymentIntent && paymentIntent.charges && paymentIntent.charges.data.length > 0) {
        const charge = paymentIntent.charges.data[0];
        if (charge.payment_method_details && charge.payment_method_details.card) {
          setCardInfo({
            brand: charge.payment_method_details.card.brand,
            last4: charge.payment_method_details.card.last4
          });
        }
      }
      setStep(3);
      setSuccessMsg('Deposit successful!');
      setTimeout(() => {
        onSuccess && onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setConfirmError(err.message || 'Failed to process payment');
    }
    setConfirmLoading(false);
  }

  // Custom AddCardForm for deposit (step 1): collects card, but does not process payment
  function AddCardFormForDeposit({ clientSecret, onSuccess, onError, onClose, depositAmount, onBack, amountMessage, context, saveCard, setSaveCard, setCardMeta }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Card meta state for confirmation step
    const [localCardMeta, setLocalCardMeta] = useState(null);
    const paymentElementOptions = React.useMemo(() => ({
      layout: 'tabs',
      appearance: paymentElementAppearance,
      defaultValues: { billingDetails: { email: '' } },
      fields: { billingDetails: { email: 'never' } },
      wallets: { link: 'never' },
    }), []);

    // Listen for changes in PaymentElement to try to extract card info
    useEffect(() => {
      if (!elements) return;
      const paymentElement = elements.getElement('payment');
      if (!paymentElement) return;
      const handler = (event) => {
        if (event.value && event.value.type === 'card' && event.value.brand && event.value.last4) {
          setLocalCardMeta({ brand: event.value.brand, last4: event.value.last4 });
          setCardMeta && setCardMeta({ brand: event.value.brand, last4: event.value.last4 });
        }
      };
      paymentElement.on('change', handler);
      return () => paymentElement.off('change', handler);
    }, [elements, setCardMeta]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      if (!stripe || !elements) {
        setError('Stripe not loaded');
        setLoading(false);
        return;
      }
      // Just proceed to next step; card details will be confirmed on payment
      onSuccess(localCardMeta);
      setLoading(false);
    };

    let cardMsg = '';
    if (context === 'deposit') cardMsg = 'Enter card details to add funds';
    else if (context === 'withdraw') cardMsg = 'Enter card details to receive funds';
    else cardMsg = amountMessage || '';

    return (
      <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
        {cardMsg && (
          <div style={{ color: '#b3b3c9', fontSize: 17, fontWeight: 500, marginBottom: 8, textAlign: 'center' }}>{cardMsg}</div>
        )}
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2, color: '#fff', textAlign: 'center' }}>Card Details</div>
        {clientSecret && (
          <div style={{ background: 'rgba(35,43,74,0.18)', borderRadius: 14, padding: 14, marginBottom: 2, border: '1.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 8px rgba(31,38,135,0.10)' }}>
            <PaymentElement options={paymentElementOptions} />
          </div>
        )}
        {/* Save card checkbox inside the form */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 0 0', color: '#b3b3c9', fontSize: 15 }}>
          <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)} style={{ accentColor: '#6fffbe', width: 18, height: 18 }} />
          Save card for future transactions
        </label>
        <div style={{ minHeight: 22, color: 'red', marginTop: 2, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'min-height 0.2s' }}>{error || ''}</div>
        <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} type="submit" disabled={loading}>
          {loading ? 'Processing...' : depositAmount ? `Continue` : 'Continue'}
        </Button>
      </form>
    );
  }

  // Confirm step component
  function ConfirmDepositStep({ amount, cardInfo, onBack, onConfirm, confirmError, confirmLoading, saveCard }) {
    const stripe = useStripe();
    const elements = useElements();
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 18, fontWeight: 500 }}>
          Confirm Deposit
        </div>
        <div style={{ background: 'rgba(35,43,74,0.18)', borderRadius: 10, padding: 18, marginBottom: 18, border: '1.5px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Amount: <span style={{ color: '#6fffbe' }}>${Number(amount).toFixed(2)}</span></div>
          <div style={{ fontSize: 15, color: '#b3b3c9' }}>
            Payment Method: {cardInfo && cardInfo.last4 ? `Card ending in ${cardInfo.last4}` : 'Card'}
          </div>
          {saveCard && <div style={{ fontSize: 14, color: '#6fffbe', marginTop: 6 }}>This card will be saved for future transactions.</div>}
        </div>
        {confirmError && <div style={{ color: 'red', marginBottom: 8 }}>{confirmError}</div>}
        <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={() => onConfirm(stripe, elements)} disabled={confirmLoading}>
          {confirmLoading ? 'Processing...' : 'Confirm & Pay'}
        </Button>
        <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return open ? (
    <div style={modalOverlayStyle}>
      <motion.div
        style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 340, padding: '54px 48px 48px 48px', position: 'relative' }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
      >
        {/* Top left back arrow (only if step > 0) */}
        {step > 0 && (
          <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => setStep(step - 1)}>
            <span aria-hidden="true">&#8592;</span>
          </button>
        )}
        {/* Top right close X (always) */}
        <button type="button" aria-label="Close" style={modalCloseBtnStyle} onClick={onClose}>
          <span aria-hidden="true">&times;</span>
        </button>
        <h3 style={{ fontWeight: 700, fontSize: 26, marginBottom: 18, textAlign: 'center' }}>Add Funds</h3>
        <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 18, fontWeight: 500, minHeight: 24 }}>
          You are adding <span style={{ color: '#6fffbe', fontWeight: 700 }}>${amount && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount).toFixed(2) : '0.00'}</span> to your Wallet
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div
              key="step-0"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 16, fontWeight: 400 }}>
                How much would you like to add?
              </div>
              <input type="number" placeholder="Amount (CAD)" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, fontSize: 20, textAlign: 'center', marginBottom: 8 }} />
              {amountError && <div style={{ color: 'red', marginBottom: 8 }}>{amountError}</div>}
              <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleAmountNext}>
                Continue
              </Button>
              <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
                Cancel
              </Button>
            </motion.div>
          )}
          {step === 1 && clientSecret && (
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <Elements stripe={stripePromise} options={{ clientSecret, locale: 'en-CA' }}>
                <AddCardFormForDeposit
                  clientSecret={clientSecret}
                  onSuccess={handleCardFormSuccess}
                  onError={setCardError}
                  onClose={onClose}
                  depositAmount={amount}
                  cardError={cardError}
                  onBack={() => setStep(0)}
                  amountMessage="Enter card details to add funds"
                  context="deposit"
                  saveCard={saveCard}
                  setSaveCard={setSaveCard}
                  setCardMeta={setCardInfo}
                />
              </Elements>
            </motion.div>
          )}
          {step === 2 && clientSecret && (
            <motion.div
              key="step-2"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <Elements stripe={stripePromise} options={{ clientSecret, locale: 'en-CA' }}>
                <ConfirmDepositStep
                  amount={amount}
                  cardInfo={cardInfo}
                  onBack={() => setStep(1)}
                  onConfirm={handleConfirmAndPay}
                  confirmError={confirmError}
                  confirmLoading={confirmLoading}
                  saveCard={saveCard}
                />
              </Elements>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div
              key="step-3"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
                {successMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <StepDots step={step} total={4} />
      </motion.div>
    </div>
  ) : null;
}

// Withdraw Stepper Modal
function WithdrawStepper({ open, onClose, onSuccess, paymentMethods, onAddCard }) {
  const [step, setStep] = useState(0); // 0: Amount, 1: Card, 2: Confirm, 3: Success
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (open) {
      setStep(0);
      setAmount('');
      setAmountError('');
      setSelectedCard(null);
      setShowAddCard(false);
      setCardError('');
      setLoading(false);
      setSuccessMsg('');
    }
  }, [open]);

  // Step 1: Enter Amount
  function handleAmountNext() {
    setAmountError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    setStep(1);
  }

  // Step 2: Card selection or add
  function handleCardNext() {
    if (!selectedCard && !showAddCard) {
      setCardError('Select a card or add a new one');
      return;
    }
    setCardError('');
    setStep(2);
  }

  // Step 3: Confirm
  async function handleConfirm() {
    setLoading(true);
    try {
      // Call backend to create withdrawal (pass amount and selectedCard.id)
      await walletService.createWithdrawal(Number(amount), selectedCard?.id);
      setStep(3);
      setSuccessMsg('Withdrawal request submitted!');
      setTimeout(() => {
        onSuccess && onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setCardError(err.message || 'Failed to withdraw');
    }
    setLoading(false);
  }

  return open ? (
    <div style={modalOverlayStyle}>
      <motion.div
        style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 340, padding: '54px 48px 48px 48px', position: 'relative' }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
      >
        {/* Top left back arrow (only if step > 0) */}
        {step > 0 && (
          <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => setStep(step - 1)}>
            <span aria-hidden="true">&#8592;</span>
          </button>
        )}
        {/* Top right close X (always) */}
        <button type="button" aria-label="Close" style={modalCloseBtnStyle} onClick={onClose}>
          <span aria-hidden="true">&times;</span>
        </button>
        <h3 style={{ fontWeight: 700, fontSize: 26, marginBottom: 18, textAlign: 'center' }}>Withdraw Funds</h3>
        <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 18, fontWeight: 500, minHeight: 24 }}>
          You are withdrawing <span style={{ color: '#6fffbe', fontWeight: 700 }}>${amount && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount).toFixed(2) : '0.00'}</span> from your Wallet
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div
              key="step-0"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 16, fontWeight: 400 }}>
                How much would you like to withdraw?
              </div>
              <input type="number" placeholder="Amount (CAD)" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, fontSize: 20, textAlign: 'center', marginBottom: 8 }} />
              {amountError && <div style={{ color: 'red', marginBottom: 8 }}>{amountError}</div>}
              <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleAmountNext}>
                Continue
              </Button>
              <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
                Cancel
              </Button>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              {(!paymentMethods || paymentMethods.length === 0 || showAddCard) ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 16, fontWeight: 400 }}>
                    Enter card details to receive funds
                  </div>
                  <Elements stripe={stripePromise} options={{ locale: 'en-CA' }}>
                    <AddCardForm clientSecret={null} onSuccess={() => { setShowAddCard(false); onAddCard && onAddCard(); }} onError={setCardError} onClose={() => setShowAddCard(false)} onBack={() => setStep(0)} amountMessage="Enter card details to receive funds" context="withdraw" />
                  </Elements>
                  <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={() => setShowAddCard(false)}>
                    Back
                  </Button>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 16, fontWeight: 400 }}>
                    Select a card to receive funds
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    {paymentMethods.map(pm => (
                      <div key={pm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: selectedCard && selectedCard.id === pm.id ? 'rgba(79,70,229,0.18)' : 'rgba(32,41,74,0.7)', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'pointer', border: selectedCard && selectedCard.id === pm.id ? '2px solid #6fffbe' : '1.5px solid rgba(255,255,255,0.08)' }} onClick={() => setSelectedCard(pm)}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{pm.card.brand.toUpperCase()} •••• {pm.card.last4}</span>
                          <span style={{ marginLeft: 8, color: '#aaa', fontSize: 13 }}>Exp: {pm.card.exp_month}/{pm.card.exp_year}</span>
                        </div>
                        {selectedCard && selectedCard.id === pm.id && <span style={{ color: '#6fffbe', fontWeight: 700, fontSize: 15 }}>Selected</span>}
                      </div>
                    ))}
                  </div>
                  <Button variant="primary" size="sm" style={{ width: '100%', height: smallActionButtonHeight, fontSize: smallActionFontSize, borderRadius: smallActionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={() => setShowAddCard(true)}>
                    + Add New Card
                  </Button>
                  {cardError && <div style={{ color: 'red', marginTop: 8 }}>{cardError}</div>}
                  <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 14, marginBottom: 0 }} onClick={handleCardNext}>
                    Continue
                  </Button>
                  <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={() => setStep(0)}>
                    Back
                  </Button>
                </>
              )}
            </motion.div>
          )}
          {step === 2 && (
            <motion.div
              key="step-2"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 18, fontWeight: 500 }}>
                Confirm Withdrawal
              </div>
              <div style={{ background: 'rgba(35,43,74,0.18)', borderRadius: 10, padding: 18, marginBottom: 18, border: '1.5px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Amount: <span style={{ color: '#6fffbe' }}>${Number(amount).toFixed(2)}</span></div>
                <div style={{ fontSize: 15, color: '#b3b3c9' }}>To Card: {selectedCard ? `${selectedCard.card.brand.toUpperCase()} •••• ${selectedCard.card.last4}` : 'N/A'}</div>
              </div>
              {cardError && <div style={{ color: 'red', marginBottom: 8 }}>{cardError}</div>}
              <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleConfirm} disabled={loading}>
                {loading ? 'Processing...' : 'Confirm & Withdraw'}
              </Button>
              <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={() => setStep(1)}>
                Back
              </Button>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div
              key="step-3"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
                {successMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <StepDots step={step} total={4} />
      </motion.div>
    </div>
  ) : null;
}

// Add Card Stepper Modal
function AddCardStepper({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(0); // 0: Card Details, 1: Success
  const [clientSecret, setClientSecret] = useState(null);
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (open) {
      setStep(0);
      setClientSecret(null);
      setCardError('');
      setLoading(false);
      setSuccessMsg('');
    }
  }, [open]);

  // Step 1: Card Details
  async function handleCardSubmit() {
    setCardError('');
    setLoading(true);
    try {
      // Simulate backend call to get setup intent
      const resp = await walletService.createSetupIntent();
      setClientSecret(resp.clientSecret);
    } catch (err) {
      setCardError(err.message || 'Failed to start card setup');
    }
    setLoading(false);
  }

  function handleCardSuccess() {
    setStep(1);
    setSuccessMsg('Card added!');
    setTimeout(() => {
      onSuccess && onSuccess();
      onClose();
    }, 1200);
  }

  return open ? (
    <div style={modalOverlayStyle}>
      <motion.div
        style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 260, padding: '54px 48px 48px 48px', position: 'relative' }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
      >
        {/* Top left back arrow (only if step > 0) */}
        {step > 0 && (
          <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => setStep(step - 1)}>
            <span aria-hidden="true">&#8592;</span>
          </button>
        )}
        {/* Top right close X (always) */}
        <button type="button" aria-label="Close" style={modalCloseBtnStyle} onClick={onClose}>
          <span aria-hidden="true">&times;</span>
        </button>
        <h3 style={{ fontWeight: 700, fontSize: 26, marginBottom: 18, textAlign: 'center' }}>Add Card</h3>
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div
              key="step-0"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret, locale: 'en-CA' }}>
                  <AddCardForm clientSecret={clientSecret} onSuccess={handleCardSuccess} onError={setCardError} onClose={onClose} onBack={() => setStep(0)} amountMessage="Enter card details to receive funds" context="withdraw" />
                </Elements>
              ) : (
                <>
                  <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleCardSubmit} disabled={loading}>
                    {loading ? 'Loading...' : 'Add Card'}
                  </Button>
                  {cardError && <div style={{ color: 'red', marginTop: 8 }}>{cardError}</div>}
                  <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
                    Cancel
                  </Button>
                </>
              )}
            </motion.div>
          )}
          {step === 1 && (
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
            >
              <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
                {successMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <StepDots step={step} total={2} />
      </motion.div>
    </div>
  ) : null;
}

function Wallet() {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [addCardClientSecret, setAddCardClientSecret] = useState(null);
  const [addCardError, setAddCardError] = useState('');

  // Lock background scroll when any modal is open
  useEffect(() => {
    if (showDeposit || showWithdraw || showAddCard) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showDeposit, showWithdraw, showAddCard]);

  useEffect(() => {
    fetchWallet();
    fetchPaymentMethods();
  }, []);

  async function fetchWallet() {
    setLoading(true);
    setError('');
    try {
      const bal = await walletService.getBalance();
      setBalance(bal.balance);
      const txs = await walletService.getTransactions();
      setTransactions(txs.transactions);
    } catch (err) {
      setError('Failed to load wallet info');
    }
    setLoading(false);
  }

  async function fetchPaymentMethods() {
    setPmLoading(true);
    try {
      const resp = await walletService.getPaymentMethods();
      setPaymentMethods(resp.paymentMethods || []);
    } catch (err) {
      setPaymentMethods([]);
    }
    setPmLoading(false);
  }

  // Monthly summary
  const now = new Date();
  const thisMonthTxs = transactions.filter(tx => {
    const d = new Date(tx.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalSpent = thisMonthTxs.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalAdded = thisMonthTxs.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);

  // Deposit modal logic
  async function handleDeposit() {
    setDepositLoading(true);
    setDepositError('');
    setSuccessMsg('');
    try {
      const resp = await walletService.createDepositIntent(Number(depositAmount));
      setClientSecret(resp.clientSecret);
    } catch (err) {
      setDepositError(err.message || 'Failed to create deposit');
    }
    setDepositLoading(false);
  }

  function handleDepositSuccess() {
    setShowDeposit(false);
    setDepositAmount('');
    setClientSecret(null);
    setSuccessMsg('Deposit successful!');
    fetchWallet();
  }

  // Withdraw modal logic
  async function handleWithdraw() {
    setWithdrawLoading(true);
    setWithdrawError('');
    setSuccessMsg('');
    try {
      await walletService.createWithdrawal(Number(withdrawAmount));
      setSuccessMsg('Withdrawal request submitted.');
      setWithdrawAmount('');
      setShowWithdraw(false);
      fetchWallet();
    } catch (err) {
      setWithdrawError(err.message || 'Failed to withdraw');
    }
    setWithdrawLoading(false);
  }

  // Add card modal logic
  async function handleAddCard() {
    setAddCardError('');
    setAddCardClientSecret(null);
    try {
      const resp = await walletService.createSetupIntent();
      setAddCardClientSecret(resp.clientSecret);
    } catch (err) {
      setAddCardError(err.message || 'Failed to start card setup');
    }
  }

  function handleAddCardSuccess() {
    setShowAddCard(false);
    setAddCardClientSecret(null);
    setSuccessMsg('Card added!');
    fetchPaymentMethods();
  }

  async function handleRemoveCard(id) {
    if (!window.confirm('Remove this card?')) return;
    await walletService.removePaymentMethod(id);
    fetchPaymentMethods();
  }

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: 24 }}>
      <h2 style={{ marginBottom: 24, color: '#fff' }}>My Wallet</h2>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', gap: 32 }}>
          {/* Left: Balance and actions */}
          <div style={{ flex: 1 }}>
            <div style={{ ...cardStyle, color: '#6fffbe', textAlign: 'center', fontSize: 28, fontWeight: 600, marginBottom: 24 }}>
              Available Balance<br />
              <span style={{ fontSize: 36, color: '#6fffbe' }}>${Number(balance ?? 0).toFixed(2)}</span>
            </div>
            <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, padding: actionPadding, marginTop: 0, marginBottom: 0 }} onClick={() => setShowDeposit(true)}>
              + Add Funds
            </Button>
            <div style={withdrawButtonWrapper}>
              <button style={withdrawButtonStyle} onClick={() => setShowWithdraw(true)}>
                Withdraw
              </button>
            </div>
            <div style={{ ...cardStyle, marginTop: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>This Month</div>
              <div>Total Spent: <span style={{ color: '#ff6b6b' }}>${totalSpent.toFixed(2)}</span></div>
              <div>Total Added: <span style={{ color: '#6fffbe' }}>${totalAdded.toFixed(2)}</span></div>
              <div>Transactions: {thisMonthTxs.length}</div>
            </div>
            <div style={{ ...cardStyle, marginTop: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Payment Methods</div>
              {pmLoading ? (
                <div>Loading cards...</div>
              ) : paymentMethods.length === 0 ? (
                <div>No cards saved.</div>
              ) : (
                paymentMethods.map(pm => (
                  <div key={pm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(32,41,74,0.7)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{pm.card.brand.toUpperCase()} •••• {pm.card.last4}</span>
                      <span style={{ marginLeft: 8, color: '#aaa', fontSize: 13 }}>Exp: {pm.card.exp_month}/{pm.card.exp_year}</span>
                    </div>
                    <button onClick={() => handleRemoveCard(pm.id)} style={smallSecondaryButtonStyle}>Remove</button>
                  </div>
                ))
              )}
              <Button variant="primary" size="sm" style={{ width: '100%', height: smallActionButtonHeight, fontSize: smallActionFontSize, borderRadius: smallActionBorderRadius, padding: smallActionPadding, marginTop: 14, marginBottom: 0 }} onClick={() => { setShowAddCard(true); setAddCardError(''); setAddCardClientSecret(null); handleAddCard(); }}>
                + Add Payment Method
              </Button>
            </div>
          </div>
          {/* Right: Transaction history */}
          <div style={{ flex: 2 }}>
            <div style={{ ...cardStyle, minHeight: 400 }}>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 16 }}>Transaction History</div>
              {transactions.length === 0 ? (
                <div>No transactions yet.</div>
              ) : (
                <div>
                  {transactions.map(tx => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2d3657', padding: '12px 0' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {tx.type === 'deposit' ? 'Wallet top-up' : tx.type === 'withdrawal' ? 'Withdrawal' : tx.description}
                        </div>
                        <div style={{ fontSize: 13, color: '#aaa' }}>{format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>Ref: {tx.reference_id || tx.id}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: tx.amount > 0 ? '#6fffbe' : '#ff6b6b', fontSize: 18 }}>
                          {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 13, color: tx.status === 'succeeded' ? '#6fffbe' : tx.status === 'pending' ? '#ffd166' : '#ff6b6b' }}>
                          {tx.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      <AddFundsStepper open={showDeposit} onClose={() => setShowDeposit(false)} onSuccess={fetchWallet} />

      {/* Add Card Modal */}
      <AddCardStepper open={showAddCard} onClose={() => setShowAddCard(false)} onSuccess={fetchPaymentMethods} />

      {/* Withdraw Modal */}
      <WithdrawStepper open={showWithdraw} onClose={() => setShowWithdraw(false)} onSuccess={fetchWallet} paymentMethods={paymentMethods} onAddCard={fetchPaymentMethods} />

      {/* Success Message */}
      {successMsg && <div style={{ marginTop: 24, color: '#6fffbe', fontWeight: 600 }}>{successMsg}</div>}
    </div>
  );
}

export default Wallet; 
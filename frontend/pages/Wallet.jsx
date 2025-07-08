import React, { useEffect, useState, useContext } from 'react';
import { walletService } from '../src/services/walletService';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { format } from 'date-fns';
import Button from '../src/components/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { UserContext } from '../src/context/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import ConfirmModal from '../src/components/ConfirmModal';

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

// SaveCardChoiceStep component for AddFundsStepper step 1
function SaveCardChoiceStep({ onChoice, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, marginTop: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 12 }}>
        Do you want to save this card for future use?
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        <Button variant="primary" size="default" style={{ minWidth: 120, fontSize: 18, borderRadius: 10 }} type="button" onClick={() => onChoice(true)} disabled={loading}>
          Yes
        </Button>
        <Button variant="secondary" size="default" style={{ minWidth: 120, fontSize: 18, borderRadius: 10 }} type="button" onClick={() => onChoice(false)} disabled={loading}>
          No
        </Button>
      </div>
    </div>
  );
}

// PaymentElementStep component for AddFundsStepper step 2
function PaymentElementStep({ clientSecret, onConfirm, confirmError, confirmLoading, cardInfo }) {
  const paymentElementOptions = React.useMemo(() => ({
    layout: 'tabs',
    appearance: paymentElementAppearance,
    defaultValues: { billingDetails: { email: '' } },
    fields: { billingDetails: { email: 'never' } },
    wallets: { link: 'never' },
  }), []);
  const stripe = useStripe();
  const elements = useElements();
  useEffect(() => {
    console.log('[PaymentElementStep] mount', { stripeLoaded: !!stripe, elementsLoaded: !!elements, clientSecret });
    return () => {
      console.log('[PaymentElementStep] unmount', { stripeLoaded: !!stripe, elementsLoaded: !!elements, clientSecret });
    };
  }, [stripe, elements, clientSecret]);
  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm(stripe, elements); }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2, color: '#fff', textAlign: 'center' }}>Card Details</div>
      <div style={{ background: 'rgba(35,43,74,0.18)', borderRadius: 14, padding: 14, marginBottom: 2, border: '1.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 8px rgba(31,38,135,0.10)' }}>
        <PaymentElement options={paymentElementOptions} />
      </div>
      <div style={{ minHeight: 22, color: 'red', marginTop: 2, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'min-height 0.2s' }}>{confirmError || ''}</div>
      <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} type="submit" disabled={confirmLoading}>
        {confirmLoading ? 'Processing...' : 'Confirm & Pay'}
      </Button>
    </form>
  );
}

// Add Funds Stepper Modal
function AddFundsStepper({ open, onClose, onSuccess, userEmail }) {
  const [step, setStep] = useState(0); // 0: Amount, 1: SaveCard, 2: Payment, 3: Success
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [cardInfo, setCardInfo] = useState(null); // {brand, last4}
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [saveCard, setSaveCard] = useState(null); // null until user chooses Yes/No
  const [lockModal, setLockModal] = useState(false);

  // Debug logs for modal open/close, step, and clientSecret
  useEffect(() => {
    if (open) {
      console.log('[AddFundsStepper] Modal opened, resetting state');
    } else {
      console.log('[AddFundsStepper] Modal closed');
    }
  }, [open]);
  useEffect(() => {
    console.log('[AddFundsStepper] Step changed:', step);
  }, [step]);
  useEffect(() => {
    if (clientSecret) {
      console.log('[AddFundsStepper] clientSecret set:', clientSecret);
    }
  }, [clientSecret]);

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
      setSaveCard(null);
      setLockModal(false);
    }
  }, [open]);

  // Step 0: Enter Amount
  function handleAmountNext() {
    setAmountError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    setStep(1);
  }

  // Step 1: Save card? (Yes/No)
  async function handleSaveCardChoice(choice) {
    setSaveCard(choice);
    setLoading(true);
    try {
      // Only set clientSecret if not already set
      if (!clientSecret) {
        const resp = await walletService.createDepositIntent(Number(amount), !!choice);
        setClientSecret(resp.clientSecret);
      }
      setStep(2);
    } catch (err) {
      setCardError(err.message || 'Failed to create deposit');
      setStep(0); // go back to amount step on error
    }
    setLoading(false);
  }

  // Step 2: Confirm & Pay (render PaymentElement)
  async function handleConfirmAndPay(stripe, elements) {
    setConfirmError('');
    setConfirmLoading(true);
    setLockModal(true);
    console.log('[AddFundsStepper] handleConfirmAndPay called', { stripeLoaded: !!stripe, elementsLoaded: !!elements, step });
    try {
      if (!stripe || !elements) throw new Error('Stripe not loaded');
      const options = {
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
              email: userEmail || ''
            }
          }
        },
        redirect: 'if_required',
      };
      console.log('[AddFundsStepper] Calling stripe.confirmPayment', options);
      const { error, paymentIntent } = await stripe.confirmPayment(options);
      console.log('[AddFundsStepper] stripe.confirmPayment result', { error, paymentIntent });
      if (error) {
        setConfirmError(error.message);
        setConfirmLoading(false);
        setLockModal(false);
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
        onClose(); // Only close modal, do not trigger parent state update yet
      }, 1200);
    } catch (err) {
      console.error('[AddFundsStepper] Error in handleConfirmAndPay:', err);
      setConfirmError(err.message || 'Failed to process payment');
      setLockModal(false);
    }
    setConfirmLoading(false);
  }

  // CSS display helpers for step visibility
  const getStepDisplay = (targetStep) => (step === targetStep ? {} : { display: 'none' });

  return open ? (
    <div style={modalOverlayStyle}>
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, locale: 'en-CA' }}>
          <motion.div
            style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 340, padding: '54px 48px 48px 48px', position: 'relative' }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
          >
            {/* Top left back arrow (only if step > 0) */}
            {step > 0 && (
              <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => !lockModal && setStep(step - 1)} disabled={lockModal}>
                <span aria-hidden="true">&#8592;</span>
              </button>
            )}
            {/* Top right close X (always) */}
            <button type="button" aria-label="Close" style={modalCloseBtnStyle} onClick={() => { if (!lockModal) onClose(); }} disabled={lockModal}>
              <span aria-hidden="true">&times;</span>
            </button>
            <h3 style={{ fontWeight: 700, fontSize: 26, marginBottom: 18, textAlign: 'center' }}>Add Funds</h3>
            <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 18, fontWeight: 500, minHeight: 24 }}>
              You are adding <span style={{ color: '#6fffbe', fontWeight: 700 }}>${amount && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount).toFixed(2) : '0.00'}</span> to your Wallet
            </div>
            {/* Step 0: Amount */}
            <div style={getStepDisplay(0)}>
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
            </div>
            {/* Step 1: Save Card Choice */}
            <div style={getStepDisplay(1)}>
              <SaveCardChoiceStep onChoice={handleSaveCardChoice} loading={loading} />
            </div>
            {/* Step 2: PaymentElementStep (always mounted, only visible at step 2) */}
            <div style={getStepDisplay(2)}>
              <PaymentElementStep
                clientSecret={clientSecret}
                onConfirm={handleConfirmAndPay}
                confirmError={confirmError}
                confirmLoading={confirmLoading}
                cardInfo={cardInfo}
              />
            </div>
            {/* Step 3: Success */}
            <div style={getStepDisplay(3)}>
              <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
                {successMsg}
              </div>
            </div>
            <StepDots step={step} total={4} />
          </motion.div>
        </Elements>
      ) : (
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
          {/* Step 0: Amount */}
          <div style={getStepDisplay(0)}>
            <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 16, fontWeight: 400 }}>
              How much would you like to add?
            </div>
            <input type="number" placeholder="Amount (CAD)" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, fontSize: 20, textAlign: 'center', marginBottom: 8, outline: 'none', border: 'none', boxShadow: 'none' }} />
            {/* Helper text below input */}
            <div style={{ textAlign: 'center', color: '#b3b3c9', fontSize: 15, marginBottom: 8 }}>
              {amount && !isNaN(Number(amount)) && Number(amount) > 0
                ? `You are withdrawing $${Number(amount).toFixed(2)} to your card.`
                : 'Enter the amount you want to withdraw.'}
            </div>
            {amountError && <div style={{ color: 'red', marginBottom: 8 }}>{amountError}</div>}
            <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleAmountNext}>
              Continue
            </Button>
            <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
              Cancel
            </Button>
          </div>
          {/* Step 1: Save Card Choice */}
          <div style={getStepDisplay(1)}>
            <SaveCardChoiceStep onChoice={handleSaveCardChoice} loading={loading} />
          </div>
          <StepDots step={step} total={4} />
        </motion.div>
      )}
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

// Withdraw Stepper Modal
function WithdrawStepper({ open, onClose, onSuccess, onAddCard }) {
  const [step, setStep] = useState(0); // 0: Amount, 1: Confirm, 2: Success
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [cardInfo, setCardInfo] = useState(null);
  const [cardLoading, setCardLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setAmount('');
      setAmountError('');
      setLoading(false);
      setSuccessMsg('');
      setWithdrawError('');
      setCardInfo(null);
      setCardLoading(true);
      walletService.getMostRecentDepositCard()
        .then(res => {
          setCardInfo(res.card);
        })
        .catch(() => setCardInfo(null))
        .finally(() => setCardLoading(false));
    }
  }, [open]);

  function handleAmountNext() {
    setAmountError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    setStep(1);
  }

  async function handleWithdraw() {
    setWithdrawError('');
    setLoading(true);
    try {
      await walletService.createWithdrawal(Number(amount));
      setStep(2);
      setSuccessMsg('Withdrawal request submitted!');
      setTimeout(() => {
        onClose();
        onSuccess && onSuccess();
      }, 1200);
    } catch (err) {
      setWithdrawError(err.message || 'Failed to withdraw');
    }
    setLoading(false);
  }

  const getStepDisplay = (targetStep) => (step === targetStep ? {} : { display: 'none' });

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
        {/* Step 0: Amount */}
        <div style={getStepDisplay(0)}>
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
        </div>
        {/* Step 1: Confirm */}
        <div style={getStepDisplay(1)}>
          <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 18, fontWeight: 500, minHeight: 24 }}>
            You are withdrawing <span style={{ color: '#ff6b6b', fontWeight: 700 }}>${amount && !isNaN(Number(amount)) && Number(amount) > 0 ? Number(amount).toFixed(2) : '0.00'}</span> from your Wallet
          </div>
          <div style={{ textAlign: 'center', marginBottom: 18, color: '#b3b3c9', fontSize: 16 }}>
            <b>Money will be withdrawn to your original payment method.</b><br />
            {cardLoading ? (
              <span>Loading card info...</span>
            ) : cardInfo ? (
              <span>Card: {cardInfo.brand?.toUpperCase()} •••• {cardInfo.last4}</span>
            ) : (
              <span style={{ color: '#ff6b6b', fontWeight: 500 }}>
                No eligible deposit card found. You must make a deposit with a card before you can withdraw to it.
              </span>
            )}
          </div>
          {withdrawError && <div style={{ color: 'red', marginBottom: 8 }}>{withdrawError}</div>}
          <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleWithdraw} disabled={loading || !cardInfo}>
            {loading ? 'Processing...' : 'Confirm & Withdraw'}
          </Button>
          <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
            Cancel
          </Button>
        </div>
        {/* Step 2: Success */}
        <div style={getStepDisplay(2)}>
          <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
            {successMsg}
          </div>
        </div>
        <StepDots step={step} total={3} />
      </motion.div>
    </div>
  ) : null;
}

function Wallet() {
  const { user } = useContext(UserContext);
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
  // Track if AddFundsStepper is open and payment is processing, to avoid parent state updates
  const [depositProcessing, setDepositProcessing] = useState(false);
  // Add state for confirm modal
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeCardId, setRemoveCardId] = useState(null);
  const [removeCardLast4, setRemoveCardLast4] = useState('');

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
  const totalSpent = 0; // TODO: Replace with actual spent calculation when bidding/purchase is implemented
  const totalAdded = thisMonthTxs.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const totalWithdrawn = thisMonthTxs.filter(tx => tx.type === 'withdrawal' && tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // Only fetchWallet after AddFundsStepper closes, not during payment
  function handleAddFundsModalClose() {
    setShowDeposit(false);
    setTimeout(() => {
      fetchWallet();
    }, 400); // Wait for modal animation to finish
  }

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
            {/* Available Balance Card */}
            <div style={{
              background: 'rgba(35, 43, 74, 0.45)',
              borderRadius: 18,
              padding: '28px 24px 24px 24px',
              marginBottom: 24,
              boxShadow: '0 4px 18px 0 rgba(31,38,135,0.18)',
              border: '1.5px solid rgba(255,255,255,0.08)',
              minWidth: 260,
              maxWidth: 340,
              marginLeft: 'auto',
              marginRight: 'auto',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, color: '#fff', fontWeight: 500, marginBottom: 6 }}>Available Balance</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#6fffbe', letterSpacing: 1, marginBottom: 18, textShadow: '0 2px 8px #6fffbe, 0 1px 2px #fff' }}>
                ${Number(balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <Button
                variant="primary"
                size="default"
                style={{ width: '100%', height: 44, fontSize: 18, borderRadius: 10, marginBottom: 10, fontWeight: 600 }}
                onClick={() => setShowDeposit(true)}
              >
                + Add Funds
              </Button>
              <Button
                variant="secondary"
                size="default"
                style={{ width: '100%', height: 44, fontSize: 18, borderRadius: 10, fontWeight: 600, opacity: balance > 0 ? 1 : 0.6 }}
                onClick={() => setShowWithdraw(true)}
                disabled={balance <= 0}
              >
                &mdash; Withdraw
              </Button>
            </div>

            {/* This Month Summary Card */}
            <div
              style={{
                background: 'rgba(35, 43, 74, 0.32)',
                borderRadius: 14,
                padding: '18px 24px 14px 24px',
                marginBottom: 18,
                boxShadow: '0 2px 10px 0 rgba(31,38,135,0.10)',
                border: '1.5px solid rgba(255,255,255,0.06)',
                width: 320,
                margin: '0 auto',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 17, color: '#fff', fontWeight: 500, marginBottom: 16, textAlign: 'center' }}>This Month</div>
              <div style={{ fontSize: 16, marginBottom: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Withdrawn:</span>
                  <span style={{ color: '#ff6b6b', fontWeight: 700, marginLeft: 10 }}>${Number(totalWithdrawn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Spent:</span>
                  <span style={{ color: '#ffd166', fontWeight: 700, marginLeft: 10 }}>${Number(totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Added:</span>
                  <span style={{ color: '#6fffbe', fontWeight: 700, marginLeft: 10 }}>${Number(totalAdded || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Transactions:</span>
                  <span style={{ color: '#fff', fontWeight: 700, marginLeft: 10 }}>{thisMonthTxs.length}</span>
                </div>
              </div>
            </div>
            <div style={{ ...cardStyle, marginTop: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Payment Methods</div>
              {pmLoading ? (
                <div>Loading cards...</div>
              ) : paymentMethods.length === 0 ? (
                <div>No cards saved.</div>
              ) : (
                paymentMethods.map(pm => (
                  <div key={pm.id} style={{
                    borderRadius: 18,
                    padding: 2,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #a78bfa 50%, #6366f1 100%)',
                    marginBottom: 14,
                    minWidth: 180,
                    maxWidth: 260,
                    margin: '0 auto',
                  }}>
                    <div style={{
                      background: '#252663', // solid dark blue background
                      borderRadius: 16,
                      boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
                      padding: '10px 14px 8px 14px',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      position: 'relative',
                      fontSize: 15,
                      fontWeight: 600,
                      backdropFilter: 'blur(2px)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>{pm.card.brand?.toUpperCase() || 'CARD'}&nbsp;••••&nbsp;{pm.card.last4}</span>
                        <button
                          style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            color: '#ff6b6b',
                            borderRadius: '50%',
                            padding: 6,
                            fontSize: 18,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.18s',
                          }}
                          aria-label="Remove card"
                          onClick={() => {
                            setRemoveCardId(pm.id);
                            setRemoveCardLast4(pm.card.last4);
                            setShowRemoveConfirm(true);
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                      <div style={{ fontSize: 13, color: '#b3b3c9', marginTop: 4, fontWeight: 500 }}>
                        EXP: {pm.card.exp_month}/{pm.card.exp_year}
                      </div>
                    </div>
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
                          {tx.amount > 0 ? '+' : ''}${Number(tx.amount || 0).toFixed(2)}
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
      <AddFundsStepper open={showDeposit} onClose={handleAddFundsModalClose} onSuccess={fetchWallet} userEmail={user?.email} />

      {/* Add Card Modal */}
      <AddCardStepper open={showAddCard} onClose={() => setShowAddCard(false)} onSuccess={fetchPaymentMethods} />

      {/* Success Message */}
      {successMsg && <div style={{ marginTop: 24, color: '#6fffbe', fontWeight: 600 }}>{successMsg}</div>}

      {/* Withdraw Stepper Modal */}
      <WithdrawStepper
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onSuccess={fetchWallet}
        onAddCard={() => setShowAddCard(true)}
      />

      {/* ConfirmModal for removing card */}
      <ConfirmModal
        open={showRemoveConfirm}
        title="Remove Payment Method?"
        message={`Are you sure you want to remove card •••• ${removeCardLast4}?`}
        onConfirm={async () => {
          setShowRemoveConfirm(false);
          if (removeCardId) await handleRemoveCard(removeCardId);
        }}
        onCancel={() => setShowRemoveConfirm(false)}
        confirmText="Remove"
        cancelText="Cancel"
        confirmColor="red"
      />
    </div>
  );
}

export default Wallet; 
import React, { useEffect, useState, useContext } from 'react';
import { walletService } from '../src/services/walletService';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { format } from 'date-fns';
import Button from '../src/components/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { UserContext } from '../src/context/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faArrowDown, faArrowUp, faCreditCard, faTrophy, faUndo, faUniversity, faQuestionCircle, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import ConfirmModal from '../src/components/ConfirmModal';
import LoadingSpinner from '../src/components/LoadingSpinner';

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
      fontWeight: 700,
      letterSpacing: '0.02em',
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
    defaultValues: { billingDetails: { email: '' } },
    fields: { billingDetails: { email: 'never' } },
    wallets: { link: 'never' },
    paymentMethodTypes: ['card'],
    appearance: {
      theme: 'night',
      variables: {
        colorText: '#fff',
        colorLabel: '#fff',
      }
    }
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
function AddFundsStepper({ open, onClose, onSuccess, userEmail, paymentMethods }) {
  // Steps:
  // 0: Enter amount
  // 1: Select saved card (if any), or skip to 2 if none
  // 2: Save card for future use? (only if no saved cards)
  // 3: PaymentElement (add new card or pay with selected)
  // 4: Success
  const [step, setStep] = useState(0);
  const [stepHistory, setStepHistory] = useState([0]); // Track actual visited steps
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [stripeAccount, setStripeAccount] = useState(null);
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [cardInfo, setCardInfo] = useState(null); // {brand, last4}
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [saveCard, setSaveCard] = useState(null); // null until user chooses Yes/No
  const [lockModal, setLockModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null); // for saved card selection
  const [addNewCard, setAddNewCard] = useState(false); // true if user wants to add new card
  const [preparingPayment, setPreparingPayment] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setStepHistory([0]);
      setAmount('');
      setAmountError('');
      setClientSecret(null);
      setStripeAccount(null);
      setCardError('');
      setLoading(false);
      setSuccessMsg('');
      setCardInfo(null);
      setConfirmError('');
      setConfirmLoading(false);
      setSaveCard(null);
      setLockModal(false);
      setSelectedCardId(null);
      setAddNewCard(false);
      setPreparingPayment(false);
    }
  }, [open]);

  // Helper to go to next step and track history
  function goToStep(nextStep) {
    setStep(nextStep);
    setStepHistory(prev => [...prev, nextStep]);
  }
  // Helper to go back to previous step in history
  function goBackStep() {
    setStepHistory(prev => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      setStep(newHistory[newHistory.length - 1]);
      return newHistory;
    });
  }

  // Step 0: Enter Amount
  function handleAmountNext() {
    setAmountError('');
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setAmountError('Enter a valid amount');
      return;
    }
    if (Number(amount) > 2000) {
      setAmountError('Maximum deposit per transaction is $2,000');
      return;
    }
    if (paymentMethods && paymentMethods.length > 0) {
      goToStep(1); // Go to card selection
    } else {
      goToStep(2); // Go to save card question
    }
  }

  // Step 1: Card selection (if saved cards)
  function handleCardSelect(cardId) {
    setSelectedCardId(cardId);
    setAddNewCard(false);
    goToStep(3); // Go to payment/confirmation
  }
  async function handleAddNewCard() {
    console.log('[handleAddNewCard] Starting add new card flow');
    setAddNewCard(true);
    setLoading(true);
    setPreparingPayment(true);
    try {
      // For new cards, we'll save it during the payment flow
      console.log('[handleAddNewCard] Creating deposit intent for new card with saveCard=true');
      
      // Always use platform account for consistency
      console.log('[handleAddNewCard] Always using platform account');
      
      const resp = await walletService.createDepositIntent(Number(amount), true); // Set saveCard to true
      console.log('[handleAddNewCard] DepositIntent response:', resp);
      setClientSecret(resp.clientSecret);
      
      // Always use platform account (no stripeAccount)
      setStripeAccount(null);
      console.log('[handleAddNewCard] Using platform account (no stripeAccount)');
      
      console.log('[handleAddNewCard] Client secret set, waiting for useEffect to advance step');
      // Do NOT setStep(3) here! Let useEffect handle it
    } catch (err) {
      console.error('[handleAddNewCard] Error:', err);
      setCardError(err.message || 'Failed to create deposit');
      goToStep(0);
      setPreparingPayment(false);
    }
    setLoading(false);
  }

  // Step 2: Save card? (only if no saved cards)
  async function handleSaveCardChoice(choice) {
    setSaveCard(choice);
    setLoading(true);
    setPreparingPayment(true);
    try {
      const resp = await walletService.createDepositIntent(Number(amount), !!choice);
      console.log('DepositIntent response (save card):', resp);
      setClientSecret(resp.clientSecret);
      setStripeAccount(resp.stripeAccount || null);
    } catch (err) {
      setCardError(err.message || 'Failed to create deposit');
      goToStep(0);
      setPreparingPayment(false);
    }
    setLoading(false);
  }

  // Watch for clientSecret and advance step
  useEffect(() => {
    console.log('[useEffect] Checking step progression:', { 
      preparingPayment, 
      clientSecret: !!clientSecret, 
      currentStep: step,
      addNewCard,
      selectedCardId 
    });
    if (preparingPayment && clientSecret) {
      console.log('[useEffect] Advancing to step 3');
      goToStep(3);
      setPreparingPayment(false);
    }
  }, [preparingPayment, clientSecret]);

  // Step 3: PaymentElement or confirm with saved card
  async function handleConfirmAndPay(stripe, elements) {
    setConfirmError('');
    setConfirmLoading(true);
    setLockModal(true);
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
      const { error, paymentIntent } = await stripe.confirmPayment(options);
      if (error) {
        setConfirmError(error.message);
        setConfirmLoading(false);
        setLockModal(false);
        return;
      }
      if (paymentIntent && paymentIntent.charges && paymentIntent.charges.data.length > 0) {
        const charge = paymentIntent.charges.data[0];
        if (charge.payment_method_details && charge.payment_method_details.card) {
          setCardInfo({
            brand: charge.payment_method_details.card.brand,
            last4: charge.payment_method_details.card.last4
          });
        }
      }
      goToStep(4);
      setSuccessMsg('Deposit successful!');
      // Refresh payment methods so new cards appear immediately
      if (typeof window.fetchPaymentMethods === 'function') {
        window.fetchPaymentMethods();
      }
      setTimeout(() => {
        onSuccess(Number(amount)); // Pass the deposit amount
      }, 1200);
    } catch (err) {
      setConfirmError(err.message || 'Failed to process payment');
      setLockModal(false);
    }
    setConfirmLoading(false);
  }

  // New: handle confirm with saved card
  async function handleConfirmWithSavedCard() {
    setConfirmLoading(true);
    setLockModal(true);
    try {
      // Call backend to create deposit intent with saved card
      const resp = await walletService.createDepositIntent(Number(amount), false, selectedCardId);
      const clientSecret = resp.clientSecret;
      if (!clientSecret) throw new Error('No client secret returned');
      // Confirm payment with saved card
      const stripe = await stripePromise;
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: selectedCardId
      });
      if (error) {
        setConfirmError(error.message);
        setLockModal(false);
        setConfirmLoading(false);
        return;
      }
      goToStep(4);
      setSuccessMsg('Deposit successful!');
      // Refresh payment methods so new cards appear immediately
      if (typeof window.fetchPaymentMethods === 'function') {
        window.fetchPaymentMethods();
      }
      setTimeout(() => {
        onSuccess(Number(amount)); // Pass the deposit amount
      }, 1200);
    } catch (err) {
      setConfirmError(err.message || 'Failed to process payment');
      setLockModal(false);
    }
    setConfirmLoading(false);
  }

  // UI helpers
  const getStepDisplay = (targetStep) => (step === targetStep ? {} : { display: 'none' });

  // Card selection UI
  function CardSelectStep() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, marginTop: 32 }}>
        <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 16 }}>
          Choose a saved card or add a new one
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {paymentMethods.map(pm => (
            <Button
              key={pm.id}
              variant={selectedCardId === pm.id ? 'primary' : 'secondary'}
              size="default"
              style={{
                width: '100%',
                fontSize: 18,
                borderRadius: 16,
                padding: '22px 28px',
                marginBottom: 6,
                background: selectedCardId === pm.id
                  ? 'linear-gradient(90deg, #4f46e5 60%, #6fffbe 100%)'
                  : '#232b4a',
                color: selectedCardId === pm.id ? '#fff' : '#b3b3c9',
                border: selectedCardId === pm.id ? '2.5px solid #6fffbe' : '2px solid #4f46e5',
                boxShadow: selectedCardId === pm.id ? '0 4px 18px #6fffbe33' : '0 2px 8px #0002',
                fontWeight: 700,
                letterSpacing: '0.03em',
                transition: 'all 0.18s',
                cursor: 'pointer',
                outline: 'none',
                ...(selectedCardId !== pm.id ? {
                  ':hover': {
                    background: '#2d3657',
                    border: '2px solid #6fffbe',
                    color: '#fff',
                  }
                } : {})
              }}
              onMouseOver={e => {
                if (selectedCardId !== pm.id) {
                  e.currentTarget.style.background = '#2d3657';
                  e.currentTarget.style.border = '2px solid #6fffbe';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseOut={e => {
                if (selectedCardId !== pm.id) {
                  e.currentTarget.style.background = '#232b4a';
                  e.currentTarget.style.border = '2px solid #4f46e5';
                  e.currentTarget.style.color = '#b3b3c9';
                }
              }}
              onClick={() => handleCardSelect(pm.id)}
            >
              {pm.card.brand?.toUpperCase() || 'CARD'} •••• {pm.card.last4} (exp {pm.card.exp_month}/{pm.card.exp_year})
            </Button>
          ))}
          <Button
            variant="secondary"
            size="default"
            style={{
              width: '100%',
              fontSize: 18,
              borderRadius: 16,
              padding: '22px 28px',
              marginTop: 12,
              background: 'transparent',
              color: addNewCard ? '#6fffbe' : '#b3b3c9',
              border: addNewCard ? '2.5px solid #6fffbe' : '2px solid #4f46e5',
              boxShadow: addNewCard ? '0 4px 18px #6fffbe33' : '0 2px 8px #0002',
              fontWeight: 700,
              letterSpacing: '0.03em',
              transition: 'all 0.18s',
              cursor: 'pointer',
              outline: 'none',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = '#2d3657';
              e.currentTarget.style.border = '2px solid #6fffbe';
              e.currentTarget.style.color = '#6fffbe';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.border = addNewCard ? '2.5px solid #6fffbe' : '2px solid #4f46e5';
              e.currentTarget.style.color = addNewCard ? '#6fffbe' : '#b3b3c9';
            }}
            onClick={handleAddNewCard}
          >
            + Add New Card
          </Button>
        </div>
      </div>
    );
  }

  return open ? (
    <div style={modalOverlayStyle}>
      {/* Steps before PaymentElement (steps 0, 1, 2) */}
      {((!clientSecret && (!selectedCardId || addNewCard)) || step < 3 || preparingPayment) && (
        <motion.div
          style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 340, padding: '54px 48px 48px 48px', position: 'relative' }}
          transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
        >
          {/* Top left back arrow (only if step > 0) */}
          {stepHistory.length > 1 && (
            <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => !lockModal && goBackStep()} disabled={lockModal}>
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
            <input type="number" placeholder="Amount (CAD)" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, fontSize: 20, textAlign: 'center', marginBottom: 8, border: '2px solid #a78bfa', boxShadow: '0 1px 4px rgba(167,139,250,0.10)' }} />
            {amountError && <div style={{ color: 'red', marginBottom: 8 }}>{amountError}</div>}
            <Button variant="primary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 0, marginBottom: 0 }} onClick={handleAmountNext}>
              Continue
            </Button>
            <Button variant="secondary" size="default" style={{ width: '100%', height: actionButtonHeight, fontSize: actionFontSize, borderRadius: actionBorderRadius, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
              Cancel
            </Button>
          </div>
          {/* Step 1: Card selection (if saved cards) */}
          {paymentMethods && paymentMethods.length > 0 && (
            <div style={getStepDisplay(1)}>
              <CardSelectStep />
            </div>
          )}
          {/* Step 2: Save Card Choice (only if no saved cards) */}
          {(!paymentMethods || paymentMethods.length === 0) && (
            <div style={getStepDisplay(2)}>
              <SaveCardChoiceStep onChoice={handleSaveCardChoice} loading={loading || preparingPayment} />
            </div>
          )}
          {/* Show loading spinner if preparingPayment and not yet at PaymentElement */}
          {preparingPayment && (
            <div style={{ textAlign: 'center', color: '#6fffbe', marginTop: 32, fontWeight: 600, fontSize: 20 }}>
              Preparing payment...
            </div>
          )}
          <StepDots step={step} total={paymentMethods && paymentMethods.length > 0 ? 5 : 4} />
        </motion.div>
      )}
      {/* Step 3: Confirmation for saved card (no PaymentElement) */}
      {selectedCardId && !addNewCard && step === 3 && !preparingPayment && (
        <motion.div
          style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 340, padding: '54px 48px 48px 48px', position: 'relative' }}
          transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
        >
          {/* Top left back arrow (only if step > 0) */}
          {stepHistory.length > 1 && (
            <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => !lockModal && goBackStep()} disabled={lockModal}>
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
          <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
            Using saved card for deposit.<br />
            (Card: {paymentMethods.find(pm => pm.id === selectedCardId)?.card.brand?.toUpperCase()} •••• {paymentMethods.find(pm => pm.id === selectedCardId)?.card.last4})
          </div>
          <Button variant="primary" size="default" style={{ marginTop: 24 }} onClick={handleConfirmWithSavedCard} disabled={confirmLoading}>
            {confirmLoading ? 'Processing...' : 'Confirm & Pay'}
          </Button>
          {confirmError && <div style={{ color: 'red', marginTop: 12 }}>{confirmError}</div>}
          <StepDots step={step} total={paymentMethods && paymentMethods.length > 0 ? 5 : 4} />
        </motion.div>
      )}
      {/* PaymentElement and confirmation (step 3+) only when clientSecret is present and adding new card */}
      {(() => {
        const shouldShowPaymentElement = clientSecret && step >= 3 && !preparingPayment && (!selectedCardId || addNewCard);
        console.log('[PaymentElement] Condition check:', {
          clientSecret: !!clientSecret,
          step,
          preparingPayment,
          selectedCardId,
          addNewCard,
          shouldShow: shouldShowPaymentElement
        });
        return shouldShowPaymentElement;
      })() && (
        <Elements key={clientSecret} stripe={stripePromise} options={{ 
          clientSecret, 
          locale: 'en-CA',
          ...(stripeAccount && { stripeAccount })
        }}>
              <motion.div
                style={{ ...modalCardStyle, minWidth: 440, maxWidth: 540, minHeight: 340, padding: '54px 48px 48px 48px', position: 'relative' }}
                transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
              >
                {/* Top left back arrow (only if step > 0) */}
                {stepHistory.length > 1 && (
                  <button type="button" aria-label="Back" style={modalBackBtnStyle} onClick={() => !lockModal && goBackStep()} disabled={lockModal}>
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
                {/* Step 3: PaymentElement */}
                <div style={getStepDisplay(3)}>
                  <PaymentElementStep
                    clientSecret={clientSecret}
                    onConfirm={handleConfirmAndPay}
                    confirmError={confirmError}
                    confirmLoading={confirmLoading}
                    cardInfo={cardInfo}
                  />
                </div>
                {/* Step 4: Success */}
                <div style={getStepDisplay(4)}>
                  <div style={{ textAlign: 'center', margin: '40px 0 30px 0', color: '#6fffbe', fontSize: 22, fontWeight: 700 }}>
                    {successMsg}
                  </div>
                </div>
                <StepDots step={step} total={paymentMethods && paymentMethods.length > 0 ? 5 : 4} />
              </motion.div>
            </Elements>
          )}
    </div>
  ) : null;
}

// Local error boundary for AddCardStepper
class LocalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ color: 'red', padding: 20 }}><h3>Something went wrong.</h3><pre>{this.state.error?.message || 'Unknown error'}</pre></div>;
    }
    return this.props.children;
  }
}

// Add Card Payment Element (inline, similar to deposit modal)
function AddCardPaymentElement({ onSuccess, onError, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useContext(UserContext); // Get user email

  // Restrict to only 'card' payment method
  const paymentElementOptions = React.useMemo(() => ({
    layout: 'tabs',
    defaultValues: { billingDetails: { email: '' } },
    fields: { billingDetails: { email: 'never' } },
    wallets: { link: 'never' },
    paymentMethodTypes: ['card'], // Only allow card
    appearance: {
      theme: 'stripe',
      variables: {
        colorText: '#fff',
        colorLabel: '#fff',
      }
    }
  }), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    onError && onError('');
    setLoading(true);
    try {
      if (!stripe || !elements) throw new Error('Stripe not loaded');
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
              email: user?.email || ''
            }
          }
        },
        redirect: 'if_required',
      });
      if (error) {
        setError(error.message);
        onError && onError(error.message);
      } else {
        onSuccess && onSuccess();
      }
    } catch (err) {
      setError(err.message || 'Failed to add card');
      onError && onError(err.message || 'Failed to add card');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2, color: '#fff', textAlign: 'center' }}>Card Details</div>
      <div style={{ background: 'rgba(35,43,74,0.18)', borderRadius: 14, padding: 14, marginBottom: 2, border: '1.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 8px rgba(31,38,135,0.10)' }}>
        <PaymentElement options={paymentElementOptions} />
      </div>
      <div style={{ minHeight: 22, color: 'red', marginTop: 2, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'min-height 0.2s' }}>{error}</div>
      <Button variant="primary" size="default" style={{ width: '100%', height: 52, fontSize: 18, borderRadius: 12, marginTop: 0, marginBottom: 0 }} type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Add Card'}
      </Button>
    </form>
  );
}

// Add Card Stepper Modal
function AddCardStepper({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(0); // 0: Card Details, 1: Success
  const [clientSecret, setClientSecret] = useState(null);
  const [stripeAccount, setStripeAccount] = useState(null);
  const [cardError, setCardError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (open) {
      setStep(0);
      setClientSecret(null);
      setStripeAccount(null);
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
      console.log('SetupIntent response:', resp);
      setClientSecret(resp.clientSecret);
      setStripeAccount(resp.stripeAccount || null);
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
                <>
                  {console.log('AddCardStepper Elements options:', { clientSecret, stripeAccount })}
                  <Elements key={clientSecret} stripe={stripePromise} options={{ 
                    clientSecret, 
                    locale: 'en-CA',
                    ...(stripeAccount && { stripeAccount })
                  }}>
                    <AddCardPaymentElement onSuccess={handleCardSuccess} onError={setCardError} onClose={onClose} />
                  </Elements>
                </>
              ) : (
                <>
                  <Button variant="primary" size="default" style={{ width: '100%', height: 52, fontSize: 18, borderRadius: 12, marginTop: 0, marginBottom: 0 }} onClick={handleCardSubmit} disabled={loading}>
                    {loading ? 'Loading...' : 'Add Card'}
                  </Button>
                  {cardError && <div style={{ color: 'red', marginTop: 8 }}>{cardError}</div>}
                  <Button variant="secondary" size="default" style={{ width: '100%', height: 52, fontSize: 18, borderRadius: 12, marginTop: 10, marginBottom: 0 }} onClick={onClose}>
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
function WithdrawStepper({ open, onClose, onSuccess, onAddCard, balance }) {
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
    // Check if withdrawal amount exceeds available balance
    if (Number(amount) > Number(balance)) {
      setAmountError(`Cannot withdraw more than your available balance of ${formatBalance(balance)}`);
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
        // Update balance and add withdrawal transaction
        walletService.getBalance()
          .then(bal => {
            setBalance(bal.balance);
            const newTransaction = {
              id: `temp-withdrawal-${Date.now()}`,
              type: 'withdrawal',
              amount: -parseFloat(amount), // Negative for withdrawal
              description: 'Wallet Withdrawal',
              status: 'pending',
              created_at: new Date().toISOString(),
              reference_id: `withdrawal-${Date.now()}`
            };
            setTransactions(prev => [newTransaction, ...prev]);
            // Update monthly summary
            setMonthlySummary(prev => ({
              ...prev,
              totalWithdrawn: prev.totalWithdrawn + parseFloat(amount),
              transactionCount: prev.transactionCount + 1
            }));
          })
          .catch(err => {
            console.error('Failed to update balance after withdrawal:', err);
          });
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
          <input type="number" placeholder="Amount (CAD)" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, fontSize: 20, textAlign: 'center', marginBottom: 8, border: '2px solid #a78bfa', boxShadow: '0 1px 4px rgba(167,139,250,0.10)' }} />
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
                You have no card saved for withdrawal. Save a card and use it in a deposit to verify it for withdrawals. Cards not used for deposit are not verified and cannot be used for withdrawal.
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

// Helper: get icon and color for transaction type
function getTxIconAndColor(tx) {
  if (tx.type === 'auction_income') {
    return { icon: faTrophy, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' };
  } else if (tx.type === 'deposit') {
    return { icon: faArrowDown, color: '#6fffbe', bg: 'rgba(111,255,190,0.12)' };
  } else if (tx.type === 'withdrawal') {
    return { icon: faArrowUp, color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' };
  } else if (tx.type === 'payout') {
    return { icon: faArrowUp, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
  } else if (tx.type === 'platform_fee') {
    return { icon: faMoneyBillWave, color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  } else if (tx.description?.toLowerCase().includes('payment')) {
    return { icon: faCreditCard, color: '#ffd166', bg: 'rgba(255,209,102,0.12)' };
  } else if (tx.description?.toLowerCase().includes('auction win')) {
    return { icon: faTrophy, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' };
  } else if (tx.description?.toLowerCase().includes('refund')) {
    return { icon: faUndo, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' };
  } else if (tx.description?.toLowerCase().includes('bank')) {
    return { icon: faUniversity, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
  }
  return { icon: faQuestionCircle, color: '#b3b3c9', bg: 'rgba(179,179,201,0.10)' };
}

// Helper: get status badge color
function getStatusColor(status) {
  if (status === 'succeeded' || status === 'completed') return '#22c55e';
  if (status === 'pending') return '#ffd166';
  return '#ff6b6b';
}

// Helper: format balance
function formatBalance(val) {
  return `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Compute running balance for each transaction (descending order)
function computeRunningBalances(transactions, startingBalance) {
  let bal = startingBalance;
  return transactions.map(tx => {
    bal = bal - (tx.amount || 0); // Subtract because list is usually newest first
    return { ...tx, runningBalance: bal };
  });
}

function Wallet() {
  const { user } = useContext(UserContext);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  
  // Add missing state variables
  const [addCardError, setAddCardError] = useState('');
  const [addCardClientSecret, setAddCardClientSecret] = useState(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  
  // Add state for confirm modal
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeCardId, setRemoveCardId] = useState(null);
  const [removeCardLast4, setRemoveCardLast4] = useState('');
  const [createWalletHover, setCreateWalletHover] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState({ totalAdded: 0, totalWithdrawn: 0, totalSpent: 0, transactionCount: 0 });
  const [lastDepositAmount, setLastDepositAmount] = useState(0);

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
    fetchMonthlySummary();
  }, []);

  // Add polling for balance updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll if wallet exists and user is on the wallet page
      if (balance !== null && !loading) {
        // Update balance only, don't refetch all transactions
        walletService.getBalance()
          .then(bal => {
            setBalance(bal.balance);
          })
          .catch(err => {
            console.error('Failed to update balance during polling:', err);
          });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [balance, loading]);

  async function fetchMonthlySummary() {
    try {
      const summary = await walletService.getMonthlySummary();
      setMonthlySummary(summary);
    } catch (err) {
      setMonthlySummary({ totalAdded: 0, totalWithdrawn: 0, totalSpent: 0, transactionCount: 0 });
    }
  }

  // Fetch wallet balance and first page of transactions (initial load or after deposit/withdrawal)
  async function fetchWallet() {
    setLoading(true);
    setError('');
    setLoadingTransactions(true);
    try {
      const bal = await walletService.getBalance();
      setBalance(bal.balance);
      await fetchTransactions(1); // Always reset to first page
    } catch (err) {
      if ((err?.response?.status === 404) || (err?.message && err.message.toLowerCase().includes('wallet not found'))) {
        setError('No wallet found. Click below to create your wallet.');
      } else {
        setError('Failed to load wallet info');
      }
    }
    setLoading(false);
    setLoadingTransactions(false);
  }

  // Fetch only transactions for a given page (for pagination)
  async function fetchTransactions(page) {
    setLoadingTransactions(true);
    try {
      const txResp = await walletService.getTransactions(page, 6);
      setTransactions(txResp.transactions);
      setTotalCount(txResp.totalCount || 0);
      setCurrentPage(txResp.page || 1);
    } catch (err) {
      setTransactions([]);
      setTotalCount(0);
    }
    setLoadingTransactions(false);
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
  // Expose globally for AddFundsStepper
  useEffect(() => {
    window.fetchPaymentMethods = fetchPaymentMethods;
    return () => { delete window.fetchPaymentMethods; };
  }, []);

  // Monthly summary (local, not backend)
  const now = new Date();
  const thisMonthTxs = transactions.filter(tx => {
    const d = new Date(tx.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalAdded = thisMonthTxs
    .filter(tx => tx.type === 'deposit' && Number(tx.amount) > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalWithdrawn = thisMonthTxs
    .filter(tx => (tx.type === 'withdrawal' || tx.type === 'payout') && Number(tx.amount) < 0)
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  const totalSpent = thisMonthTxs
    .filter(tx => tx.type === 'auction_payment' && Number(tx.amount) < 0)
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  const totalEarned = thisMonthTxs
    .filter(tx => tx.type === 'auction_income' && Number(tx.amount) > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const transactionCount = thisMonthTxs.filter(tx => tx.type !== 'platform_fee').length;

  // Only fetchWallet after AddFundsStepper closes, not during payment
  function handleAddFundsModalClose(depositAmount = 0) {
    setShowDeposit(false);
    setLastDepositAmount(depositAmount);
    // Update balance only, don't refetch all transactions
    setIsUpdating(true);
    walletService.getBalance()
      .then(bal => {
        setBalance(bal.balance);
        // Only add transaction if there was an actual deposit
        if (depositAmount > 0) {
          const newTransaction = {
            id: `temp-deposit-${Date.now()}`,
            type: 'deposit',
            amount: parseFloat(depositAmount),
            description: 'Wallet Deposit',
            status: 'succeeded',
            created_at: new Date().toISOString(),
            reference_id: `deposit-${Date.now()}`
          };
          setTransactions(prev => [newTransaction, ...prev]);
          // Update monthly summary
          setMonthlySummary(prev => ({
            ...prev,
            totalAdded: prev.totalAdded + parseFloat(depositAmount),
            transactionCount: prev.transactionCount + 1
          }));
        }
      })
      .catch(err => {
        console.error('Failed to update balance:', err);
        // If balance update fails, still close modal but don't update transactions
      })
      .finally(() => {
        setIsUpdating(false);
        setLastDepositAmount(0); // Reset after use
      });
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

  // After fetching transactions and balance:
  const txsWithBalance = currentPage === 1
    ? computeRunningBalances([...transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), balance)
    : transactions;

  // Pagination controls
  const totalPages = Math.ceil(totalCount / pageSize);
  function handleNextPage() {
    if (currentPage < totalPages) {
      fetchTransactions(currentPage + 1);
    }
  }
  function handlePrevPage() {
    if (currentPage > 1) {
      fetchTransactions(currentPage - 1);
    }
  }

  // Responsive helper
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div style={{ maxWidth: 1000, margin: isMobile ? '16px auto' : '40px auto', padding: isMobile ? 8 : 24 }}>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red', textAlign: 'center', marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {error}
          <br />
          <Button
            variant="primary"
            size="default"
            style={{
              marginTop: 32,
              minWidth: 320,
              height: 56,
              fontSize: 22,
              borderRadius: 32,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              border: 'none',
              boxShadow: createWalletHover
                ? '0 8px 32px #6fffbe55'
                : '0 4px 18px #6fffbe33',
              background: undefined, // Use default primary
              cursor: 'pointer',
              transition: 'box-shadow 0.18s, filter 0.18s',
              filter: createWalletHover ? 'brightness(1.08)' : 'none',
            }}
            onMouseEnter={() => setCreateWalletHover(true)}
            onMouseLeave={() => setCreateWalletHover(false)}
            onClick={async () => {
              try {
                await walletService.createWallet();
                fetchWallet();
              } catch (e) {
                setError('Failed to create wallet. Please try again.');
              }
            }}
          >
            + Create Wallet
          </Button>
          <div style={{ marginTop: 18, color: '#b3b3c9', fontSize: 16, textAlign: 'center', maxWidth: 400 }}>
            Existing users with no wallet must click the create button to create a wallet.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 0 : 32,
        }}>
          {/* Left: Balance and actions */}
          <div style={{ flex: 1, width: isMobile ? '100%' : undefined }}>
            {/* Available Balance Card */}
            <div style={{
              background: 'rgba(35, 43, 74, 0.45)',
              borderRadius: 18,
              padding: isMobile ? '18px 10px 16px 10px' : '28px 24px 24px 24px',
              marginBottom: isMobile ? 16 : 24,
              boxShadow: '0 4px 18px 0 rgba(31,38,135,0.18)',
              border: '1.5px solid rgba(255,255,255,0.08)',
              minWidth: isMobile ? undefined : 260,
              maxWidth: isMobile ? '100%' : 340,
              marginLeft: 'auto',
              marginRight: 'auto',
              textAlign: 'center',
              width: '100%',
            }}>
              <div style={{ fontSize: 18, color: '#fff', fontWeight: 500, marginBottom: 6 }}>Available Balance</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#6fffbe', letterSpacing: 1, marginBottom: 18, textShadow: '0 2px 8px #6fffbe, 0 1px 2px #fff' }}>
                ${Number(balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {isUpdating && <LoadingSpinner message={null} />}
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
                padding: isMobile ? '12px 10px 10px 10px' : '18px 24px 14px 24px',
                marginBottom: isMobile ? 12 : 18,
                boxShadow: '0 2px 10px 0 rgba(31,38,135,0.10)',
                border: '1.5px solid rgba(255,255,255,0.06)',
                width: '100%',
                maxWidth: isMobile ? '100%' : 320,
                margin: isMobile ? '0 auto' : '0 auto',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 17, color: '#fff', fontWeight: 500, marginBottom: 16, textAlign: 'center' }}>This Month</div>
              <div style={{ fontSize: 16, marginBottom: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Withdrawn:</span>
                  <span style={{ color: '#ff6b6b', fontWeight: 700, marginLeft: 10 }}>${totalWithdrawn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Spent:</span>
                  <span style={{ color: '#ffd166', fontWeight: 700, marginLeft: 10 }}>${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Added:</span>
                  <span style={{ color: '#6fffbe', fontWeight: 700, marginLeft: 10 }}>${totalAdded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {user?.role === 'seller' && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Total Earned:</span>
                    <span style={{ color: '#a78bfa', fontWeight: 700, marginLeft: 10 }}>${totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div>
                  <span style={{ color: '#b3b3c9', fontWeight: 500 }}>Transactions:</span>
                  <span style={{ color: '#fff', fontWeight: 700, marginLeft: 10 }}>{transactionCount}</span>
                </div>
              </div>
            </div>
            <div style={{ ...cardStyle, marginTop: isMobile ? 12 : 24, width: '100%' }}>
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
          <div style={{ flex: 2, width: isMobile ? '100%' : undefined, marginTop: isMobile ? 18 : 0 }}>
            <div style={{ ...cardStyle, minHeight: 400, width: '100%', overflowX: isMobile ? 'auto' : 'visible' }}>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 16 }}>Transaction History</div>
              {txsWithBalance.length === 0 ? (
                <div>No transactions yet.</div>
              ) : (
                <div>
                  {txsWithBalance.map((tx, idx) => {
                    const { icon, color, bg } = getTxIconAndColor(tx);
                    const isPositive = Number(tx.amount) > 0;
                    return (
                      <div key={tx.id} style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: 'center',
                        justifyContent: isMobile ? 'center' : 'space-between',
                        background: 'rgba(35,43,74,0.32)',
                        borderRadius: 16,
                        padding: isMobile ? '12px 10px' : '16px 20px',
                        marginBottom: 14,
                        boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
                        border: '1.5px solid rgba(255,255,255,0.06)',
                        gap: isMobile ? 8 : 18,
                        width: '100%',
                        textAlign: isMobile ? 'center' : undefined,
                      }}>
                        {/* Icon */}
                        <div style={{
                          background: bg,
                          borderRadius: '50%',
                          width: 44,
                          height: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          color,
                          flexShrink: 0,
                          margin: isMobile ? '0 auto 8px auto' : '0',
                        }}>
                          <FontAwesomeIcon icon={icon} />
                        </div>
                        {/* Main info */}
                        <div style={{ flex: 1, marginLeft: isMobile ? 0 : 12, width: '100%', textAlign: isMobile ? 'center' : 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: 17, color: '#fff', marginBottom: 2 }}>{tx.type === 'withdrawal' ? 'Wallet Withdrawal' : tx.type === 'deposit' ? 'Wallet Deposit' : tx.description}</div>
                          <div style={{ fontSize: 13, color: '#b3b3c9', fontWeight: 500 }}>{format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}</div>
                          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{'Ref: '}{tx.reference_id || tx.id}</div>
                        </div>
                        {/* Amount */}
                        <div style={{
                          textAlign: 'center',
                          minWidth: isMobile ? undefined : 110,
                          width: isMobile ? '100%' : undefined,
                          marginTop: isMobile ? 8 : 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <div style={{ fontWeight: 700, fontSize: 18, color: isPositive ? '#6fffbe' : '#ff6b6b', textAlign: 'center' }}>{isPositive ? '+' : ''}{formatBalance(tx.amount)}</div>
                          <div style={{ fontSize: 13, color: getStatusColor(tx.status), fontWeight: 600, marginTop: 2, textTransform: 'capitalize', textAlign: 'center' }}>{tx.status}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      <AddFundsStepper 
        open={showDeposit} 
        onClose={() => handleAddFundsModalClose(0)} 
        onSuccess={(amount) => handleAddFundsModalClose(amount)} 
        userEmail={user?.email} 
        paymentMethods={paymentMethods} 
      />

      {/* Add Card Modal */}
      <LocalErrorBoundary>
        <AddCardStepper open={showAddCard} onClose={() => setShowAddCard(false)} onSuccess={fetchPaymentMethods} />
      </LocalErrorBoundary>

      {/* Success Message */}
      {successMsg && <div style={{ marginTop: 24, color: '#6fffbe', fontWeight: 600 }}>{successMsg}</div>}

      {/* Withdraw Stepper Modal */}
      <WithdrawStepper
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onSuccess={fetchWallet}
        onAddCard={() => setShowAddCard(true)}
        balance={balance} // Pass balance as a prop
      />

      {/* ConfirmModal for removing card */}
      <ConfirmModal
        open={showRemoveConfirm}
        title="Remove Payment Method?"
        message={`Are you sure you want to remove card •••• ${removeCardLast4}?${paymentMethods.length === 1 ? '\n\nNote: If you remove your last card, you will not be able to withdraw funds until you add a new card and make a deposit.' : ''}`}
        onConfirm={async () => {
          setShowRemoveConfirm(false);
          if (removeCardId) await handleRemoveCard(removeCardId);
        }}
        onCancel={() => setShowRemoveConfirm(false)}
        confirmText="Remove"
        cancelText="Cancel"
        confirmColor="red"
      />

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 18, gap: 16 }}>
          <Button variant="secondary" size="sm" onClick={handlePrevPage} disabled={currentPage === 1 || loadingTransactions}>
            Previous
          </Button>
          <span style={{ color: '#b3b3c9', fontWeight: 500, fontSize: 16 }}>
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="secondary" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages || loadingTransactions}>
            Next
          </Button>
        </div>
      )}
      {loadingTransactions && <LoadingSpinner message="Loading transactions..." />}
      
      {/* Withdrawal Information Note - Only show for sellers and admins */}
      {(user?.role === 'seller' || user?.role === 'admin') && (
        <div style={{
          marginTop: 32,
          padding: '20px 24px',
          background: 'rgba(35, 43, 74, 0.25)',
          borderRadius: 16,
          border: '1.5px solid rgba(255,255,255,0.08)',
          color: '#b3b3c9',
          fontSize: 14,
          lineHeight: 1.5,
          textAlign: 'center',
          maxWidth: 600,
          margin: '32px auto 0 auto'
        }}>
          <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8, fontSize: 16 }}>
            💡 Important Note
          </div>
          {user?.role === 'seller' ? (
            <div>
              <strong>Seller Earnings:</strong> Funds deposited for buying can only be withdrawn from this wallet. 
             <br/> To withdraw your seller earnings, please use your <strong>Seller Dashboard</strong>.
            </div>
          ) : (
            <div>
              <strong>Admin Earnings:</strong> Funds deposited for buying can only be withdrawn from this wallet. 
              <br/> To withdraw platform fee earnings, please use your <strong>Admin Dashboard</strong>.
            </div>
          )}
        </div>
      )}

      {/* General Withdrawal Info Note for All Users */}
      <div style={{
        marginTop: 18,
        padding: '16px 20px',
        background: 'rgba(35, 43, 74, 0.18)',
        borderRadius: 14,
        border: '1.5px solid rgba(255,255,255,0.06)',
        color: '#b3b3c9',
        fontSize: 14,
        lineHeight: 1.5,
        textAlign: 'center',
        maxWidth: 600,
        margin: '18px auto 0 auto'
      }}>
        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 6, fontSize: 15 }}>
          ℹ️ About Withdrawals
        </div>
        <div>
          When you withdraw money, you may see several smaller transactions instead of one big one. This is normal and just means your withdrawal is being completed in parts. The total will always match what you requested to withdraw.
        </div>
      </div>
    </div>
  );
}

export default Wallet; 
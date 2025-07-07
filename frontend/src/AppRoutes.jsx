import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useContext, useEffect, useRef } from 'react';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import UserDashboard from '../pages/UserDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import NotAuthorized from '../pages/NotAuthorized';
import ProtectedRoute from '../pages/ProtectedRoute';
import Home from '../pages/Home';
import ResetPassword from '../pages/ResetPassword';
import VerifyEmail from '../pages/VerifyEmail';
import ResendVerification from '../pages/ResendVerification';
import SellerDashboard from '../pages/SellerDashboard';
import CreateListing from '../pages/CreateListing';
import Toast from './components/Toast';
import SellerRequestForm from '../pages/SellerRequestForm';
import { UserContext } from './context/UserContext';
import SessionExpiryModal from './components/SessionExpiryModal';
import axios from 'axios';

// Import auction components
import AuctionPage from '../pages/AuctionPage';
import AllAuctionsPage from '../pages/AllAuctionsPage';
import LiveAuctionsPage from '../pages/LiveAuctionsPage';
import SettledAuctionsPage from '../pages/SettledAuctionsPage';
import EndedAuctionPage from '../pages/EndedAuctionPage';

// Import user pages
import MyWinnings from '../pages/MyWinnings';
import MyBidHistory from '../pages/MyBidHistory';
import WonAuctionDetails from '../pages/WonAuctionDetails';
import EditListing from '../pages/EditListing';
import CompletedAuctionDetails from '../pages/CompletedAuctionDetails';
import NotFound from '../pages/NotFound';
import UserProfile from '../pages/UserProfile';
import WinningPage from '../pages/WinningPage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// How long before expiry to show the warning popup (should match backend config)
const SESSION_WARNING_MINUTES = 10;
const SESSION_WARNING_MS = SESSION_WARNING_MINUTES * 60 * 1000;

const TOAST_WARNING_MINUTES = 5;
const TOAST_WARNING_MS = TOAST_WARNING_MINUTES * 60 * 1000;

function parseJwt(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function AppRoutes() {
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(10);
  const { user, setUser } = useContext(UserContext);
  const sessionHandled = useRef(false);
  const navigate = useNavigate();
  const [showExtendToast, setShowExtendToast] = useState(false);
  const [toastCountdown, setToastCountdown] = useState(0);
  const [modalDismissed, setModalDismissed] = useState(false);

  // Session expiry logic
  useEffect(() => {
    let timer;
    let modalTimer;
    let toastTimer;
    let toastInterval;
    if (user && user.token) {
      const payload = parseJwt(user.token);
      if (payload && payload.exp) {
        const expiry = payload.exp * 1000;
        const now = Date.now();
        const msLeft = expiry - now;
        // Show modal SESSION_WARNING_MINUTES before expiry, unless dismissed
        if (msLeft > SESSION_WARNING_MS) {
          modalTimer = setTimeout(() => {
            setMinutesLeft(Math.ceil(SESSION_WARNING_MS / 60000));
            if (!modalDismissed) {
              setShowSessionModal(true);
            }
          }, msLeft - SESSION_WARNING_MS);
        } else if (msLeft > 0) {
          setMinutesLeft(Math.ceil(msLeft / 60000));
          if (!modalDismissed) {
            setShowSessionModal(true);
          }
        }
        // Show toast in last 2 minutes
        if (msLeft > TOAST_WARNING_MS) {
          toastTimer = setTimeout(() => {
            setShowExtendToast(true);
            setToastCountdown(Math.ceil(TOAST_WARNING_MS / 1000));
          }, msLeft - TOAST_WARNING_MS);
        } else if (msLeft > 0) {
          setShowExtendToast(true);
          setToastCountdown(Math.ceil(msLeft / 1000));
        }
        // Countdown for toast
        if (showExtendToast && toastCountdown > 0) {
          toastInterval = setInterval(() => {
            setToastCountdown((prev) => {
              if (prev <= 1) {
                setShowExtendToast(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        // Force logout at expiry
        timer = setTimeout(async () => {
          if (!sessionHandled.current) {
            sessionHandled.current = true;
            setShowSessionModal(false);
            setShowExtendToast(false);
            console.log('[Session] Session expired, logging out');
            // Call backend logout to clear cookies
            try {
              await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
            } catch (e) {}
            localStorage.removeItem('justbetUser');
            localStorage.removeItem('justbetToken');
            setUser(null);
            setToast({ show: true, message: 'Session expired, please log in again.', type: 'error', duration: 5000 });
            navigate('/login');
          }
        }, msLeft);
      }
    } else {
      sessionHandled.current = false;
      setShowExtendToast(false);
      setToastCountdown(0);
      setModalDismissed(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (modalTimer) clearTimeout(modalTimer);
      if (toastTimer) clearTimeout(toastTimer);
      if (toastInterval) clearInterval(toastInterval);
    };
  }, [user, setUser, showExtendToast, toastCountdown, modalDismissed]);

  // Log session expiry info only when a new token is set
  useEffect(() => {
    if (user && user.token) {
      const payload = parseJwt(user.token);
      if (payload && payload.exp) {
        const expiry = new Date(payload.exp * 1000);
        const now = new Date();
        const msLeft = expiry - now;
        console.log(
          `[Session] New token set. Expiry: ${expiry.toLocaleString()} | Now: ${now.toLocaleString()} | Minutes left: ${Math.floor(msLeft / 60000)}`
        );
      }
    }
  }, [user && user.token]);

  const handleExtendSession = async () => {
    console.log('[Session] Extend Session clicked');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/refresh-token`, {}, { withCredentials: true });
      if (res.data && res.data.token) {
        const payload = parseJwt(res.data.token);
        if (payload && payload.exp) {
          console.log('[Session] Session extended! New token exp:', new Date(payload.exp * 1000).toLocaleString());
        }
        setUser({ ...user, token: res.data.token });
        setShowSessionModal(false);
        setShowExtendToast(false);
        setToastCountdown(0);
        setModalDismissed(false);
        setToast({ show: true, message: 'Session extended!', type: 'success', duration: 3000 });
      }
    } catch {
      setShowSessionModal(false);
      setUser(null);
      console.log('[Session] Failed to extend session, logging out');
      setToast({ show: true, message: 'Session expired, please log in again.', type: 'error', duration: 5000 });
    }
  };

  const handleLogout = () => {
    setShowSessionModal(false);
    setUser(null);
    setToast({ show: true, message: 'Logged out successfully!', type: 'success', duration: 3000 });
  };

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
      {showSessionModal && (
        <SessionExpiryModal
          minutesLeft={minutesLeft}
          onExtend={handleExtendSession}
          onClose={() => {
            setShowSessionModal(false);
            setModalDismissed(true);
          }}
        />
      )}
      {showExtendToast && (
        <Toast
          message={`Session expiring in ${toastCountdown} seconds`}
          type="warning"
          duration={TOAST_WARNING_MS}
          actionLabel="Extend Session"
          onAction={handleExtendSession}
          onClose={() => setShowExtendToast(false)}
        />
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login showToast={showToast} />} />
        <Route path="/register" element={<Register showToast={showToast} />} />
        <Route path="/forgot-password" element={<ForgotPassword showToast={showToast} />} />
        <Route path="/reset-password" element={<ResetPassword showToast={showToast} />} />
        <Route path="/verify-email" element={<VerifyEmail showToast={showToast} />} />
        <Route path="/resend-verification" element={<ResendVerification showToast={showToast} />} />
        
        {/* Auction Routes */}
        <Route path="/auctions" element={<AllAuctionsPage />} />
        <Route path="/auction/:type/:id" element={<AuctionPage />} />
        <Route path="/live-auctions" element={<LiveAuctionsPage />} />
        <Route path="/ended-auction/:id" element={<EndedAuctionPage />} />
        <Route path="/settled-auctions" element={<SettledAuctionsPage />} />
        
        {/* User Routes */}
        <Route path="/my-winnings" element={
          <ProtectedRoute>
            <MyWinnings />
          </ProtectedRoute>
        } />
        <Route path="/my-bid-history" element={
          <ProtectedRoute>
            <MyBidHistory />
          </ProtectedRoute>
        } />
        <Route path="/won-auction/:type/:id" element={
          <ProtectedRoute>
            <WonAuctionDetails />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <UserDashboard showToast={showToast} />
          </ProtectedRoute>
        } />
        <Route path="/seller/dashboard" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <SellerDashboard showToast={showToast} />
          </ProtectedRoute>
        } />
        <Route path="/seller/create-listing" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <CreateListing showToast={showToast} />
          </ProtectedRoute>
        } />
        <Route path="/seller/request" element={<SellerRequestForm showToast={showToast} />} />
        <Route path="/seller/edit-listing/:id" element={<ProtectedRoute><EditListing /></ProtectedRoute>} />
        <Route path="/seller/completed-auction/:type/:id" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <CompletedAuctionDetails />
          </ProtectedRoute>
        } />
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/manage-users" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/manage-users/:userId" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/manage-auctions" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/manage-auctions/:type/:auctionId" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/approve-users" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/approve-users/:userId" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/earnings" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/admin/db-health" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard showToast={showToast} /></ProtectedRoute>} />
        <Route path="/not-authorized" element={<NotAuthorized showToast={showToast} />} />
        <Route path="/profile" element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        } />
        <Route path="/winning/:auctionId" element={
          <ProtectedRoute>
            <WinningPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default AppRoutes; 
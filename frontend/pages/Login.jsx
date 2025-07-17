import '@fortawesome/fontawesome-free/css/all.min.css';
import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";
import AuthCard from "../src/components/AuthCard";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";
import ConfirmModal from '../src/components/ConfirmModal';
import apiService from '../src/services/apiService';
import Toast from '../src/components/Toast';
import LoadingSpinner from '../src/components/LoadingSpinner';
import { ImHammer2 } from "react-icons/im";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

// ook checks if the screen is mobile size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function Login({ showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { setUser, user } = useContext(UserContext);
  const hasRedirected = useRef(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [reactivateModal, setReactivateModal] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateUser, setReactivateUser] = useState(null);
  const [shake, setShake] = useState({ email: false, password: false });
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [showResendVerification, setShowResendVerification] = useState(false);

  // On mount, check if user wanted to remember their email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRemember(true);
    }
  }, []);

  // Show logout success toast if user just logged out
  useEffect(() => {
    const showLogoutSuccess = sessionStorage.getItem("showLogoutSuccess");
    if (showLogoutSuccess) {
      sessionStorage.removeItem("showLogoutSuccess");
      showToast && showToast("Logged out successfully!", "success");
    }
  }, [showToast]);

  // Redirect if already logged in
  useEffect(() => {
    if (
      user && user.token && !hasRedirected.current &&
      !(user.status === 'inactive' && user.deletionScheduledAt && reactivateModal)
    ) {
      hasRedirected.current = true;
      // Only show 'already logged in' if NOT just logged in
      if (!justLoggedIn) {
        showToast && showToast('You are already logged in.', 'info');
      }
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'seller') {
        navigate('/seller/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate, showToast, justLoggedIn, reactivateModal]);

  // Simple validation for email and password
  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      newErrors.email = "Invalid email";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShake({ email: !email, password: !password });
    setTimeout(() => setShake({ email: false, password: false }), 500);
    if (!validate()) {
      setToast({ show: true, message: "Email and password are required.", type: "error" });
      setErrors({});
      return;
    }
    if (!email || !password) {
      setToast({ show: true, message: "Email and password must not be empty.", type: "error" });
      setErrors({});
      return;
    }
    setLoading(true);
    setErrors({});
    const loginPayload = { email, password };
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(loginPayload),
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok) {
        // Save email if remember me is checked
        if (remember) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }
        localStorage.setItem("justbetToken", data.token);
        try {
          // Fetch user profile after login
          const profileRes = await fetch(`${backendUrl}/api/auth/profile`, {
            headers: {
              "Authorization": `Bearer ${data.token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            console.log('Fetched user profile:', profileData.user);
            console.log('User role after login:', profileData.user.role);
            const userWithToken = { ...profileData.user, token: data.token };
            // Reactivation check
            if (userWithToken.status === 'inactive' && userWithToken.deletionScheduledAt) {
              console.log('User is inactive and scheduled for deletion:', userWithToken);
              setReactivateUser(userWithToken);
              setReactivateModal(true);
              setUser(userWithToken); // Set user context so modal can use it
              return;
            }
            if (profileData.user.role === "seller") {
              // Fetch latest seller status
              const statusRes = await fetch(`${backendUrl}/api/seller/status`, {
                headers: {
                  "Authorization": `Bearer ${data.token}`,
                  "Content-Type": "application/json",
                },
                credentials: "include",
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                const updatedUser = {
                  ...userWithToken,
                  isApproved: statusData.isApproved
                };
                setUser(updatedUser);
              } else {
                setUser(userWithToken);
              }
              setJustLoggedIn(true);
              showToast && showToast(`Login successful! Welcome, ${userWithToken.firstName || 'User'}`, "success");
              navigate("/seller/dashboard");
            } else if (profileData.user.role === "admin") {
              setUser(userWithToken);
              setJustLoggedIn(true);
              showToast && showToast(`Login successful! Welcome, ${userWithToken.firstName || 'User'}`, "success");
              navigate("/admin/dashboard");
            } else {
              setUser(userWithToken);
              setJustLoggedIn(true);
              showToast && showToast(`Login successful! Welcome, ${userWithToken.firstName || 'User'}`, "success");
              navigate("/dashboard");
            }
          } else {
            setErrors({ form: "Login succeeded but failed to fetch user profile." });
            showToast && showToast("Login succeeded but failed to fetch user profile.", "error");
          }
        } catch (profileErr) {
          setErrors({ form: "Login succeeded but failed to fetch user profile." });
          showToast && showToast("Login succeeded but failed to fetch user profile.", "error");
        }
      } else {
        // If error is auth-related, clear cookies/localStorage
        const errorMsg = (data.error || '').toLowerCase();
        if (
          errorMsg.includes('already logged in') ||
          errorMsg.includes('token expired') ||
          errorMsg.includes('invalid token') ||
          errorMsg.includes('not authenticated')
        ) {
          document.cookie = 'token=; Max-Age=0; path=/;';
          document.cookie = 'refreshToken=; Max-Age=0; path=/;';
          localStorage.removeItem('justbetToken');
          localStorage.removeItem('justbetUser');
          window.location.href = '/login';
          return;
        }
        setToast({ show: true, message: data.error || "Login failed", type: "error" });
        setErrors({});
        if (errorMsg.includes('verify your email')) {
          setShowResendVerification(true);
        } else {
          setShowResendVerification(false);
        }
      }
    } catch (error) {
      setLoading(false);
      setToast({ show: true, message: "Network error. Please try again.", type: "error" });
      setErrors({});
      setShowResendVerification(false);
    }
  };

  // Reactivate handler
  async function handleReactivate() {
    setReactivating(true);
    try {
      await apiService.patch('/api/user/reactivate');
      const data = await apiService.get('/api/user/profile');
      console.log('Fetched user profile after reactivation:', data);
      const updatedUser = { ...data, isApproved: data.is_approved, token: localStorage.getItem('justbetToken') };
      console.log('Updated user after reactivation:', updatedUser);
      setUser(updatedUser);
      localStorage.setItem('justbetUser', JSON.stringify(updatedUser));
      setReactivateModal(false);
      showToast && showToast('Account reactivated successfully!', 'success');
      // Redirect based on role
      if (updatedUser.role === 'seller') {
        navigate('/seller/dashboard');
      } else if (updatedUser.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setReactivateModal(false);
      setUser(null);
      localStorage.removeItem('justbetUser');
      localStorage.removeItem('justbetToken');
      showToast && showToast('Failed to reactivate account. Please contact support.', 'error');
      navigate('/login');
    } finally {
      setReactivating(false);
    }
  }

  // Cancel reactivation: log out and redirect
  async function handleCancelReactivate() {
    setReactivateModal(false);
    setUser(null);
    localStorage.removeItem('justbetUser');
    try {
      await apiService.post('/auth/logout', {}, { withCredentials: true });
    } catch (e) {}
    navigate('/login');
  }

  const form = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
      <input
        type="email"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-purple-400 text-white placeholder-gray-400 focus:outline-none text-base${(errors.email || shake.email) ? " border-red-500" : ""}${shake.email ? " animate-shake" : ""}`}
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-purple-400 text-white placeholder-gray-400 focus:outline-none text-base${(errors.password || shake.password) ? " border-red-500" : ""}${shake.password ? " animate-shake" : ""}`}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-[#efe6dd] focus:outline-none"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
      <div className="flex items-center justify-between text-sm mt-2">
        <label className="flex items-center font-medium leading-tight gap-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="form-checkbox h-4 w-4 text-purple-400 align-middle"
          />
          <span className="align-middle text-white">Remember me</span>
        </label>
        <Link
          to="/forgot-password"
          className="font-semibold transition text-purple-300 hover:text-[#efe6dd] no-underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full py-2 mt-2"
        disabled={loading}
      >
        {loading ? "Signing In..." : "Sign In"}
      </Button>
      <div className={`transition-all duration-300 overflow-hidden ${showResendVerification ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}
           style={{ minHeight: showResendVerification ? 32 : 0 }}>
        {showResendVerification && (
          <div className="text-center">
            <a
              href="/resend-verification"
              className="text-purple-300 hover:text-[#efe6dd] font-medium"
            >
              Resend verification email
            </a>
          </div>
        )}
      </div>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <span className="text-white">Don't have an account?</span>{' '}
      <Link
        to="/register"
        className="font-semibold transition text-purple-300 hover:text-[#efe6dd] no-underline"
      >
        Sign up
      </Link>
    </div>
  );

  if (reactivating) {
    return <LoadingSpinner message="Reactivating..." />;
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={2500}
          onClose={() => setToast(t => ({ ...t, show: false }))}
        />
      )}
      {isMobile ? (
        <AuthCard
          icon={<ImHammer2 className="text-3xl text-white"></ImHammer2>}
          title="Welcome Back"
          subtitle="Sign in to your account"
          error={null}
          footer={footer}
          bgClassName="bg-black/30"
          className="max-w-full p-8 mb-28"
        >
          {form}
        </AuthCard>
      ) : (
        <div className="w-full max-w-3xl my-4 mx-1 bg-black/30 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex scale-90">
          {/* Left side image */}
          <div className="w-1/2 flex items-center justify-center bg-gradient-to-b from-[#23235b] to-[#63e] p-6">
            <img
              src={formImage}
              alt="Login Visual"
              className="object-contain drop-shadow-xl"
              style={{ maxWidth: '300px', maxHeight: '250px', width: '100%', height: 'auto', margin: '0 auto' }}
            />
          </div>
          {/* Right side form */}
          <div className="w-1/2 flex flex-col justify-center py-8 px-8">
            <AuthCard
              icon={<ImHammer2 className="text-3xl text-white"></ImHammer2>}
              title="Welcome Back"
              subtitle="Sign in to your account"
              error={null}
              footer={footer}
              plain={true}
            >
              {form}
            </AuthCard>
          </div>
        </div>
      )}
      {reactivateModal && (
        <ConfirmModal
          open={reactivateModal}
          title="Reactivate Account?"
          message={<div>
            <p>Your account is scheduled for deletion.</p>
            <p className="text-yellow-200 mt-2">Do you want to reactivate your account and cancel deletion?</p>
          </div>}
          confirmText="Yes, Reactivate"
          cancelText="Cancel"
          confirmColor="green"
          loading={reactivateLoading}
          onConfirm={handleReactivate}
          onCancel={handleCancelReactivate}
          disabled={reactivateLoading}
        />
      )}
    </div>
  );
}

export default Login;
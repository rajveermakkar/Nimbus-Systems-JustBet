import React, { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import formImage from "./assets/reset-password.png";
import AuthCard from "../src/components/AuthCard";
import Button from "../src/components/Button";
import Toast from "../src/components/Toast";
import { ImHammer2 } from "react-icons/im";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function ResetPassword({ showToast }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });
  const [focus, setFocus] = useState({ password: false, confirmPassword: false });
  const [shake, setShake] = useState({ password: false, confirmPassword: false });
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const allValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const bothFilled = password.length > 0 && confirmPassword.length > 0;

  // Real-time validation
  const passwordTooShort = touched.password && password.length > 0 && !hasMinLength;
  const passwordsDontMatch = touched.confirmPassword && confirmPassword.length > 0 && !passwordsMatch;

  // Dropdown open if either field is focused or has content and not all valid, and not allValid
  const dropdownOpen =
    ((focus.password || focus.confirmPassword) || password.length > 0 || confirmPassword.length > 0) &&
    !allValid;

  const handleFocus = (field) => setFocus(f => ({ ...f, [field]: true }));
  const handleBlur = (field) => setTimeout(() => setFocus(f => ({ ...f, [field]: false })), 100);

  const checkIcon = (
    <svg className="w-4 h-4 text-green-400 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  const crossIcon = (
    <svg className="w-4 h-4 text-red-400 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );

  const validate = () => {
    const newErrors = {};
    if (!password) newErrors.password = "Password is required";
    else if (!allValid) newErrors.password = "Password does not meet requirements";
    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (!passwordsMatch) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShake({ password: !password, confirmPassword: !confirmPassword });
    setTimeout(() => setShake({ password: false, confirmPassword: false }), 500);
    if (!validate()) {
      if (!passwordsMatch) {
        setToast({ show: true, message: "Passwords do not match", type: "error" });
      } else if (!allValid) {
        setToast({ show: true, message: "Password does not meet requirements", type: "error" });
      }
      return;
    }
    setLoading(true);
    setErrors({});
    setSuccessMsg("");
    try {
      const response = await fetch(`${backendUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok) {
        setSuccessMsg("");
        showToast && showToast("Password reset successful! You can now log in.", "success");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setToast({ show: true, message: data.error || data.message || "Failed to reset password", type: "error" });
      }
    } catch (err) {
      setLoading(false);
      setToast({ show: true, message: "Network error. Please try again.", type: "error" });
    }
  };

  if (!token) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
        <div className="w-full max-w-md bg-black/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex flex-col items-center p-8">
          <h2 className="text-xl font-semibold mb-4">Invalid or missing reset token</h2>
          <Link to="/forgot-password" className="text-purple-300 hover:underline font-medium">Request new reset link</Link>
        </div>
      </div>
    );
  }

  const form = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="password">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            className={`w-full px-3 py-2 rounded bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none text-base${(!password && shake.password) || passwordTooShort || (touched.password && !allValid) || (bothFilled && !passwordsMatch) ? " border-red-500" : allValid && passwordsMatch ? " border-green-500" : ""}${shake.password ? " animate-shake" : ""}`}
            placeholder="New password"
            value={password}
            onChange={e => { setPassword(e.target.value); setTouched(t => ({ ...t, password: true })); }}
            disabled={loading}
            autoComplete="new-password"
            onFocus={() => handleFocus('password')}
            onBlur={() => { setTouched(t => ({ ...t, password: true })); handleBlur('password'); }}
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
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="confirmPassword">Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            className={`w-full px-3 py-2 rounded bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none text-base${(!confirmPassword && shake.confirmPassword) || (confirmPassword && confirmPassword === password && allValid) ? " border-green-500" : (passwordsDontMatch && bothFilled) ? " border-red-500" : ""}${shake.confirmPassword ? " animate-shake" : ""}`}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setTouched(t => ({ ...t, confirmPassword: true })); }}
            disabled={loading}
            autoComplete="new-password"
            onFocus={() => handleFocus('confirmPassword')}
            onBlur={() => { setTouched(t => ({ ...t, confirmPassword: true })); handleBlur('confirmPassword'); }}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-[#efe6dd] focus:outline-none"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            <i className={`fas ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
          </button>
        </div>
      </div>
      {/* Dropdown for password requirements below both fields */}
      <div className={`relative w-full transition-all duration-300 ${dropdownOpen ? 'max-h-60 opacity-100 py-3 px-4' : 'max-h-0 opacity-0 py-0 px-4'} overflow-hidden z-20`}
        style={{ background: dropdownOpen ? 'rgba(24,24,72,0.95)' : 'transparent', borderRadius: dropdownOpen ? '0.75rem' : '0', boxShadow: dropdownOpen ? '0 8px 32px 0 rgba(31, 38, 135, 0.37)' : 'none', border: dropdownOpen ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
      >
        <div className="text-xs text-white/80 font-semibold mb-2">Password must contain:</div>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">{hasMinLength ? checkIcon : crossIcon} Min 8 characters</li>
          <li className="flex items-center gap-2">{hasUpper ? checkIcon : crossIcon} 1 uppercase letter</li>
          <li className="flex items-center gap-2">{hasLower ? checkIcon : crossIcon} 1 lowercase letter</li>
          <li className="flex items-center gap-2">{hasNumber ? checkIcon : crossIcon} 1 number</li>
          <li className="flex items-center gap-2">{hasSpecial ? checkIcon : crossIcon} 1 special character</li>
        </ul>
      </div>
      <Button
        type="submit"
        variant="primary"
        className="w-full py-2 mt-2 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
        disabled={loading}
      >
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <Link
        to="/login"
        className="text-purple-300 font-medium  hover:text-[#efe6dd] no-underline"
      >
        Back to Login
      </Link>
    </div>
  );

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
          title="Reset Password"
          subtitle="Enter your new password below"
          footer={footer}
        >
          {form}
        </AuthCard>
      ) : (
        <div className="w-full max-w-3xl bg-black/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex animate-fade-in">
          {/* Left side image */}
          <div className="w-1/2 flex items-center justify-center bg-gradient-to-b from-[#23235b] to-[#63e] p-6">
            <img
              src={formImage}
              alt="Reset Password Visual"
              className="object-contain drop-shadow-xl"
              style={{ maxWidth: '220px', maxHeight: '220px', width: '100%', height: 'auto', margin: '0 auto' }}
            />
          </div>
          {/* Right side form */}
          <div className="w-1/2 flex flex-col justify-center p-12">
            <AuthCard
              icon={<ImHammer2 className="text-3xl text-white"></ImHammer2>}
              title="Reset Password"
              subtitle="Enter your new password below"
              footer={footer}
              plain={true}
            >
              {form}
            </AuthCard>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResetPassword; 
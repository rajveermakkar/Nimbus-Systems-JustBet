import React, { useState } from "react";
import { Link } from "react-router-dom";
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

function ResendVerification() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [inputShake, setInputShake] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const isMobile = useIsMobile();

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      newErrors.email = "Invalid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      if (!email) setInputShake(true);
      setTimeout(() => setInputShake(false), 500);
      return;
    }
    setLoading(true);
    setErrors({});
    setSuccessMsg("");
    try {
      const response = await fetch(`${backendUrl}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok) {
        setSuccessMsg("Verification email sent! Please check your inbox.");
        setToast({ show: true, message: "Verification email sent! Please check your inbox.", type: "success" });
      } else {
        setToast({ show: true, message: data.error || data.message || "Failed to send verification email", type: "error" });
      }
    } catch (err) {
      setLoading(false);
      setToast({ show: true, message: "Network error. Please try again.", type: "error" });
    }
  };

  const form = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full mt-2">
      <input
        type="email"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-purple-400 text-white placeholder-gray-400 focus:outline-none text-base${(errors.email || inputShake) ? " border-red-500 pr-10" : ""}${inputShake ? " animate-shake" : ""}`}
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        autoComplete="email"
        onAnimationEnd={() => setInputShake(false)}
      />
      {(errors.email || inputShake) && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
          <i className="fa-solid fa-circle-exclamation"></i>
        </span>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full py-2 mt-2"
        disabled={loading}
      >
        {loading ? "Sending..." : "Resend Verification Email"}
      </Button>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <Link
        to="/login" 
        className="text-purple-300 hover:text-[#efe6dd] font-medium"
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
      <div className="w-full max-w-md bg-black/30 backdrop-blur-[16px] text-white shadow-2xl rounded-2xl border border-white/10 flex flex-col items-center p-8" style={{boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'}}>
        <div className="flex flex-col items-center gap-2 mb-6 select-none">
          <ImHammer2 className="text-3xl text-white drop-shadow-lg"></ImHammer2>
          <span className="text-2xl font-bold text-white tracking-wide drop-shadow-lg">JustBet</span>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2 drop-shadow-lg">Resend Verification Email</h2>
        <p className="text-white/80 text-base text-center mb-4">Enter your email to receive a new verification link.</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full mt-2">
          <div className="relative w-full">
            <input
              type="email"
              className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-purple-400 text-white placeholder-gray-400 focus:outline-none text-base${(errors.email || inputShake) ? " border-red-500 pr-10" : ""}${inputShake ? " animate-shake" : ""}`}
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              onAnimationEnd={() => setInputShake(false)}
            />
            {(errors.email || inputShake) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
                <i className="fa-solid fa-circle-exclamation"></i>
              </span>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full py-2 mt-2"
            disabled={loading}
          >
            {loading ? "Sending..." : "Resend Verification Email"}
          </Button>
        </form>
        <div className="text-center mt-6 text-sm w-full">
          <Link
            to="/login"
            className="text-purple-300 hover:text-[#efe6dd] font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResendVerification; 
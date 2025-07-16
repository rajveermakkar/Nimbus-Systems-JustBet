import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../src/components/AuthCard";

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
    if (!validate()) return;
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
      } else {
        setErrors({ form: data.error || data.message || "Failed to send verification email" });
      }
    } catch (err) {
      setLoading(false);
      setErrors({ form: "Network error. Please try again." });
    }
  };

  const form = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full mt-2">
      <input
        type="email"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.email ? "border-red-500" : ""}`}
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        autoComplete="email"
      />
      {errors.email && (
        <p className="text-xs text-red-400 mt-1">{errors.email}</p>
      )}
      <button
        type="submit"
        className="w-full py-2 mt-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
        disabled={loading}
      >
        {loading ? "Sending..." : "Resend Verification Email"}
      </button>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <Link
        to="/login"
        className="text-blue-300 hover:underline font-medium"
      >
        Back to Login
      </Link>
    </div>
  );

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      <div className="w-full max-w-md bg-white/15 backdrop-blur-[16px] text-white shadow-2xl rounded-2xl border border-white/30 flex flex-col items-center p-8" style={{boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'}}>
        <div className="flex flex-col items-center gap-2 mb-6 select-none">
          <i className="fa-solid fa-gavel text-3xl text-white drop-shadow-lg"></i>
          <span className="text-2xl font-bold text-white tracking-wide drop-shadow-lg">JustBet</span>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2 drop-shadow-lg">Resend Verification Email</h2>
        <p className="text-white/80 text-base text-center mb-4">Enter your email to receive a new verification link.</p>
        {errors.form && <p className="text-red-400 font-medium mb-2 drop-shadow">{errors.form}</p>}
        {successMsg && <p className="text-green-300 font-medium mb-2 drop-shadow">{successMsg}</p>}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full mt-2">
          <input
            type="email"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 border-gray-400 focus:border-purple-400 text-white placeholder-gray-400 focus:outline-none text-base ${errors.email ? "border-red-500" : ""}`}
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-xs text-red-400 mt-1">{errors.email}</p>
          )}
          <button
            type="submit"
            className="w-full py-2 mt-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
            disabled={loading}
          >
            {loading ? "Sending..." : "Resend Verification Email"}
          </button>
        </form>
        <div className="text-center mt-6 text-sm w-full">
          <Link
            to="/login"
            className="text-blue-300 hover:underline font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResendVerification; 
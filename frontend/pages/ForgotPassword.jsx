import React, { useState } from "react";
import { Link } from "react-router-dom";
import formImage from "./assets/forgot-password.png";
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

function ForgotPassword({ showToast }) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
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
      const response = await fetch(`${backendUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok) {
        setIsSubmitted(true);
        setSuccessMsg("");
        showToast && showToast("Reset link has been sent to your email!", "success");
      } else {
        setErrors({ form: data.error || data.message || "Failed to send reset link" });
        showToast && showToast(data.error || data.message || "Failed to send reset link", "error");
      }
    } catch (err) {
      setLoading(false);
      setErrors({ form: "Network error. Please try again." });
      showToast && showToast("Network error. Please try again.", "error");
    }
  };

  const form = !isSubmitted ? (
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
        {loading ? "Sending..." : "Send Reset Link"}
      </button>
    </form>
  ) : null;

  const afterSubmit = isSubmitted && (
    <div className="text-center mt-4">
      <Link
        to="/login"
        className="text-blue-300 hover:text-blue-400 font-semibold underline transition"
      >
        Back to Login
      </Link>
    </div>
  );

  const footer = (
    <>
      {afterSubmit}
      <div className="text-center mt-6 text-sm w-full">
        Remember your password?{' '}
        <Link
          to="/login"
          className="text-blue-300 hover:underline font-medium"
        >
          Sign in
        </Link>
      </div>
    </>
  );

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      {isMobile ? (
        <AuthCard
          icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
          title="Forgot your password?"
          subtitle="Enter your email and we'll send you a link to reset your password."
          error={errors.form}
          success={""}
          footer={footer}
        >
          {form}
        </AuthCard>
      ) : (
        <div className="w-full max-w-3xl bg-white/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex animate-fade-in">
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
              icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
              title="Forgot your password?"
              subtitle="Enter your email and we'll send you a link to reset your password."
              error={errors.form}
              success={""}
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

export default ForgotPassword;

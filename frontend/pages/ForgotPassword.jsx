import React, { useState } from "react";
import { Link } from "react-router-dom";
import formImage from "./assets/forgot-password.png";
import AuthCard from "../src/components/AuthCard";
import Button from "../src/components/Button";
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

function ForgotPassword({ showToast }) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [inputShake, setInputShake] = useState(false);
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
        // Show toast only, no inline error
        if ((data.error || data.message || "").toLowerCase().includes("user not found")) {
          showToast && showToast("User not exist with this email", "error");
        } else {
          showToast && showToast(data.error || data.message || "Failed to send reset link", "error");
        }
      }
    } catch (err) {
      setLoading(false);
      showToast && showToast("Network error. Please try again.", "error");
    }
  };

  const form = !isSubmitted ? (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full mt-2">
      <div className="relative w-full">
        <input
          type="email"
          className={`w-full px-3 py-2 rounded bg-transparent border-2 ${(errors.email || inputShake) ? "border-red-500 placeholder-red-400" : "border-gray-400 focus:border-purple-400"} text-white placeholder-gray-400 focus:outline-none text-base pr-10${inputShake ? ' animate-shake' : ''}`}
          placeholder={errors.email ? "Email Required" : "Email address"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          onAnimationEnd={e => setInputShake(false)}
        />
        {(errors.email || inputShake) && (
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-60 pointer-events-none${inputShake ? ' animate-shake' : ''}`}>
            <i className="fa-solid fa-circle-exclamation"></i>
          </span>
        )}
        {/* No error message below input */}
      </div>
      <Button
        type="submit"
        variant="primary"
        className="w-full py-2 mt-2 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
        disabled={loading}
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  ) : null;

  const afterSubmit = isSubmitted && (
    <div className="text-center mt-4">
      <Link
        to="/login"
        className="text-purple-300 hover:text-purple-700 font-semibold underline transition"
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
          className="text-purple-300 font-medium hover:text-[#efe6dd] no-underline"
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
          icon={<ImHammer2 className="text-3xl text-white"></ImHammer2>}
          title="Forgot your password?"
          subtitle="Enter your email and we'll send you a link to reset your password."
          error={errors.form}
          success={""}
          footer={footer}
        >
          {form}
        </AuthCard>
      ) : (
        <div className="w-full max-w-3xl bg-black/30 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex animate-fade-in">
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

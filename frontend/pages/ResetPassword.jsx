import React, { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import formImage from "./assets/reset-password.png";
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

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const validate = () => {
    const newErrors = {};
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (confirmPassword !== password) newErrors.confirmPassword = "Passwords do not match";
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
      const response = await fetch(`${backendUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok) {
        setSuccessMsg("Password reset successful! You can now log in.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setErrors({ form: data.error || data.message || "Failed to reset password" });
      }
    } catch (err) {
      setLoading(false);
      setErrors({ form: "Network error. Please try again." });
    }
  };

  if (!token) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex flex-col items-center p-8">
          <h2 className="text-xl font-semibold mb-4">Invalid or missing reset token</h2>
          <Link to="/forgot-password" className="text-blue-300 hover:underline font-medium">Request new reset link</Link>
        </div>
      </div>
    );
  }

  const form = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
      <input
        type="password"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.password ? "border-red-500" : ""}`}
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        autoComplete="new-password"
      />
      <input
        type="password"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.confirmPassword ? "border-red-500" : ""}`}
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading}
        autoComplete="new-password"
      />
      <button
        type="submit"
        className="w-full py-2 mt-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
        disabled={loading}
      >
        {loading ? "Resetting..." : "Reset Password"}
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
      {isMobile ? (
        <AuthCard
          icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
          title="Reset Password"
          subtitle="Enter your new password below"
          error={errors.form || errors.password || errors.confirmPassword}
          success={successMsg}
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
              title="Reset Password"
              subtitle="Enter your new password below"
              error={errors.form || errors.password || errors.confirmPassword}
              success={successMsg}
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
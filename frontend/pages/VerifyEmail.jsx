import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError("Missing verification token.");
      setLoading(false);
      return;
    }
    const verify = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/auth/verify-email?token=${token}`);
        const data = await response.json();
        if (response.ok) {
          setSuccess(true);
          setShowToast(true);
          setTimeout(() => {
            setShowToast(false);
            navigate("/login", { state: { verified: true } });
          }, 2000);
        } else {
          setError(data.error || data.message || "Verification failed.");
        }
      } catch (err) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token, navigate]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      <div className="w-full max-w-4xl bg-white/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex">
        {/* Left side image */}
        <div className="hidden lg:block w-1/2">
          <img
            src={formImage}
            alt="Verify Email Visual"
            className="object-cover w-full h-full"
          />
        </div>
        {/* Right side */}
        <div className="flex-1 flex flex-col justify-center p-12 items-center">
          <div className="flex flex-col items-center gap-2 mb-6 select-none">
            <i className="fa-solid fa-gavel text-3xl text-white"></i>
            <span className="text-2xl font-bold text-white tracking-wide">JustBet</span>
          </div>
          <h2 className="text-xl font-semibold text-white text-center mb-1">Email Verification</h2>
          {loading && <p className="text-gray-300 text-base text-center mb-4">Verifying your email...</p>}
          {!loading && !success && error && (
            <div className="text-center">
              <p className="text-red-400 font-medium mb-2">{error}</p>
              <Link to="/login" className="text-blue-300 hover:underline font-medium">Back to Login</Link>
            </div>
          )}
          {success && showToast && (
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded shadow-lg z-50 animate-fade-in">
              Email verified successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail; 
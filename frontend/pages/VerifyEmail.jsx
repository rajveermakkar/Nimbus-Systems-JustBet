import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";
import Toast from "../src/components/Toast";
import { ImHammer2 } from "react-icons/im";

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
      {success && showToast && (
        <Toast
          message="Email verified successfully!"
          type="success"
          duration={2000}
          onClose={() => {
            setShowToast(false);
            navigate("/login", { state: { verified: true } });
          }}
        />
      )}
      <div className="w-full max-w-3xl bg-black/15 backdrop-blur-[16px] text-white shadow-2xl rounded-2xl overflow-hidden border border-white/30 flex" style={{boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'}}>
        {/* Left side image */}
        <div className="hidden lg:block w-1/2 bg-gradient-to-b from-[#23235b] to-[#63e]">
          <img
            src={formImage}
            alt="Verify Email Visual"
            className="object-contain w-full h-full p-8 drop-shadow-xl"
          />
        </div>
        {/* Right side */}
        <div className="flex-1 flex flex-col justify-center p-12 items-center">
          <div className="flex flex-col items-center gap-2 mb-6 select-none">
            <ImHammer2 className="text-3xl text-white drop-shadow-lg"></ImHammer2>
            <span className="text-2xl font-bold text-white tracking-wide drop-shadow-lg">JustBet</span>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2 drop-shadow-lg">Email Verification</h2>
          {loading && <p className="text-gray-200 text-base text-center mb-4">Verifying your email...</p>}
          {!loading && !success && error && (
            <div className="text-center">
              <p className="text-red-400 font-medium mb-2 drop-shadow">{error}</p>
              <Link to="/login" className="text-blue-300 hover:underline font-medium">Back to Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail; 
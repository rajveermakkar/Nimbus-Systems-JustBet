import React, { useState } from "react";
import { Link } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      newErrors.email = "Invalid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Here you would typically make an API call to send the reset link
      setIsSubmitted(true);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="text-center mb-4">
          <a href="/" className="flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-gavel w-8 h-8 text-blue-500"
            >
              <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"></path>
              <path d="m16 16 6-6"></path>
              <path d="m8 8 6-6"></path>
              <path d="m9 7 8 8"></path>
              <path d="m21 11-8-8"></path>
            </svg>
            <span className="text-xl font-bold text-white">JustBet</span>
          </a>
          <div className="login-title">Forgot Password</div>
          <div className="login-subtitle">Enter your email to reset password</div>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="login-label">Email Address</label>
              <div className="login-input-group">
                <span>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M4 4h16v16H4V4zm0 0l8 8 8-8"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {errors.email && <div className="login-error">{errors.email}</div>}
            </div>
            <button type="submit" className="login-btn">
              Send Reset Link
            </button>
          </form>
        ) : (
          <div className="text-center">
            <div className="text-green-500 mb-4">
              Reset link has been sent to your email!
            </div>
          </div>
        )}

        <div className="login-footer">
          Remember your password?{" "}
          <Link to="/login" className="login-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword; 
import React, { useState } from "react";
import { Link } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";

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
      setIsSubmitted(true);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center px-5 py-10 [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)]">
      <div className="flex w-full h-4/5 max-w-6xl bg-white/10 backdrop-blur-sm text-white shadow-lg rounded-lg overflow-hidden">
        {/* Left Image Section */}
        <div className="hidden lg:block w-1/2">
          <img
            src={formImage}
            alt="Login Visual"
            className="object-cover w-full h-full"
          />
        </div>
        {/* Right Form Section */}
        <div className="flex-1 px-10 py-10">
          <div className="text-center mb-6">
            <a
              href="/login"
              className="d-flex justify-content-center align-items-center gap-2 mb-2 text-decoration-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"></path>
                <path d="m16 16 6-6"></path>
                <path d="m8 8 6-6"></path>
                <path d="m9 7 8 8"></path>
                <path d="m21 11-8-8"></path>
              </svg>
              <span className="fs-2 fw-bold text-white">JustBet</span>
            </a>
            <h2 className="text-2xl font-semibold">Forgot Password</h2>
          </div>

          {/* Form */}
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <div className="flex items-center bg-gray-700 rounded-md px-3 py-2">
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="text-blue-500 mr-2"
                  >
                    <path
                      d="M4 4h16v16H4V4zm0 0l8 8 8-8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <input
                    type="email"
                    className="w-full bg-transparent focus:outline-none text-white placeholder-gray-400"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-400 mt-1">{errors.email}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition"
              >
                Send Reset Link
              </button>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-green-400 font-medium">
                Reset link has been sent to your email!
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-6 text-lg">
            Remember your password?{" "}
            <Link
              to="/login"
              className="text-blue-400 hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;

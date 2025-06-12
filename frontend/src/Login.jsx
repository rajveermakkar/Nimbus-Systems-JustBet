import React, { useState } from "react";
import { Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      newErrors.email = "Invalid email";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // handle login logic
      alert("Logged in!");
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="text-center mb-4">
          <a
            data-lov-id="src/components/Navigation.tsx:15:10"
            data-lov-name="Link"
            data-component-path="src/components/Navigation.tsx"
            data-component-line="15"
            data-component-file="Navigation.tsx"
            data-component-name="Link"
            data-component-content="%7B%22className%22%3A%22flex%20items-center%20space-x-2%22%7D"
            class="flex items-center space-x-2"
            href="/"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-gavel w-8 h-8 text-blue-500"
              data-lov-id="src/components/Navigation.tsx:16:12"
              data-lov-name="Gavel"
              data-component-path="src/components/Navigation.tsx"
              data-component-line="16"
              data-component-file="Navigation.tsx"
              data-component-name="Gavel"
              data-component-content="%7B%22className%22%3A%22w-8%20h-8%20text-blue-500%22%7D"
            >
              <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"></path>
              <path d="m16 16 6-6"></path>
              <path d="m8 8 6-6"></path>
              <path d="m9 7 8 8"></path>
              <path d="m21 11-8-8"></path>
            </svg>
            <span
              data-lov-id="src/components/Navigation.tsx:17:12"
              data-lov-name="span"
              data-component-path="src/components/Navigation.tsx"
              data-component-line="17"
              data-component-file="Navigation.tsx"
              data-component-name="span"
              data-component-content="%7B%22text%22%3A%22JustBet%22%2C%22className%22%3A%22text-xl%20font-bold%20text-white%22%7D"
              class="text-xl font-bold text-white"
            >
              JustBet
            </span>
          </a>
          <div className="login-title">Welcome Back</div>
          <div className="login-subtitle">Sign in to your account</div>
        </div>
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
          <div className="mb-3">
            <label className="login-label">Password</label>
            <div className="login-input-group">
              <span>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-6V9a6 6 0 10-12 0v2a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2z"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <input
                type="password"
                className="login-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errors.password && (
              <div className="login-error">{errors.password}</div>
            )}
          </div>
          <div
            className="mb-3"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="login-link">
              Forgot password?
            </Link>
          </div>
          <button type="submit" className="login-btn">
            Sign In
          </button>
        </form>
        <div className="login-footer">
          Don't have an account?{" "}
          <Link to="/register" className="login-link">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;

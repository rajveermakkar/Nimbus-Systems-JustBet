import '@fortawesome/fontawesome-free/css/all.min.css';
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

// ook checks if the screen is mobile size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

// login form UI
function LoginFormContent({
  email,
  setEmail,
  password,
  setPassword,
  remember,
  setRemember,
  errors,
  loading,
  handleSubmit
}) {
  return (
    <>
      {/* Logo and title */}
      <div className="flex flex-col items-center gap-2 mb-6 select-none">
        <i className="fa-solid fa-gavel text-3xl text-white"></i>
        <span className="text-2xl font-bold text-white tracking-wide">JustBet</span>
      </div>
      <h2 className="text-xl font-semibold text-white text-center mb-1">Welcome Back</h2>
      <p className="text-gray-300 text-base text-center mb-4">Sign in to your account</p>
      {/* Show error message if there is one */}
      <div style={{ minHeight: '24px' }}>
        {errors.form ? (
          <p className="text-sm text-red-400 mb-2 text-center">{errors.form}</p>
        ) : null}
      </div>
      {/* The login form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
        {/* Email input */}
        <input
          type="email"
          className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.email ? "border-red-500" : ""}`}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {/* Password input */}
        <input
          type="password"
          className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.password ? "border-red-500" : ""}`}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {/* Remember me and forgot password */}
        <div className="flex items-center justify-between text-sm mt-2">
          <label className="flex items-center font-medium leading-tight gap-1">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-500 align-middle"
            />
            <span className="align-middle text-white">Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-blue-300 hover:text-blue-400 font-semibold underline transition"
          >
            Forgot password?
          </Link>
        </div>
        {/* Submit button */}
        <button
          type="submit"
          className="w-full py-2 mt-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
          disabled={loading}
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>
      {/* Link to register page */}
      <div className="text-center mt-6 text-sm w-full">
        <span className="text-white">Don't have an account?</span>{' '}
        <Link
          to="/register"
          className="text-blue-300 hover:text-blue-400 font-semibold underline transition"
        >
          Sign up
        </Link>
      </div>
    </>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // On mount, check if user wanted to remember their email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRemember(true);
    }
  }, []);

  // Simple validation for email and password
  const validate = () => {
    const newErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      newErrors.email = "Invalid email";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setErrors({ form: "Email and password are required." });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setLoading(false);
      if (response.ok) {
        // Save email if remember me is checked
        if (remember) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }
        try {
          // Fetch user profile after login
          const profileRes = await fetch(`${backendUrl}/api/auth/profile`, {
            credentials: "include",
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            localStorage.setItem("justbetUser", JSON.stringify(profileData.user));
            // Redirect based on user role
            if (profileData.user.role === "admin") {
              navigate("/admin/dashboard");
            } else {
              navigate("/dashboard");
            }
          } else {
            setErrors({ form: "Login succeeded but failed to fetch user profile." });
          }
        } catch (profileErr) {
          setErrors({ form: "Login succeeded but failed to fetch user profile." });
        }
      } else {
        setErrors({ form: data.error || "Login failed" });
      }
    } catch (error) {
      setLoading(false);
      setErrors({ form: "Network error. Please try again." });
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      {isMobile ? (
        // Mobile layout
        <div className="w-full max-w-sm mx-auto bg-white/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 p-6 animate-fade-in">
          <LoginFormContent
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            remember={remember}
            setRemember={setRemember}
            errors={errors}
            loading={loading}
            handleSubmit={handleSubmit}
          />
        </div>
      ) : (
        // Desktop layout
        <div className="w-full max-w-4xl bg-white/10 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex">
          {/* Left side image */}
          <div className="w-1/2">
            <img
              src={formImage}
              alt="Login Visual"
              className="object-cover w-full h-full"
            />
          </div>
          {/* Right side form */}
          <div className="w-1/2 flex flex-col justify-center p-12"> 
            <LoginFormContent
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              remember={remember}
              setRemember={setRemember}
              errors={errors}
              loading={loading}
              handleSubmit={handleSubmit}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
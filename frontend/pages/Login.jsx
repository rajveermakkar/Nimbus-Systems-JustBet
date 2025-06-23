import '@fortawesome/fontawesome-free/css/all.min.css';
import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";
import AuthCard from "../src/components/AuthCard";
import { UserContext } from "../src/context/UserContext";

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

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [showVerifiedToast, setShowVerifiedToast] = useState(false);
  const { setUser } = useContext(UserContext);

  // On mount, check if user wanted to remember their email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRemember(true);
    }
  }, []);

  // Show toast if redirected from email verification
  useEffect(() => {
    if (location.state && location.state.verified) {
      setShowVerifiedToast(true);
      setTimeout(() => setShowVerifiedToast(false), 2000);
    }
  }, [location.state]);

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
        localStorage.setItem("justbetToken", data.token);
        try {
          // Fetch user profile after login
          const profileRes = await fetch(`${backendUrl}/api/auth/profile`, {
            credentials: "include",
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.user.role === "seller") {
              // Fetch latest seller status
              const statusRes = await fetch(`${backendUrl}/api/seller/status`, {
                credentials: "include",
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                const updatedUser = {
                  ...profileData.user,
                  isApproved: statusData.isApproved,
                  businessDetails: statusData.businessDetails,
                };
                setUser(updatedUser);
              } else {
                setUser(profileData.user);
              }
              navigate("/dashboard");
            } else if (profileData.user.role === "admin") {
              setUser(profileData.user);
              navigate("/admin/dashboard");
            } else {
              setUser(profileData.user);
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

  const form = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full">
      <input
        type="email"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.email ? "border-red-500" : ""}`}
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.password ? "border-red-500" : ""}`}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
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
      <button
        type="submit"
        className="w-full py-2 mt-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200"
        disabled={loading}
      >
        {loading ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <span className="text-white">Don't have an account?</span>{' '}
      <Link
        to="/register"
        className="text-blue-300 hover:text-blue-400 font-semibold underline transition"
      >
        Sign up
      </Link>
    </div>
  );

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      {showVerifiedToast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded shadow-lg z-50 animate-fade-in">
          Email verified successfully!
        </div>
      )}
      {isMobile ? (
        <AuthCard
          icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
          title="Welcome Back"
          subtitle="Sign in to your account"
          error={errors.form}
          footer={footer}
        >
          {errors.form === "Please verify your email first" && (
            <div className="text-center mb-2">
              <a href="/resend-verification" className="text-blue-300 hover:underline font-medium">Resend verification email</a>
            </div>
          )}
          {form}
        </AuthCard>
      ) : (
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
            <AuthCard
              icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
              title="Welcome Back"
              subtitle="Sign in to your account"
              error={errors.form}
              footer={footer}
              plain={true}
            >
              {errors.form === "Please verify your email first" && (
                <div className="text-center mb-2">
                  <a href="/resend-verification" className="text-blue-300 hover:underline font-medium">Resend verification email</a>
                </div>
              )}
              {form}
            </AuthCard>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
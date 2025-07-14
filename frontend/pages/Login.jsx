import '@fortawesome/fontawesome-free/css/all.min.css';
import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import formImage from "./assets/auction_online.jpg";
import AuthCard from "../src/components/AuthCard";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";

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

function Login({ showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { setUser, user } = useContext(UserContext);
  const hasRedirected = useRef(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      showToast && showToast("Email verified successfully!", "success");
    }
  }, [location.state, showToast]);

  // Show logout success toast if user just logged out
  useEffect(() => {
    const showLogoutSuccess = sessionStorage.getItem("showLogoutSuccess");
    if (showLogoutSuccess) {
      sessionStorage.removeItem("showLogoutSuccess");
      showToast && showToast("Logged out successfully!", "success");
    }
  }, [showToast]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && user.token && !hasRedirected.current) {
      hasRedirected.current = true;
      // Only show 'already logged in' if NOT just logged in
      if (!justLoggedIn) {
        showToast && showToast('You are already logged in.', 'info');
      }
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate, showToast, justLoggedIn]);

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
    if (!email || !password) {
      setErrors({ form: "Email and password must not be empty." });
      return;
    }
    setLoading(true);
    setErrors({});
    const loginPayload = { email, password };
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(loginPayload),
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
            headers: {
              "Authorization": `Bearer ${data.token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const userWithToken = { ...profileData.user, token: data.token };
            if (profileData.user.role === "seller") {
              // Fetch latest seller status
              const statusRes = await fetch(`${backendUrl}/api/seller/status`, {
                headers: {
                  "Authorization": `Bearer ${data.token}`,
                  "Content-Type": "application/json",
                },
                credentials: "include",
              });
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                const updatedUser = {
                  ...userWithToken,
                  isApproved: statusData.isApproved,
                  businessDetails: statusData.businessDetails,
                };
                setUser(updatedUser);
              } else {
                setUser(userWithToken);
              }
              setJustLoggedIn(true);
              showToast && showToast(`Login successful! Welcome, ${userWithToken.firstName || 'User'}`, "success");
              navigate("/dashboard");
            } else if (profileData.user.role === "admin") {
              setUser(userWithToken);
              setJustLoggedIn(true);
              showToast && showToast(`Login successful! Welcome, ${userWithToken.firstName || 'User'}`, "success");
              navigate("/admin/dashboard");
            } else {
              setUser(userWithToken);
              setJustLoggedIn(true);
              showToast && showToast(`Login successful! Welcome, ${userWithToken.firstName || 'User'}`, "success");
              navigate("/dashboard");
            }
          } else {
            setErrors({ form: "Login succeeded but failed to fetch user profile." });
            showToast && showToast("Login succeeded but failed to fetch user profile.", "error");
          }
        } catch (profileErr) {
          setErrors({ form: "Login succeeded but failed to fetch user profile." });
          showToast && showToast("Login succeeded but failed to fetch user profile.", "error");
        }
      } else {
        setErrors({ form: data.error || "Login failed" });
        showToast && showToast(data.error || "Login failed", "error");
      }
    } catch (error) {
      setLoading(false);
      setErrors({ form: "Network error. Please try again." });
      showToast && showToast("Network error. Please try again.", "error");
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
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className={`w-full px-3 py-2 rounded bg-transparent border-2 border-gray-400 focus:border-blue-500 text-white placeholder-gray-400 focus:outline-none text-base ${errors.password ? "border-red-500" : ""}`}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-[#efe6dd] focus:outline-none"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
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
          className="font-semibold transition text-purple-300 hover:text-[#efe6dd] no-underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full py-2 mt-2"
        disabled={loading}
      >
        {loading ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <span className="text-white">Don't have an account?</span>{' '}
      <Link
        to="/register"
        className="font-semibold transition text-purple-300 hover:text-[#efe6dd] no-underline"
      >
        Sign up
      </Link>
    </div>
  );

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      {isMobile ? (
        <AuthCard
          icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
          title="Welcome Back"
          subtitle="Sign in to your account"
          error={errors.form}
          footer={footer}
          bgClassName="bg-black/30"
        >
          {errors.form === "Please verify your email first" && (
            <div className="text-center mb-2">
              <a href="/resend-verification" className="text-blue-300 hover:underline font-medium">Resend verification email</a>
            </div>
          )}
          {form}
        </AuthCard>
      ) : (
        <div className="w-full max-w-3xl my-4 mx-1 bg-black/30 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex scale-90">
          {/* Left side image */}
          <div className="w-1/2 flex items-center justify-center bg-gradient-to-b from-[#23235b] to-[#63e] p-6">
            <img
              src={formImage}
              alt="Login Visual"
              className="object-contain drop-shadow-xl"
              style={{ maxWidth: '300px', maxHeight: '250px', width: '100%', height: 'auto', margin: '0 auto' }}
            />
          </div>
          {/* Right side form */}
          <div className="w-1/2 flex flex-col justify-center py-8 px-8">
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
import React, { useState, useRef, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../src/components/AuthCard";
import registerImage from "./assets/register.png";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";
import Modal from "../src/components/Modal";
import LoadingSpinner from "../src/components/LoadingSpinner";
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

function Register({ showToast }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useContext(UserContext);
  const hasRedirected = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && user.token && !hasRedirected.current) {
      hasRedirected.current = true;
      // If coming from registration, show registration message, else show already logged in
      if (window.history.state && window.history.state.usr && window.history.state.usr.fromRegister) {
        showToast && showToast('Registration successful! Please log in.', 'success');
      } else {
        showToast && showToast('You are already logged in.', 'info');
      }
      navigate('/dashboard');
    }
  }, [user, navigate, showToast]);

  const validate = () => {
    const newErrors = {};
    if (!form.firstName) newErrors.firstName = "First name is required";
    else if (!/^[A-Za-z\s'-]+$/.test(form.firstName)) newErrors.firstName = "First name can only contain letters, spaces, hyphens, and apostrophes";
    if (!form.lastName) newErrors.lastName = "Last name is required";
    else if (!/^[A-Za-z\s'-]+$/.test(form.lastName)) newErrors.lastName = "Last name can only contain letters, spaces, hyphens, and apostrophes";
    if (!form.email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      newErrors.email = "Invalid email";
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (!form.confirmPassword)
      newErrors.confirmPassword = "Please confirm your password";
    else if (form.confirmPassword !== form.password)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowVerifyModal(true);
      } else {
        setErrors({ form: data.error || data.message || "Registration failed" });
      }
    } catch (error) {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const formFields = (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="firstName">First Name</label>
          <input
            type="text"
            name="firstName"
            id="firstName"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.firstName ? "border-red-500" : ""}`}
            placeholder="First name"
            value={form.firstName}
            onChange={handleChange}
            autoComplete="given-name"
          />
          {errors.firstName && (
            <p className="text-xs text-red-400 mt-1">{errors.firstName}</p>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="lastName">Last Name</label>
          <input
            type="text"
            name="lastName"
            id="lastName"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.lastName ? "border-red-500" : ""}`}
            placeholder="Last name"
            value={form.lastName}
            onChange={handleChange}
            autoComplete="family-name"
          />
          {errors.lastName && (
            <p className="text-xs text-red-400 mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="email">Email</label>
        <input
          type="email"
          name="email"
          id="email"
          className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.email ? "border-red-500" : ""}`}
          placeholder="Email address"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-xs text-red-400 mt-1">{errors.email}</p>
        )}
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="password">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            id="password"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.password ? "border-red-500" : ""}`}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-[#8B5FBF] focus:outline-none"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400 mt-1">{errors.password}</p>
        )}
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="confirmPassword">Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            id="confirmPassword"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.confirmPassword ? "border-red-500" : ""}`}
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-[#8B5FBF] focus:outline-none"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            <i className={`fas ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>
        )}
      </div>
      {errors.form && (
        <p className="text-sm text-red-400 text-center">{errors.form}</p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full py-2 mt-2"
        disabled={loading}
      >
        Register
      </Button>
    </form>
  );

  const footer = (
    <div className="text-center mt-6 text-sm w-full">
      <span className="text-white">Already have an account?</span>{' '}
      <Link
        to="/login"
        className="font-semibold transition text-purple-300 hover:text-[#efe6dd] no-underline"
      >
        Sign in
      </Link>
    </div>
  );

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      {loading && <LoadingSpinner message="Registering..." />}
      <Modal
        open={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);
          navigate("/login");
        }}
        title="Verify Your Email"
      >
        <div className="text-center text-lg">
          Registration Successful !! <br/>
          Check your email and you must verify it before logging in.
        </div>
        <Button
          type="button"
          variant="primary"
          className="w-full mt-4"
          onClick={() => {
            setShowVerifyModal(false);
            navigate("/login");
          }}
        >
          Go to Login
        </Button>
      </Modal>
      {isMobile ? (
        <AuthCard
          icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
          title="Create your account"
          subtitle="Join our community!"
          error={errors.form}
          footer={footer}
          bgClassName="bg-black/30"
          className="max-w-full p-8 mb-10"
        >
          {formFields}
        </AuthCard>
      ) : (
        <div className="w-full max-w-4xl my-1 mx-1 bg-black/30 backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 flex scale-90 animate-fade-in">
          {/* Left side image */}
          <div className="w-1/2 flex items-center justify-center bg-gradient-to-b from-[#23235b] to-[#63e] p-6">
            <img
              src={registerImage}
              alt="Register Visual"
              className="object-contain drop-shadow-xl"
              style={{ maxWidth: '300px', maxHeight: '250px', width: '100%', height: 'auto', margin: '0 auto' }}
            />
          </div>
          {/* Right side form */}
          <div className="w-1/2 flex flex-col justify-center py-8 px-8">
            <AuthCard
              icon={<i className="fa-solid fa-gavel text-3xl text-white"></i>}
              title="Create your account"
              subtitle="Join our community!"
              error={errors.form}
              footer={footer}
              plain={true}
            >
              <form onSubmit={handleSubmit} noValidate className="w-full space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="firstName">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.firstName ? "border-red-500" : ""}`}
                      placeholder="First name"
                      value={form.firstName}
                      onChange={handleChange}
                      autoComplete="given-name"
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-400 mt-1">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      id="lastName"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.lastName ? "border-red-500" : ""}`}
                      placeholder="Last name"
                      value={form.lastName}
                      onChange={handleChange}
                      autoComplete="family-name"
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-400 mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="email">Email</label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.email ? "border-red-500" : ""}`}
                    placeholder="Email address"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-400 mt-1">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="password">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      id="password"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.password ? "border-red-500" : ""}`}
                      placeholder="Password"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="new-password"
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
                  {errors.password && (
                    <p className="text-xs text-red-400 mt-1">{errors.password}</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="confirmPassword">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      id="confirmPassword"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm ${errors.confirmPassword ? "border-red-500" : ""}`}
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-[#efe6dd] focus:outline-none"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      <i className={`fas ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
                {errors.form && (
                  <p className="text-sm text-red-400 text-center">{errors.form}</p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full py-2 mt-2"
                  disabled={loading}
                >
                  Register
                </Button>
              </form>
            </AuthCard>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;

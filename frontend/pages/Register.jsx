import React, { useState, useRef, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../src/components/AuthCard";
import registerImage from "./assets/register.png";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";
import Modal from "../src/components/Modal";
import LoadingSpinner from "../src/components/LoadingSpinner";
import Toast from "../src/components/Toast";
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
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [touched, setTouched] = useState({ password: false, confirmPassword: false, email: false, firstName: false, lastName: false });
  const [focus, setFocus] = useState({ password: false, confirmPassword: false });
  const [shake, setShake] = useState({ email: false, password: false, confirmPassword: false, firstName: false, lastName: false });

  // Password requirement checks
  const hasMinLength = form.password.length >= 8;
  const hasUpper = /[A-Z]/.test(form.password);
  const hasLower = /[a-z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const hasSpecial = /[^A-Za-z0-9]/.test(form.password);
  const allValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = form.password && form.confirmPassword && form.password === form.confirmPassword;
  const bothFilled = form.password.length > 0 && form.confirmPassword.length > 0;

  // Email validation
  const emailRegex = /^(?!.*\.\.)(?!\.)([A-Za-z0-9._-]+)(?<!\.)@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
  const emailInvalid = touched.email && (!form.email || !emailRegex.test(form.email));

  // Dropdown open if either password field is focused or has content and not all valid
  const dropdownOpen =
    ((focus.password || focus.confirmPassword) || form.password.length > 0 || form.confirmPassword.length > 0) &&
    !allValid;

  const handleFocus = (field) => setFocus(f => ({ ...f, [field]: true }));
  const handleBlur = (field) => setTimeout(() => setFocus(f => ({ ...f, [field]: false })), 100);

  const checkIcon = (
    <svg className="w-4 h-4 text-green-400 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  const crossIcon = (
    <svg className="w-4 h-4 text-red-400 inline-block mr-1" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );

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
    else if (!emailRegex.test(form.email)) newErrors.email = "Invalid email format";
    if (!form.password) newErrors.password = "Password is required";
    else if (!allValid) newErrors.password = "Password does not meet requirements";
    if (!form.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (!passwordsMatch) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper to validate first/last name
  function validateNameField(name, value) {
    if (!value) {
      setErrors(errs => ({ ...errs, [name]: name === 'firstName' ? 'First name is required' : 'Last name is required' }));
    } else if (value.length > 30) {
      setErrors(errs => ({ ...errs, [name]: 'Maximum 30 characters allowed' }));
    } else if (!/^[A-Za-z\s'-]+$/.test(value)) {
      setErrors(errs => ({ ...errs, [name]: name === 'firstName'
        ? "First name can only contain letters, spaces, hyphens, and apostrophes"
        : "Last name can only contain letters, spaces, hyphens, and apostrophes" }));
    } else {
      setErrors(errs => ({ ...errs, [name]: undefined }));
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Collapse multiple spaces and trim
    let cleaned = value.replace(/\s+/g, ' ').trim();
    setForm({ ...form, [name]: cleaned });
    if (name === 'firstName') setTouched(t => ({ ...t, firstName: true }));
    if (name === 'lastName') setTouched(t => ({ ...t, lastName: true }));
    if (name === 'email') setTouched(t => ({ ...t, email: true }));
    if (name === 'password') setTouched(t => ({ ...t, password: true }));
    if (name === 'confirmPassword') setTouched(t => ({ ...t, confirmPassword: true }));
    // Real-time error set/clear for firstName/lastName
    if (name === 'firstName' || name === 'lastName') {
      validateNameField(name, cleaned);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Mark fields as touched so errors show on submit
    setTouched(t => ({
      ...t,
      email: true,
      password: true,
      confirmPassword: true,
      firstName: true,
      lastName: true
    }));
    // Trim and collapse spaces before validation and submission
    const cleanedFirstName = (form.firstName || '').replace(/\s+/g, ' ').trim();
    const cleanedLastName = (form.lastName || '').replace(/\s+/g, ' ').trim();
    setForm(f => ({ ...f, firstName: cleanedFirstName, lastName: cleanedLastName }));
    // Shake only if required but empty
    setShake({
      email: !form.email || !emailRegex.test(form.email),
      password: !form.password,
      confirmPassword: !form.confirmPassword,
      firstName: !cleanedFirstName,
      lastName: !cleanedLastName
    });
    setTimeout(() => setShake({ email: false, password: false, confirmPassword: false, firstName: false, lastName: false }), 500);
    if (!validate()) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          firstName: cleanedFirstName,
          lastName: cleanedLastName,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowVerifyModal(true);
      } else {
        setToast({ show: true, message: data.error || data.message || "Registration failed", type: "error" });
      }
    } catch (error) {
      setToast({ show: true, message: "Network error. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const formFields = (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="firstName">First Name *</label>
          <div className="relative">
          <input
            type="text"
            name="firstName"
            id="firstName"
              maxLength={30}
              className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${errors.firstName ? " border-red-500 pr-10" : ""}${shake.firstName ? " animate-shake" : ""}`}
            placeholder="First name"
            value={form.firstName}
            onChange={handleChange}
              onBlur={e => { setTouched(t => ({ ...t, firstName: true })); validateNameField('firstName', e.target.value.replace(/\s+/g, ' ').trim()); }}
            autoComplete="given-name"
          />
          {errors.firstName && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
                <i className="fa-solid fa-circle-exclamation"></i>
              </span>
          )}
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="lastName">Last Name *</label>
          <div className="relative">
          <input
            type="text"
            name="lastName"
            id="lastName"
              maxLength={30}
              className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${errors.lastName ? " border-red-500 pr-10" : ""}${shake.lastName ? " animate-shake" : ""}`}
            placeholder="Last name"
            value={form.lastName}
            onChange={handleChange}
              onBlur={e => { setTouched(t => ({ ...t, lastName: true })); validateNameField('lastName', e.target.value.replace(/\s+/g, ' ').trim()); }}
            autoComplete="family-name"
          />
          {errors.lastName && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
                <i className="fa-solid fa-circle-exclamation"></i>
              </span>
          )}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="email">Email *</label>
        <div className="relative">
        <input
          type="email"
          name="email"
          id="email"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${emailInvalid ? " border-red-500 pr-10" : ""}${shake.email ? " animate-shake" : ""}`}
          placeholder="Email address"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            aria-invalid={emailInvalid}
        />
          {emailInvalid && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
              <i className="fa-solid fa-circle-exclamation"></i>
            </span>
        )}
        </div>
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="password">Password *</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            id="password"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${(form.password && allValid) ? " border-green-500" : (touched.password && !allValid) ? " border-red-500" : ""}${shake.password ? " animate-shake" : ""}`}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            onFocus={() => handleFocus('password')}
            onBlur={() => { setTouched(t => ({ ...t, password: true })); handleBlur('password'); }}
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
      </div>
      <div>
        <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="confirmPassword">Confirm Password *</label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            id="confirmPassword"
            className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${(form.confirmPassword && form.confirmPassword === form.password && allValid) ? " border-green-500" : (touched.confirmPassword && form.confirmPassword && form.confirmPassword !== form.password) ? " border-red-500" : (!form.confirmPassword && touched.confirmPassword) ? " border-red-500" : ""}${shake.confirmPassword ? " animate-shake" : ""}`}
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            onFocus={() => handleFocus('confirmPassword')}
            onBlur={() => { setTouched(t => ({ ...t, confirmPassword: true })); handleBlur('confirmPassword'); }}
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
      </div>
      {/* Dropdown for password requirements below both fields */}
      <div className={`relative w-full transition-all duration-300 ${dropdownOpen ? 'max-h-60 opacity-100 py-3 px-4' : 'max-h-0 opacity-0 py-0 px-4'} overflow-hidden z-20`}
        style={{ background: dropdownOpen ? 'rgba(24,24,72,0.95)' : 'transparent', borderRadius: dropdownOpen ? '0.75rem' : '0', boxShadow: dropdownOpen ? '0 8px 32px 0 rgba(31, 38, 135, 0.37)' : 'none', border: dropdownOpen ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
      >
        <div className="text-xs text-white/80 font-semibold mb-2">Password must contain:</div>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">{hasMinLength ? checkIcon : crossIcon} Min 8 characters</li>
          <li className="flex items-center gap-2">{hasUpper ? checkIcon : crossIcon} 1 uppercase letter</li>
          <li className="flex items-center gap-2">{hasLower ? checkIcon : crossIcon} 1 lowercase letter</li>
          <li className="flex items-center gap-2">{hasNumber ? checkIcon : crossIcon} 1 number</li>
          <li className="flex items-center gap-2">{hasSpecial ? checkIcon : crossIcon} 1 special character</li>
        </ul>
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
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={2500}
          onClose={() => setToast(t => ({ ...t, show: false }))}
        />
      )}
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
                    <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="firstName">First Name *</label>
                    <div className="relative">
                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                        maxLength={30}
                        className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${errors.firstName ? " border-red-500 pr-10" : ""}${shake.firstName ? " animate-shake" : ""}`}
                      placeholder="First name"
                      value={form.firstName}
                      onChange={handleChange}
                        onBlur={e => { setTouched(t => ({ ...t, firstName: true })); validateNameField('firstName', e.target.value.replace(/\s+/g, ' ').trim()); }}
                      autoComplete="given-name"
                    />
                    {errors.firstName && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
                          <i className="fa-solid fa-circle-exclamation"></i>
                        </span>
                    )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="lastName">Last Name *</label>
                    <div className="relative">
                    <input
                      type="text"
                      name="lastName"
                      id="lastName"
                        maxLength={30}
                        className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${errors.lastName ? " border-red-500 pr-10" : ""}${shake.lastName ? " animate-shake" : ""}`}
                      placeholder="Last name"
                      value={form.lastName}
                      onChange={handleChange}
                        onBlur={e => { setTouched(t => ({ ...t, lastName: true })); validateNameField('lastName', e.target.value.replace(/\s+/g, ' ').trim()); }}
                      autoComplete="family-name"
                    />
                    {errors.lastName && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
                          <i className="fa-solid fa-circle-exclamation"></i>
                        </span>
                    )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="email">Email *</label>
                  <div className="relative">
                  <input
                    type="email"
                    name="email"
                    id="email"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${emailInvalid ? " border-red-500 pr-10" : ""}${shake.email ? " animate-shake" : ""}`}
                    placeholder="Email address"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                      onBlur={() => setTouched(t => ({ ...t, email: true }))}
                      aria-invalid={emailInvalid}
                  />
                    {emailInvalid && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 opacity-70 pointer-events-none">
                        <i className="fa-solid fa-circle-exclamation"></i>
                      </span>
                  )}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="password">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      id="password"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${(form.password && allValid) ? " border-green-500" : (touched.password && !allValid) ? " border-red-500" : ""}${shake.password ? " animate-shake" : ""}`}
                      placeholder="Password"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      onFocus={() => handleFocus('password')}
                      onBlur={() => { setTouched(t => ({ ...t, password: true })); handleBlur('password'); }}
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
                </div>
                <div>
                  <label className="block text-gray-200 text-xs mb-1 text-left" htmlFor="confirmPassword">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      id="confirmPassword"
                      className={`w-full px-3 py-2 rounded-lg bg-transparent border-2 focus:border-purple-400 border-gray-400 text-white placeholder-gray-400 focus:outline-none transition text-sm${(form.confirmPassword && form.confirmPassword === form.password && allValid) ? " border-green-500" : (touched.confirmPassword && form.confirmPassword && form.confirmPassword !== form.password) ? " border-red-500" : (!form.confirmPassword && touched.confirmPassword) ? " border-red-500" : ""}${shake.confirmPassword ? " animate-shake" : ""}`}
                      placeholder="Confirm password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      onFocus={() => handleFocus('confirmPassword')}
                      onBlur={() => { setTouched(t => ({ ...t, confirmPassword: true })); handleBlur('confirmPassword'); }}
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
                </div>
                {/* Dropdown for password requirements below both fields */}
                <div className={`relative w-full transition-all duration-300 ${dropdownOpen ? 'max-h-60 opacity-100 py-3 px-4' : 'max-h-0 opacity-0 py-0 px-4'} overflow-hidden z-20`}
                  style={{ background: dropdownOpen ? 'rgba(24,24,72,0.95)' : 'transparent', borderRadius: dropdownOpen ? '0.75rem' : '0', boxShadow: dropdownOpen ? '0 8px 32px 0 rgba(31, 38, 135, 0.37)' : 'none', border: dropdownOpen ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
                >
                  <div className="text-xs text-white/80 font-semibold mb-2">Password must contain:</div>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">{hasMinLength ? checkIcon : crossIcon} Min 8 characters</li>
                    <li className="flex items-center gap-2">{hasUpper ? checkIcon : crossIcon} 1 uppercase letter</li>
                    <li className="flex items-center gap-2">{hasLower ? checkIcon : crossIcon} 1 lowercase letter</li>
                    <li className="flex items-center gap-2">{hasNumber ? checkIcon : crossIcon} 1 number</li>
                    <li className="flex items-center gap-2">{hasSpecial ? checkIcon : crossIcon} 1 special character</li>
                  </ul>
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

import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";

function Register() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    bio: "",
    dob: "",
    profile: null,
  });
  const [errors, setErrors] = useState({});
  const [profilePreview, setProfilePreview] = useState(null);
  const fileInputRef = useRef();

  const validate = () => {
    const newErrors = {};
    if (!form.firstName) newErrors.firstName = "First name is required";
    if (!form.lastName) newErrors.lastName = "Last name is required";
    if (!form.email) newErrors.email = "Email is required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      newErrors.email = "Invalid email";
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (!form.phone) newErrors.phone = "Phone number is required";
    else if (!/^\d{10,15}$/.test(form.phone.replace(/\D/g, "")))
      newErrors.phone = "Invalid phone number";
    if (!form.address) newErrors.address = "Address is required";
    if (!form.bio) newErrors.bio = "Bio is required";
    if (!form.dob) newErrors.dob = "Date of birth is required";
    if (!form.profile) newErrors.profile = "Profile image is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "profile") {
      const file = files[0];
      setForm({ ...form, profile: file });
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => setProfilePreview(reader.result);
        reader.readAsDataURL(file);
      } else {
        setProfilePreview(null);
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // handle registration logic
      alert("Registered!");
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
          <div className="login-title">Register</div>
          <div className="login-subtitle">Create your account</div>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="login-label">First Name</label>
            <div className="login-input-group">
              <input
                type="text"
                className="login-input"
                name="firstName"
                placeholder="Enter your first name"
                value={form.firstName}
                onChange={handleChange}
              />
            </div>
            {errors.firstName && (
              <div className="login-error">{errors.firstName}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="login-label">Last Name</label>
            <div className="login-input-group">
              <input
                type="text"
                className="login-input"
                name="lastName"
                placeholder="Enter your last name"
                value={form.lastName}
                onChange={handleChange}
              />
            </div>
            {errors.lastName && (
              <div className="login-error">{errors.lastName}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="login-label">Email Address</label>
            <div className="login-input-group">
              <input
                type="email"
                className="login-input"
                name="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            {errors.email && <div className="login-error">{errors.email}</div>}
          </div>
          <div className="mb-3">
            <label className="login-label">Password</label>
            <div className="login-input-group">
              <input
                type="password"
                className="login-input"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
              />
            </div>
            {errors.password && (
              <div className="login-error">{errors.password}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="login-label">Phone Number</label>
            <div className="login-input-group">
              <input
                type="tel"
                className="login-input"
                name="phone"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            {errors.phone && <div className="login-error">{errors.phone}</div>}
          </div>
          <div className="mb-3">
            <label className="login-label">Address</label>
            <div className="login-input-group">
              <input
                type="text"
                className="login-input"
                name="address"
                placeholder="Enter your address"
                value={form.address}
                onChange={handleChange}
              />
            </div>
            {errors.address && (
              <div className="login-error">{errors.address}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="login-label">Profile Image</label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#23242b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  border: "2px solid #3B82F6",
                }}
              >
                {profilePreview ? (
                  <img
                    src={profilePreview}
                    alt="Profile Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="8"
                      r="4"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                    <path
                      d="M4 20c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                  </svg>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                name="profile"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleChange}
              />
              <button
                type="button"
                className="login-btn"
                style={{ width: 120, padding: "0.4rem 0" }}
                onClick={() => fileInputRef.current.click()}
              >
                Upload
              </button>
            </div>
            {errors.profile && (
              <div className="login-error">{errors.profile}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="login-label">Bio</label>
            <div className="login-input-group">
              <textarea
                className="login-input"
                name="bio"
                placeholder="Tell us about yourself"
                value={form.bio}
                onChange={handleChange}
                rows={2}
                style={{ resize: "none" }}
              />
            </div>
            {errors.bio && <div className="login-error">{errors.bio}</div>}
          </div>
          <div className="mb-3">
            <label className="login-label">Date of Birth</label>
            <div className="login-input-group">
              <input
                type="date"
                className="login-input"
                name="dob"
                value={form.dob}
                onChange={handleChange}
              />
            </div>
            {errors.dob && <div className="login-error">{errors.dob}</div>}
          </div>
          <button type="submit" className="login-btn">
            Register
          </button>
        </form>
        <div className="login-footer">
          Already have an account?{" "}
          <Link to="/login" className="login-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Register;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../src/components/Button";

function SellerRequestForm({ showToast }) {
  const [form, setForm] = useState({
    businessName: "",
    businessDescription: "",
    businessAddress: "",
    businessPhone: ""
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/seller/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: "include"
      });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    const newErrors = {};
    if (!form.businessName.trim()) newErrors.businessName = "Business name is required.";
    if (!form.businessDescription.trim()) newErrors.businessDescription = "Business description is required.";
    if (!form.businessAddress.trim()) newErrors.businessAddress = "Business address is required.";
    if (!form.businessPhone.trim()) {
      newErrors.businessPhone = "Business phone is required.";
    } else if (!/^[+\d][\d\s\-()+]{7,20}$/.test(form.businessPhone.trim())) {
      newErrors.businessPhone = "Enter a valid phone number.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(errs => ({ ...errs, [e.target.name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      showToast && showToast("Please fix the errors in the form.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/seller/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      showToast && showToast("Seller request submitted! Waiting for admin approval.", "success");
      fetchStatus();
    } catch (err) {
      showToast && showToast(err.message || "Failed to submit request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // Add a refresh icon button to the status panels
  const RefreshButton = ({ onClick, loading }) => (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 text-purple-200 hover:text-purple-400 transition-colors"
      title="Refresh status"
      disabled={loading}
      style={{ fontSize: 20 }}
    >
      <i className={`fa-solid fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
    </button>
  );

  // Only show full-page loading splash on initial load
  if (loading && status === null) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] backdrop-blur-md"><div className="text-center text-white py-12">Loading...</div></div>;
  }
  // Show status if already requested
  if (status && status.status === "approved") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-r from-[#000] to-[#2a2a72] backdrop-blur-md">
        <div className="relative w-[90%] md:max-w-md md:w-full mx-auto bg-black/30 backdrop-blur-md rounded-2xl p-10 shadow-2xl border-2 border-purple-400 text-white text-center">
          <RefreshButton onClick={fetchStatus} loading={loading} />
          <h2 className="text-2xl font-bold mb-2 text-white">Seller Approved!</h2>
          <p className="mb-4 text-white/90">Your seller application has been approved.</p>
          <p className="mb-2 text-purple-200 font-semibold">Please logout and log in to access Seller Dashboard.</p>
        </div>
      </div>
    );
  }
  // 1. Show rejection reason if present
  if (status && status.status === "rejected") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-r from-[#000] to-[#2a2a72] backdrop-blur-md">
        <div className="relative w-[90%] md:max-w-md md:w-full mx-auto bg-black/30 backdrop-blur-md rounded-2xl p-10 shadow-2xl border-2 border-purple-400 text-white text-center">
          <RefreshButton onClick={fetchStatus} loading={loading} />
          <h2 className="text-2xl font-bold mb-2 text-red-400">Application Rejected</h2>
          <p className="mb-4 text-white/90">Your seller application was rejected.</p>
          {status.seller_rejection_reason && (
            <div className="mb-4 text-red-300 text-sm font-semibold">Reason: {status.seller_rejection_reason}</div>
          )}
          <Button variant="secondary" size="default" onClick={() => setStatus(null)} className="mt-2">Request Again</Button>
        </div>
      </div>
    );
  }
  // 2. Add refresh button to pending status
  if (status && status.status === "pending") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-r from-[#000] to-[#2a2a72] backdrop-blur-md">
        <div className="relative w-[90%] md:max-w-md md:w-full mx-auto bg-black/10 backdrop-blur-md rounded-2xl p-10 shadow-2xl border-2 border-purple-400 text-white text-center">
          <RefreshButton onClick={fetchStatus} loading={loading} />
          <h2 className="text-2xl font-bold mb-2 text-white">Application Pending</h2>
          <p className="mb-4 text-white/90">Your seller application is under review. Please wait for admin approval.</p>
        </div>
      </div>
    );
  }

  // Show form if not requested
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-r from-[#000] via-[#2a2a72] to-[#63e] backdrop-blur-md py-2">
      <div className="w-[90%] py-10 mb-15 md:max-w-md md:w-full mx-auto bg-black/10 backdrop-blur-md rounded-2xl p-10 shadow-2xl border-2 border-purple-400">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">Request to Become a Seller</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1 text-white/80 text-left">Business Name *</label>
            <input type="text" name="businessName" value={form.businessName} onChange={handleChange} required className={`w-full px-3 py-2 rounded bg-transparent border text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 text-sm ${errors.businessName ? 'border-red-400' : 'border-white/20'}`} placeholder="Enter your business name" />
            {errors.businessName && <div className="text-xs text-red-400 mt-1">{errors.businessName}</div>}
          </div>
          <div>
            <label className="block text-xs mb-1 text-white/80 text-left">Business Description *</label>
            <textarea name="businessDescription" value={form.businessDescription} onChange={handleChange} required className={`w-full px-3 py-2 rounded bg-transparent border text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 text-sm min-h-[60px] ${errors.businessDescription ? 'border-red-400' : 'border-white/20'}`} placeholder="Describe your business" />
            {errors.businessDescription && <div className="text-xs text-red-400 mt-1">{errors.businessDescription}</div>}
          </div>
          <div>
            <label className="block text-xs mb-1 text-white/80 text-left">Business Address *</label>
            <input type="text" name="businessAddress" value={form.businessAddress} onChange={handleChange} required className={`w-full px-3 py-2 rounded bg-transparent border text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 text-sm ${errors.businessAddress ? 'border-red-400' : 'border-white/20'}`} placeholder="Enter your business address" />
            {errors.businessAddress && <div className="text-xs text-red-400 mt-1">{errors.businessAddress}</div>}
          </div>
          <div>
            <label className="block text-xs mb-1 text-white/80 text-left">Business Phone *</label>
            <input type="text" name="businessPhone" value={form.businessPhone} onChange={handleChange} required className={`w-full px-3 py-2 rounded bg-transparent border text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 text-sm ${errors.businessPhone ? 'border-red-400' : 'border-white/20'}`} placeholder="Enter your business phone" />
            {errors.businessPhone && <div className="text-xs text-red-400 mt-1">{errors.businessPhone}</div>}
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2 mt-2 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg font-semibold text-base text-white shadow-md transition-all duration-200">
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SellerRequestForm; 
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import SellerRequestForm from "../src/components/SellerRequestForm";
import SellerStatus from "../src/components/SellerStatus";
import { UserContext } from "../src/context/UserContext";

function UserDashboard() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  function handleLogout() {
    setUser(null);
    navigate("/login");
  }

  async function handleSellerRequest(formData) {
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/seller/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        // Update user data in context
        const updatedUser = { ...user, ...data.user };
        setUser(updatedUser);
        localStorage.setItem("justbetToken", data.token);
        setMessage({ type: 'success', text: 'Seller request submitted successfully! Please wait for admin approval.' });
        setShowSellerForm(false);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit seller request' });
      }
    } catch (error) {
      console.error('Error submitting seller request:', error);
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCheckStatus() {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch(`${apiUrl}/api/seller/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        // Update user data in context with proper field mapping
        const updatedUser = { 
          ...user, 
          isApproved: data.isApproved,
          businessDetails: data.businessDetails
        };
        setUser(updatedUser);
        localStorage.setItem("justbetToken", data.token);
        return data;
      } else {
        throw new Error(data.error || 'Failed to check status');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setMessage({ type: 'error', text: 'Failed to check status. Please try again.' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  function renderMainContent() {
    // If showing seller form, render the form
    if (showSellerForm) {
      return (
        <SellerRequestForm
          onSubmit={handleSellerRequest}
          onCancel={() => setShowSellerForm(false)}
          isLoading={isLoading}
        />
      );
    }

    // If user is a seller, show status
    if (user && user.role === 'seller') {
      return (
        <SellerStatus
          user={user}
          onCheckStatus={handleCheckStatus}
          isLoading={isLoading}
        />
      );
    }

    // If user is a buyer, show the option to become a seller
    if (user && user.role === 'buyer') {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh] max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Welcome, {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "User"}!</h1>
            <p className="text-xl text-gray-300 mb-2">Your role: <span className="font-semibold text-blue-300">{user.role}</span></p>
            <p className="text-gray-400">Ready to start selling? Apply to become a seller and expand your business!</p>
          </div>

          {/* Seller Request Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-store text-white text-2xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Become a Seller</h2>
              <p className="text-gray-300 text-sm">
                Start selling your products and services on our platform. Get access to thousands of potential customers.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <i className="fas fa-check-circle text-green-400"></i>
                <span>Reach thousands of customers</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <i className="fas fa-check-circle text-green-400"></i>
                <span>Easy-to-use seller dashboard</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <i className="fas fa-check-circle text-green-400"></i>
                <span>Secure payment processing</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <i className="fas fa-check-circle text-green-400"></i>
                <span>24/7 customer support</span>
              </div>
            </div>

            <button
              onClick={() => setShowSellerForm(true)}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2"
            >
              <i className="fas fa-rocket"></i>
              Apply Now
            </button>
          </div>
        </div>
      );
    }

    // Default dashboard content
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <h1 className="text-3xl font-bold mb-4">User Dashboard</h1>
        <p>Welcome, {user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "User"}!</p>
        <p>Your role: {user && user.role}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/10 shadow-md">
        <div className="flex items-center gap-2 select-none">
          <i className="fa-solid fa-gavel text-2xl text-white"></i>
          <span className="text-xl font-bold text-white tracking-wide">JustBet</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-medium">
            {user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Guest"}
            {user && user.role ? ` (${user.role})` : ""}
          </span>
          <button
            onClick={handleLogout}
            className="px-4 py-1 bg-red-500 hover:bg-red-600 rounded text-white font-semibold transition"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Message Display */}
      {message.text && (
        <div className={`max-w-2xl mx-auto mt-4 px-6 ${
          message.type === 'success' ? 'text-green-400' : 'text-red-400'
        }`}>
          <div className={`p-4 rounded-lg border ${
            message.type === 'success' ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              <span>{message.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {renderMainContent()}
    </div>
  );
}

export default UserDashboard; 
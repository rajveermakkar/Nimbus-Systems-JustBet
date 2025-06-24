import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../src/context/UserContext";

function UserDashboard() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [message, setMessage] = useState({ type: '', text: '' });

  function handleLogout() {
    setUser(null);
    navigate("/login");
  }

  function renderMainContent() {
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
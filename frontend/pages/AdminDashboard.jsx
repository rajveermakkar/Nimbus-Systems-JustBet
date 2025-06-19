import React from "react";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem("justbetUser") || "{}");
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("justbetUser");
    // Optionally, call backend logout endpoint here
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      {/* Demo Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white/10 shadow-md">
        <div className="flex items-center gap-2 select-none">
          <i className="fa-solid fa-gavel text-2xl text-white"></i>
          <span className="text-xl font-bold text-white tracking-wide">JustBet</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-medium">{user.firstName} {user.lastName} ({user.role})</span>
          <button
            onClick={handleLogout}
            className="px-4 py-1 bg-red-500 hover:bg-red-600 rounded text-white font-semibold transition"
          >
            Logout
          </button>
        </div>
      </nav>
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
        <p>Welcome, {user.firstName || "Admin"}!</p>
        <p>Your role: {user.role}</p>
      </div>
    </div>
  );
}

export default AdminDashboard; 
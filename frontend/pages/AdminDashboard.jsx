import React, { useContext } from "react";
import { UserContext } from "../src/context/UserContext";
import Navbar from "../src/components/Navbar";

function AdminDashboard() {
  const { user } = useContext(UserContext);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      <Navbar />
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
        <p>Welcome, {user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Admin"}!</p>
        <p>Your role: {user && user.role}</p>
      </div>
    </div>
  );
}

export default AdminDashboard; 
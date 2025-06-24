import React, { useContext } from "react";
import { UserContext } from "../src/context/UserContext";
import { useNavigate } from "react-router-dom";
import Navbar from "../src/components/Navbar";

function NotAuthorized() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("justbetUser");
    navigate("/login");
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      <Navbar />
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-3xl font-bold text-white mb-4">Not authorized</h2>
        <p className="text-lg text-gray-200">
          Sorry, {user && user.firstName ? user.firstName : "User"}, you do not have permission to access this page.
        </p>
        <p className="text-gray-500">Please contact support if you believe this is a mistake.</p>
      </div>
    </div>
  );
}

export default NotAuthorized; 
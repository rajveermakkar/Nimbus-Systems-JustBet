import React, { useContext } from "react";
import { UserContext } from "../context/UserContext";
import { useNavigate } from "react-router-dom";

function Navbar() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("justbetUser");
    navigate("/login");
  };

  return (
    <nav className="w-full flex items-center justify-between px-8 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="flex items-center gap-2 select-none">
        <i className="fa-solid fa-gavel text-2xl text-white"></i>
        <span className="text-xl font-bold text-white tracking-wide">JustBet</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-medium">
          {user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Guest"}
          {user && user.role ? ` (${user.role})` : ""}
        </span>
        {user && (
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold transition"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar; 
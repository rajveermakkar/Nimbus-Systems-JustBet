import React, { useEffect, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "./Button";
import { UserContext } from "../context/UserContext";
import axios from 'axios';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleLogout() {
    try {
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (e) {}
    localStorage.removeItem("justbetToken");
    localStorage.removeItem("justbetUser");
    setUser(null);
    navigate('/login');
  }

  return (
    <nav
      className={`w-full sticky top-0 z-50 transition-colors duration-300
        ${scrolled
          ? "bg-[#181c2f]/80 backdrop-blur-md"
          : "bg-gradient-to-r from-[#000000] to-[#2A2A72]"}
        py-2`}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between px-2">
        <Link to="/" className="flex items-center gap-1 select-none">
          <i className="fa-solid fa-gavel text-base text-white"></i>
          <span className="text-base font-bold text-white tracking-wide">JustBet</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/auctions"
            className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
          >
            <i className="fa-solid fa-gavel"></i>
            Auctions
          </Link>
          {user && (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
              >
                <i className="fa-solid fa-tachometer-alt"></i>
                Dashboard
              </Link>
              <Link
                to="/wallet"
                className="flex items-center gap-1 text-white font-medium hover:text-green-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
              >
                <i className="fa-solid fa-wallet"></i>
                Wallet
              </Link>
              {user.role === "seller" && (
                <Link
                  to="/seller/dashboard"
                  className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
                >
                  <i className="fa-solid fa-store"></i>
                  Seller Dashboard
                </Link>
              )}
              <span className="text-xs text-white/80 font-medium px-2">
                Welcome, {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "User"}
                {user.role ? ` (${user.role})` : ""}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition"
              >
                <i className="fa-solid fa-sign-out-alt"></i>
                Logout
              </button>
            </>
          )}
          {!user && (
            <>
              <Link
                to="/login"
                className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
              >
                <i className="fa-solid fa-sign-in-alt"></i>
                Login
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm" className="text-sm py-2 px-6">
                  <i className="fa-solid fa-user-plus mr-2"></i>
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 
import React, { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "./Button";
import { UserContext } from "../context/UserContext";
import axios from 'axios';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  async function handleLogout() {
    try {
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (e) {}
    localStorage.removeItem("justbetToken");
    localStorage.removeItem("justbetUser");
    setUser(null);
    sessionStorage.setItem("showLogoutSuccess", "true");
    setTimeout(() => {
      navigate('/login');
    }, 500);
  }

  return (
    <nav
      className={`w-full sticky top-0 z-50 transition-colors duration-300 ${scrolled ? "bg-[#181c2f]/80 backdrop-blur-md" : "bg-gradient-to-r from-[#000000] to-[#2A2A72]"} py-2 transition-opacity duration-300`}
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
                to={user.role === "admin" ? "/admin/dashboard" : "/dashboard"}
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
              <div className="relative" ref={dropdownRef}>
                <button
                  className="flex items-center gap-2 text-white font-semibold text-xs px-2 py-1 rounded-lg hover:bg-[#2a2a72]/80 focus:outline-none transition-colors"
                  onClick={() => setDropdownOpen((open) => !open)}
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                >
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || user.firstName || 'A')}+${encodeURIComponent(user.last_name || user.lastName || 'D')}&background=2a2a72&color=fff`} alt="avatar" className="w-7 h-7 rounded-full border-2 border-white/30" />
                  <span>{user.first_name || user.firstName} {user.last_name || user.lastName}</span>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#23235b]/95 rounded-xl shadow-lg py-2 z-50 border border-white/10 flex flex-col min-w-[220px]">
                    {/* User Info */}
                    <div className="px-4 pt-4 pb-2">
                      <div className="font-bold text-white text-base">{user.first_name || user.firstName} {user.last_name || user.lastName}</div>
                      <div className="text-xs text-gray-300 mb-1">{user.email}</div>
                    </div>
                    {/* Menu Items */}
                    <button
                      className="flex items-center gap-2 w-full text-left px-4 py-3 text-white hover:bg-[#34346b]/80 text-sm transition"
                      onClick={() => { window.location.href = '/profile'; setDropdownOpen(false); }}
                    >
                      <i className="fa-regular fa-user text-base"></i> My Profile
                    </button>
                    <button
                      className="flex items-center gap-2 w-full text-left px-4 py-3 text-red-400 hover:bg-red-900/60 text-sm font-semibold transition"
                      onClick={() => { handleLogout(); setDropdownOpen(false); }}
                    >
                      <i className="fa-solid fa-sign-out-alt text-base"></i> Logout
                    </button>
                  </div>
                )}
              </div>
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
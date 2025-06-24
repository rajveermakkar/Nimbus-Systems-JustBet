import React, { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "./Button";
import { UserContext } from "../context/UserContext";

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  function handleLogout() {
    setUser(null);
    navigate("/login");
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
          {user ? (
            <>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((open) => !open)}
                  className="flex items-center gap-1 text-xs text-white/80 font-medium px-3 py-2 rounded-lg hover:bg-white/10 focus:outline-none"
                >
                  <i className="fa-solid fa-user"></i>
                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "User"}
                  {user.role ? ` (${user.role})` : ""}
                  <i className={`fa-solid fa-chevron-${dropdownOpen ? "up" : "down"} ml-1 text-xs`}></i>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#23235b] border border-white/10 rounded-lg shadow-lg z-50 py-2 animate-fade-in">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-white hover:bg-white/10 transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fa-solid fa-user-circle mr-2"></i>
                      User Dashboard
                    </Link>
                    {user.role === "seller" && (
                      <>
                        <Link
                          to="/seller/dashboard"
                          className="block px-4 py-2 text-sm text-white hover:bg-white/10 transition"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <i className="fa-solid fa-store mr-2"></i>
                          Seller Dashboard
                        </Link>
                        <div className="border-t border-white/10 my-2"></div>
                      </>
                    )}
                    {user.role !== "seller" && (
                      <>
                        <Link
                          to="/seller/request"
                          className="block px-4 py-2 text-sm text-white hover:bg-white/10 transition"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <i className="fa-solid fa-rocket mr-2"></i>
                          Request to become a seller
                        </Link>
                        {/* Placeholder for seller request form/status */}
                        <div className="border-t border-white/10 my-2"></div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition"
              >
                <i className="fa-solid fa-sign-out-alt"></i>
                Logout
              </button>
            </>
          ) : (
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
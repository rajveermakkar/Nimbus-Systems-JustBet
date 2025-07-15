import React, { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "./Button";
import { UserContext } from "../context/UserContext";
import axios from 'axios';

// Add custom dropdown animation
const dropdownStyle = `
@keyframes dropdown-fade {
  0% { opacity: 0; transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-dropdown-fade {
  animation: dropdown-fade 0.2s ease;
}
`;

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // At the top of the file, add this effect to ensure html/body have height: 100% for overlay to work
  useEffect(() => {
    // This part is good for ensuring the root elements can handle full height scrolling if needed.
    // However, the mobile menu itself needs to be positioned correctly relative to the document.
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    return () => {
      document.documentElement.style.height = '';
      document.body.style.height = '';
    };
  }, []);

  return (
    <>
      <style>{dropdownStyle}</style>
      <nav
        className={`w-full sticky top-0 z-50 transition-colors duration-300 ${scrolled ? "bg-[#181c2f]/80 backdrop-blur-md" : "bg-gradient-to-r from-[#000000] to-[#2A2A72]"} py-4 sm:py-2 transition-opacity duration-300`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-2 relative">
          {/* Logo (left) */}
          <Link to="/" className="flex items-center gap-1 select-none">
            <i className="fa-solid fa-gavel text-base text-white"></i>
            <span className="text-base font-bold text-white tracking-wide">JustBet</span>
          </Link>
          {/* Hamburger (right, only on mobile, absolutely positioned) */}
          {!mobileMenuOpen && (
            <button
              className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-white text-2xl p-2 focus:outline-none"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <i className="fas fa-bars"></i>
            </button>
          )}
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auctions"
              className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
            >
              <i className="fa-solid fa-gavel"></i>
              Auctions
            </Link>
            <Link
              to="/about"
              className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
            >
              <i className="fa-solid fa-users"></i>
              About
            </Link>
            <Link
              to="/contact"
              className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
            >
              <i className="fa-solid fa-envelope"></i>
              Contact
            </Link>
            {user && (
              <>
                {/* Dashboard logic based on role */}
                {user.role === "seller" ? (
                  <Link
                    to="/seller/dashboard"
                    className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
                  >
                    <i className="fa-solid fa-tachometer-alt"></i>
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    to={user.role === "admin" ? "/admin/dashboard" : "/dashboard"}
                    className="flex items-center gap-1 text-white font-medium hover:text-purple-300 transition text-xs px-3 py-2 rounded-lg hover:bg-white/10"
                  >
                    <i className="fa-solid fa-tachometer-alt"></i>
                    Dashboard
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
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[black]/30 backdrop-blur-md shadow-lg py-2 flex flex-col border border-white/10 z-50 min-w-[220px] transition-all duration-300 ease-in-out transform animate-dropdown-fade">
                      {/* User Info */}
                      <div className="px-4 pt-4 pb-2">
                        <div className="font-bold text-white text-base">{user.first_name || user.firstName} {user.last_name || user.lastName}</div>
                        <div className="text-xs text-gray-300 mb-1">{user.email}</div>
                      </div>
                      {/* Wallet link for all users */}
                      <Link
                        to="/wallet"
                        className="flex items-center gap-2 w-full text-left px-4 py-3 text-white hover:bg-[#34346b]/80 text-sm transition"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="fa-solid fa-wallet text-base"></i> Wallet
                      </Link>
                      {/* My Profile always second */}
                      <button
                        className="flex items-center gap-2 w-full text-left px-4 py-3 text-white hover:bg-[#34346b]/80 text-sm transition"
                        onClick={() => { window.location.href = '/profile'; setDropdownOpen(false); }}
                      >
                        <i className="fa-regular fa-user text-base"></i> My Profile
                      </button>
                      {/* Buyer Dashboard link for sellers only, after My Profile */}
                      {user.role === "seller" && (
                        <Link
                          to="/dashboard"
                          className="flex items-center gap-2 w-full text-left px-4 py-3 text-white hover:bg-[#34346b]/80 text-sm transition"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <i className="fa-solid fa-user text-base"></i> Buyer Dashboard
                        </Link>
                      )}
                      {/* Logout always last */}
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
      {/* Mobile menu overlay and menu - moved outside inner navbar container */}
      {/* Overlay */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-md transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />
      {/* Menu */}
      <div
        className={`md:hidden fixed inset-0 w-full h-full z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-start pt-12 px-6 transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        {/* Close button at top right */}
        <button
          className="absolute top-6 right-6 text-white text-3xl focus:outline-none transition-transform duration-300 transform hover:scale-110 hover:rotate-90"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <i className="fas fa-times"></i>
        </button>
        {/* Logo centered at top */}
        <div className="w-full flex flex-col items-center mb-4">
          <div className="flex items-center gap-3 justify-center">
            <i className="fa-solid fa-gavel text-3xl text-white"></i>
            <span className="text-2xl font-extrabold text-white tracking-wide">JustBet</span>
          </div>
          {/* User info centered below logo, with divider below */}
          {user && (
            <div className="flex flex-col items-center gap-2 mt-4 mb-2">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || user.firstName || 'A')}+${encodeURIComponent(user.last_name || user.lastName || 'D')}&background=2a2a72&color=fff`} alt="avatar" className="w-10 h-10 rounded-full border-2 border-white/30" />
              <span className="font-bold text-white text-lg leading-tight">{user.first_name || user.firstName} {user.last_name || user.lastName}</span>
              <span className="text-xs text-gray-300">{user.email}</span>
            </div>
          )}
          <hr className="w-full border-t border-white/20 mt-2" />
        </div>
        <div className="flex flex-col gap-6 w-full max-w-xs">
          <Link to="/auctions" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-gavel mr-2"></i>Auctions</Link>
          <Link to="/about" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-users mr-2"></i>About</Link>
          <Link to="/contact" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-envelope mr-2"></i>Contact</Link>
          {user && (
            <>
              {/* Dashboard logic based on role */}
              {user.role === "seller" ? (
                <Link to="/seller/dashboard" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-tachometer-alt mr-2"></i>Dashboard</Link>
              ) : (
                <Link to={user.role === "admin" ? "/admin/dashboard" : "/dashboard"} className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-tachometer-alt mr-2"></i>Dashboard</Link>
              )}
              {/* Wallet always */}
              <Link to="/wallet" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-wallet mr-2"></i>Wallet</Link>
              {/* My Profile always */}
              <button onClick={() => { window.location.href = '/profile'; setMobileMenuOpen(false); }} className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10"><i className="fa-regular fa-user mr-2"></i>My Profile</button>
              {/* Buyer Dashboard for sellers only */}
              {user.role === "seller" && (
                <Link to="/dashboard" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-user mr-2"></i>Buyer Dashboard</Link>
              )}
              {/* Logout */}
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-red-400 text-lg font-semibold py-2 w-full text-left border-b border-white/10"><i className="fa-solid fa-sign-out-alt mr-2"></i>Logout</button>
            </>
          )}
          {!user && (
            <>
              <Link to="/login" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-sign-in-alt mr-2"></i>Login</Link>
              <Link to="/register" className="text-white text-lg font-medium py-2 w-full text-left border-b border-white/10" onClick={() => setMobileMenuOpen(false)}><i className="fa-solid fa-user-plus mr-2"></i>Get Started</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Navbar;
import React, { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "../src/context/UserContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function AdminDashboard() {
  const { user, setUser } = useContext(UserContext);
  const [section, setSection] = useState("dashboard");
  const mainRef = useRef(null);
  const [mainHeight, setMainHeight] = useState(0);
  const navigate = useNavigate();

  // Redirect non-admin users
  if (!user || user.role !== 'admin') {
    window.location.replace('/not-authorized');
    return null;
  }

  // Sidebar links
  const navLinks = [
    { key: "dashboard", label: "Dashboard", icon: "fa-tachometer-alt" },
    { key: "manage-users", label: "Manage Users", icon: "fa-users-cog" },
    { key: "manage-auctions", label: "Manage Auctions", icon: "fa-gavel" },
    { key: "approve-users", label: "Approve Users", icon: "fa-user-check" },
    { key: "approve-auctions", label: "Approve Auctions", icon: "fa-check-circle" },
    { key: "all-auctions", label: "All Auctions", icon: "fa-list" },
    { key: "earnings", label: "Earnings", icon: "fa-dollar-sign" },
  ];

  // Placeholder data for dashboard
  const stats = [
    { label: "Total Users", value: "2,340", icon: "fa-users", color: "text-blue-400" },
    { label: "Auctions", value: "128", icon: "fa-gavel", color: "text-purple-400" },
    { label: "Revenue", value: "$12.4k", icon: "fa-dollar-sign", color: "text-green-400" },
    { label: "Active Sellers", value: "34", icon: "fa-store", color: "text-yellow-400" },
  ];
  const performers = [
    { name: "Alice Smith", role: "Top Seller", percent: "29%" },
    { name: "Bob Lee", role: "Most Bids", percent: "18%" },
    { name: "Jane Doe", role: "Most Listings", percent: "15%" },
  ];
  const quickLinks = [
    { label: "Manage Users", icon: "fa-user-cog", color: "bg-blue-900/60 text-blue-300" },
    { label: "View Reports", icon: "fa-chart-line", color: "bg-purple-900/60 text-purple-300" },
    { label: "Site Settings", icon: "fa-cogs", color: "bg-green-900/60 text-green-300" },
    { label: "All Auctions", icon: "fa-gavel", color: "bg-yellow-900/60 text-yellow-300" },
  ];

  // Logout handler
  const handleLogout = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (e) {}
    localStorage.removeItem("justbetToken");
    localStorage.removeItem("justbetUser");
    setUser(null);
    navigate("/login");
  };

  // Section content renderers
  const renderSection = () => {
    switch (section) {
      case "dashboard":
        return (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <span className="text-gray-400 text-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {stats.map((stat, idx) => (
                <div key={idx} className="bg-[#23235b]/80 backdrop-blur-md rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2">
                  <i className={`fa-solid ${stat.icon} text-2xl ${stat.color}`}></i>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-gray-300 font-semibold">{stat.label}</div>
                </div>
              ))}
            </div>
            {/* Activity/Chart & Top Performers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Activity/Chart Placeholder */}
              <div className="md:col-span-2 bg-[#23235b]/80 backdrop-blur-md rounded-2xl shadow border border-white/10 p-4 flex flex-col gap-2">
                <h2 className="text-lg font-bold text-white mb-2">Auction Activity</h2>
                <div className="h-32 flex items-center justify-center text-gray-400">[Chart Placeholder]</div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>
              {/* Top Performers */}
              <div className="bg-[#23235b]/80 backdrop-blur-md rounded-2xl shadow border border-white/10 p-4 flex flex-col gap-2">
                <h2 className="text-lg font-bold text-white mb-2">Top Sellers</h2>
                <ul className="flex flex-col gap-2">
                  {performers.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.role}</div>
                      </div>
                      <div className="font-bold text-blue-400">{p.percent}</div>
                    </li>
                  ))}
                </ul>
                <button className="mt-2 text-blue-400 text-xs font-semibold hover:underline self-end">View More &rarr;</button>
              </div>
            </div>
            {/* Quick Links/Channels */}
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((link, idx) => (
                <div key={idx} className={`rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition ${link.color} backdrop-blur-md`}>
                  <i className={`fa-solid ${link.icon} text-xl mb-2`}></i>
                  <div className="font-semibold text-sm">{link.label}</div>
                </div>
              ))}
            </div>
          </>
        );
      case "manage-users":
        return <div className="text-xl font-bold text-white">Manage Users Section</div>;
      case "manage-auctions":
        return <div className="text-xl font-bold text-white">Manage Auctions Section</div>;
      case "approve-users":
        return <div className="text-xl font-bold text-white">Approve Users Section</div>;
      case "approve-auctions":
        return <div className="text-xl font-bold text-white">Approve Auctions Section</div>;
      case "all-auctions":
        return <div className="text-xl font-bold text-white">All Auctions Section</div>;
      case "earnings":
        return <div className="text-xl font-bold text-white">Earnings Section</div>;
      default:
        return null;
    }
  };

  // Measure main content height and set sidebar height to match
  useEffect(() => {
    if (mainRef.current) {
      setMainHeight(mainRef.current.offsetHeight);
    }
  }, [section]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] flex items-center justify-center py-6 px-2">
      <div className="w-full max-w-7xl flex overflow-hidden rounded-2xl" style={{height: mainHeight ? mainHeight : 'auto'}}>
        {/* Sidebar */}
        <aside className="w-64 bg-[#181c2f]/80 backdrop-blur-md border-r border-white/10 flex flex-col py-8 px-6 text-white rounded-l-2xl" style={{height: mainHeight ? mainHeight : 'auto'}}>
          <div>
            <div className="flex flex-col items-center gap-2 mb-8 select-none">
              <img src={`https://ui-avatars.com/api/?name=${user?.firstName || 'A'}+${user?.lastName || 'D'}&background=2a2a72&color=fff`} alt="avatar" className="w-16 h-16 rounded-full border-2 border-white/30" />
              <div className="font-bold text-white text-lg">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-gray-400">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}</div>
            </div>
            <nav className="flex flex-col gap-2 mt-6 mb-2">
              {navLinks.map(link => (
                <button
                  key={link.key}
                  onClick={() => setSection(link.key)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-left transition font-semibold ${section === link.key ? 'bg-blue-900/60 text-blue-300' : 'hover:bg-blue-900/40 text-gray-200'}`}
                >
                  <i className={`fa-solid ${link.icon}`}></i> {link.label}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:bg-red-900/30 hover:text-red-300 transition"><i className="fa-solid fa-sign-out-alt"></i> Log out</button>
        </aside>
        {/* Main Content */}
        <main ref={mainRef} className="flex-1 bg-[#181c2f]/40 backdrop-blur-md rounded-r-2xl p-6 flex flex-col gap-4 text-white rounded-r-2xl">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard; 
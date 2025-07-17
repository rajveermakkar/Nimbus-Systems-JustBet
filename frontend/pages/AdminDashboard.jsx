import React, { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "../src/context/UserContext";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import axios from "axios";
import Toast from "../src/components/Toast";
import UserDetailsPanel from '../src/components/UserDetailsPanel';
import AuctionDetailsPanel from '../src/components/auctions/AuctionDetailsPanel';
import LoadingSpinner from '../src/components/LoadingSpinner';
import ConfirmModal from '../src/components/ConfirmModal';
import apiService from '../src/services/apiService';
import Button from '../src/components/Button';

function AdminRadialMenu({ navLinks, section, onNav, onLogout, open, onClose }) {
  // Radial positions for 7 items (6 nav + logout)
  const items = navLinks.filter(link => link.key !== "approve-auctions").concat({ key: 'logout', label: 'Log out', icon: 'fa-sign-out-alt', logout: true });
  const radius = 300; // px, increased for more spacing
  const arc = Math.PI * (85/180); // 85 degrees
  const startAngle = -Math.PI / 2; // -90 degrees (pointing up)
  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden" onClick={onClose}></div>}
      {/* Radial menu */}
      <div className={`fixed z-[60] md:hidden transition-all duration-300 pointer-events-none`} style={{ right: 80, bottom: 44 }}>
        <div className="relative w-0 h-0">
          {items.map((item, i) => {
            const angle = startAngle - (i * (arc / (items.length - 1)));
            const x = open ? Math.cos(angle) * radius : 0;
            const y = open ? Math.sin(angle) * radius : 0;
            return (
              <button
                key={item.key}
                className={`absolute flex flex-col items-center justify-center shadow-lg w-16 h-16 transition-all duration-300 ${open ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-75'}`}
                style={{
                  transform: `translate(${x}px, ${y}px)`
                }}
                onClick={() => {
                  if (item.logout) onLogout();
                  else onNav(item.key);
                  onClose();
                }}
                tabIndex={open ? 0 : -1}
              >
                <i className={`fa-solid ${item.icon} text-2xl mb-1 ${section === item.key ? 'text-purple-400' : 'text-white'}`}></i>
                <span className={`block text-xs font-semibold mt-0.5 text-center leading-tight ${section === item.key ? 'text-purple-400' : 'text-white'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function AdminMobileNavbar({ navLinks, section, onNav, onLogout }) {
  const [radialOpen, setRadialOpen] = useState(false);
  return (
    <>
      {/* Floating radial menu trigger at bottom right */}
      <button
        className={`fixed z-[70] md:hidden bottom-6 right-6 text-white text-3xl p-4 rounded-full shadow-lg focus:outline-none transition  hover:bg-purple-500 bg-[#252567]`}
        onClick={() => setRadialOpen(v => !v)}
        aria-label={radialOpen ? 'Close admin menu' : 'Open admin menu'}
        style={{ boxShadow: '0 4px 24px #0005' }}
      >
        <span className="relative block w-7 h-7">
          {/* Gear icon */}
          <span className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${radialOpen ? 'opacity-0 rotate-45 scale-90' : 'opacity-100 rotate-0 scale-100'}`}
            style={{transitionProperty:'opacity, transform'}}>
            <i className="fas fa-cog text-white z-[70]"></i>
          </span>
          {/* X icon */}
          <span className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${radialOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{transitionProperty:'opacity, transform'}}>
            <i className="fas fa-times text-white z-[70]"></i>
          </span>
        </span>
      </button>
      <AdminRadialMenu navLinks={navLinks} section={section} onNav={onNav} onLogout={onLogout} open={radialOpen} onClose={() => setRadialOpen(false)} />
    </>
  );
}

function AdminDashboard() {
  const { user, setUser } = useContext(UserContext);
  const mainRef = useRef(null);
  const [mainHeight, setMainHeight] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { userId, auctionId, type } = useParams();

  // Derive section from URL at the top
  const getSectionFromPath = (pathname) => {
    console.log('getSectionFromPath called with:', pathname);
    if (pathname.startsWith('/admin/manage-users')) return 'manage-users';
    if (pathname.startsWith('/admin/manage-auctions')) return 'manage-auctions';
    if (pathname.startsWith('/admin/approve-users')) return 'approve-users';
    if (pathname.startsWith('/admin/earnings')) return 'earnings';
    if (pathname.startsWith('/admin/db-health')) return 'db-health';
    if (pathname.startsWith('/admin/activity-logs')) return 'activity-logs';
    return 'dashboard';
  };
  const section = getSectionFromPath(location.pathname);
  console.log('Current section:', section, 'Pathname:', location.pathname);

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
    { key: "approve-users", label: "Approve Sellers", icon: "fa-user-check" },
    { key: "earnings", label: "Earnings", icon: "fa-dollar-sign" },
    { key: "db-health", label: "DB Health", icon: "fa-database" },
    { key: "activity-logs", label: "Activity Logs", icon: "fa-list-alt" },
  ];

  // --- STATE FOR ADMIN DATA ---
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const [pendingSellers, setPendingSellers] = useState([]);
  const [pendingSellersLoading, setPendingSellersLoading] = useState(false);
  const [pendingSellersError, setPendingSellersError] = useState(null);

  const [pendingSettledAuctions, setPendingSettledAuctions] = useState([]);
  const [pendingSettledLoading, setPendingSettledLoading] = useState(false);
  const [pendingSettledError, setPendingSettledError] = useState(null);

  const [pendingLiveAuctions, setPendingLiveAuctions] = useState([]);
  const [pendingLiveLoading, setPendingLiveLoading] = useState(false);
  const [pendingLiveError, setPendingLiveError] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null); // {type, id}

  // Add state for auction filter
  const [auctionFilter, setAuctionFilter] = useState('all');
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalType, setViewModalType] = useState(null); // 'auction' or 'user'
  const [viewModalData, setViewModalData] = useState(null);

  // --- STATE FOR ALL USERS ---
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [allUsersError, setAllUsersError] = useState(null);

  // --- STATE FOR ALL AUCTIONS ---
  const [allSettledAuctions, setAllSettledAuctions] = useState([]);
  const [allSettledLoading, setAllSettledLoading] = useState(false);
  const [allSettledError, setAllSettledError] = useState(null);
  const [allLiveAuctions, setAllLiveAuctions] = useState([]);
  const [allLiveLoading, setAllLiveLoading] = useState(false);
  const [allLiveError, setAllLiveError] = useState(null);

  // --- STATE FOR DATABASE HEALTH ---
  const [dbHealthData, setDbHealthData] = useState(null);
  const [dbHealthLoading, setDbHealthLoading] = useState(false);
  const [dbHealthError, setDbHealthError] = useState(null);

  // --- STATE FOR EARNINGS ---
  const [earningsData, setEarningsData] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState(null);

  // Add admin Stripe onboarding state
  const [adminStripeStatus, setAdminStripeStatus] = useState(null);
  const [adminStripeStatusLoading, setAdminStripeStatusLoading] = useState(false);
  const [adminStripeStatusError, setAdminStripeStatusError] = useState('');
  const [adminOnboardingUrl, setAdminOnboardingUrl] = useState('');
  const [adminOnboardingLoading, setAdminOnboardingLoading] = useState(false);
  const [adminPayoutAmount, setAdminPayoutAmount] = useState('');
  const [adminPayoutLoading, setAdminPayoutLoading] = useState(false);
  const [adminPayoutError, setAdminPayoutError] = useState('');
  const [adminPayoutSuccess, setAdminPayoutSuccess] = useState('');

  // --- MODAL FOR APPROVING AUCTION ---
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null); // {type, id}

  // --- MODAL FOR APPROVING/REJECTING SELLERS ---
  const [showSellerApproveModal, setShowSellerApproveModal] = useState(false);
  const [showSellerRejectModal, setShowSellerRejectModal] = useState(false);
  const [sellerTarget, setSellerTarget] = useState(null); // {id, name}
  const [sellerRejectionReason, setSellerRejectionReason] = useState("");

  // --- TOAST NOTIFICATIONS ---
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };

  const handleToastClose = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

  // --- LOGOUT TRANSITION ---
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- API HELPERS ---
  const api = axios.create({
    baseURL: (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000') + "/api",
    withCredentials: true
  });

  // Add request interceptor to include JWT token
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('justbetToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Fetch dashboard stats
  const fetchStats = async () => {
    setStatsLoading(true); setStatsError(null);
    try {
      const res = await api.get("/admin/stats");
      setStatsData(res.data);
    } catch (e) {
      setStatsError("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch pending sellers
  const fetchPendingSellers = async () => {
    setPendingSellersLoading(true); setPendingSellersError(null);
    try {
      const res = await api.get("/admin/pending-sellers");
      setPendingSellers(res.data.pendingSellers || []);
    } catch (e) {
      setPendingSellersError("Failed to load pending sellers");
    } finally {
      setPendingSellersLoading(false);
    }
  };

  // Approve/reject seller
  const handleSellerApproval = async (userId, approved, rejectionReason = null) => {
    setActionLoading(true); setActionError(null);
    try {
      await api.patch(`/admin/sellers/${userId}/approve`, { approved, rejectionReason });
      
      // Immediately update local state instead of refetching
      setPendingSellers(prev => prev.filter(seller => seller.id !== userId));
      
      // Also update all users if we're in manage-users section
      if (section === 'manage-users') {
        setAllUsers(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, is_approved: approved }
            : user
        ));
      }
      
      // Update stats immediately if we're on dashboard
      if (section === 'dashboard' && statsData) {
        setStatsData(prev => ({
          ...prev,
          users: {
            ...prev.users,
            pendingSellerRequests: Math.max(0, (prev.users.pendingSellerRequests || 0) - 1)
          }
        }));
      }
      
      // Show success message
      showToast(`Seller ${approved ? 'approved' : 'rejected'} successfully!`, 'success');
    } catch (e) {
      setActionError("Failed to update seller approval");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch pending settled auctions
  const fetchPendingSettledAuctions = async () => {
    setPendingSettledLoading(true); setPendingSettledError(null);
    try {
      const res = await api.get("/admin/auctions/settled/pending");
      setPendingSettledAuctions(res.data.auctions || []);
    } catch (e) {
      setPendingSettledError("Failed to load pending settled auctions");
    } finally {
      setPendingSettledLoading(false);
    }
  };

  // Approve/reject settled auction
  const handleSettledAuctionApproval = async (id, approved, reason) => {
    setActionLoading(true); setActionError(null);
    try {
      let response;
      if (approved) {
        response = await api.patch(`/admin/auctions/settled/${id}/approve`);
      } else {
        response = await api.patch(`/admin/auctions/settled/${id}/reject`, { rejectionReason: reason });
      }
      console.log('[Admin] Settled auction approval/rejection response:', response.data);
      // Immediately update local state instead of refetching
      setPendingSettledAuctions(prev => prev.filter(auction => auction.id !== id));
      // Also update all auctions if we're in manage-auctions section
      if (section === 'manage-auctions') {
        await fetchAllSettledAuctions();
        await fetchAllLiveAuctions();
      }
      showToast(`Settled auction ${approved ? 'approved' : 'rejected'} successfully!`, 'success');
    } catch (e) {
      setActionError("Failed to update settled auction");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch pending live auctions
  const fetchPendingLiveAuctions = async () => {
    setPendingLiveLoading(true); setPendingLiveError(null);
    try {
      const res = await api.get("/admin/auctions/live?status=pending");
      setPendingLiveAuctions(res.data.auctions || []);
    } catch (e) {
      setPendingLiveError("Failed to load pending live auctions");
    } finally {
      setPendingLiveLoading(false);
    }
  };

  // Approve/reject live auction
  const handleLiveAuctionApproval = async (id, approved, reason) => {
    setActionLoading(true); setActionError(null);
    try {
      let response;
      if (approved) {
        response = await api.patch(`/admin/auctions/live/${id}/approve`);
      } else {
        response = await api.patch(`/admin/auctions/live/${id}/reject`, { rejectionReason: reason });
      }
      console.log('[Admin] Live auction approval/rejection response:', response.data);
      // Immediately update local state instead of refetching
      setPendingLiveAuctions(prev => prev.filter(auction => auction.id !== id));
      // Also update all auctions if we're in manage-auctions section
      if (section === 'manage-auctions') {
        await fetchAllLiveAuctions();
        await fetchAllSettledAuctions();
      }
      showToast(`Live auction ${approved ? 'approved' : 'rejected'} successfully!`, 'success');
    } catch (e) {
      setActionError("Failed to update live auction");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch all users
  const fetchAllUsers = async () => {
    setAllUsersLoading(true); setAllUsersError(null);
    try {
      const res = await api.get('/admin/users');
      setAllUsers(res.data.users || []);
    } catch (e) {
      setAllUsersError('Failed to load users');
    } finally {
      setAllUsersLoading(false);
    }
  };

  // Fetch all settled auctions
  const fetchAllSettledAuctions = async () => {
    setAllSettledLoading(true); setAllSettledError(null);
    try {
      const res = await api.get("/admin/auctions/settled/all");
      setAllSettledAuctions(res.data.auctions || []);
      console.log('[Admin] fetchAllSettledAuctions response:', res.data.auctions);
    } catch (e) {
      setAllSettledError("Failed to load all settled auctions");
    } finally {
      setAllSettledLoading(false);
    }
  };

  // Fetch all live auctions
  const fetchAllLiveAuctions = async () => {
    setAllLiveLoading(true); setAllLiveError(null);
    try {
      const res = await api.get("/admin/auctions/live/all");
      setAllLiveAuctions(res.data.auctions || []);
      console.log('[Admin] fetchAllLiveAuctions response:', res.data.auctions);
    } catch (e) {
      setAllLiveError("Failed to load all live auctions");
    } finally {
      setAllLiveLoading(false);
    }
  };

  // Fetch database health data
  const fetchDbHealth = async () => {
    setDbHealthLoading(true); setDbHealthError(null);
    try {
      const res = await api.get("/admin/db-health");
      setDbHealthData(res.data.data);
    } catch (e) {
      setDbHealthError("Failed to load database health data");
    } finally {
      setDbHealthLoading(false);
    }
  };

  // Add Activity Logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState(null);

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    setActivityLogsLoading(true); setActivityLogsError(null);
    try {
      const res = await apiService.getActivityLogs();
      setActivityLogs(res.logs || []);
    } catch (e) {
      setActivityLogsError('Failed to load activity logs');
    } finally {
      setActivityLogsLoading(false);
    }
  };

  // Fetch platform earnings
  const fetchEarnings = async () => {
    setEarningsLoading(true); setEarningsError(null);
    try {
      const res = await api.get("/admin/earnings");
      setEarningsData(res.data);
    } catch (e) {
      setEarningsError("Failed to load earnings data");
    } finally {
      setEarningsLoading(false);
    }
  };

  // Admin Stripe Connect functions
  const fetchAdminStripeStatus = async () => {
    setAdminStripeStatusLoading(true);
    setAdminStripeStatusError('');
    try {
      const res = await api.get("/wallet/stripe-connect/status");
      setAdminStripeStatus(res.data);
    } catch (err) {
      setAdminStripeStatusError(err?.response?.data?.error || err.message || 'Failed to fetch admin payout status');
      setAdminStripeStatus(null);
    }
    setAdminStripeStatusLoading(false);
  };

  const handleAdminStartOnboarding = async () => {
    setAdminOnboardingLoading(true);
    setAdminStripeStatusError('');
    try {
      const res = await api.post("/wallet/stripe-connect/onboarding");
      setAdminOnboardingUrl(res.data.url);
      // Auto-redirect to Stripe onboarding
      window.location.href = res.data.url;
    } catch (err) {
      setAdminStripeStatusError(err?.response?.data?.error || err.message || 'Failed to start admin onboarding');
    }
    setAdminOnboardingLoading(false);
  };

  const handleAdminPayout = async () => {
    setAdminPayoutLoading(true);
    setAdminPayoutError('');
    setAdminPayoutSuccess('');
    try {
      await api.post("/wallet/stripe-connect/payout", { amount: Number(adminPayoutAmount) });
      setAdminPayoutSuccess('Admin payout requested successfully!');
      setAdminPayoutAmount('');
      // Refresh earnings data
      await fetchEarnings();
      showToast('Admin payout requested successfully! Your platform fees will be transferred to your bank account.', 'success');
    } catch (err) {
      setAdminPayoutError(err?.response?.data?.error || err.message || 'Failed to request admin payout');
      showToast(err?.response?.data?.error || err.message || 'Failed to request admin payout', 'error');
    }
    setAdminPayoutLoading(false);
  };

  // --- EFFECTS: FETCH DATA ON SECTION CHANGE ---
  useEffect(() => {
    // Log section change and what will be fetched
    console.log(`[AdminDashboard] Section changed to: ${section}`);
    if (section === "dashboard") fetchStats();
    if (section === "manage-users") {
      fetchPendingSellers();
      fetchAllUsers();
    }
    if (section === "approve-users") fetchPendingSellers();
    if (section === "manage-auctions") {
      fetchAllSettledAuctions();
      fetchAllLiveAuctions();
    }
    if (section === "earnings") {
      fetchEarnings();
      fetchAdminStripeStatus();
    }
    if (section === "db-health") fetchDbHealth();
    if (section === 'activity-logs') {
      console.log('Fetching activity logs...');
      fetchActivityLogs();
    }
  }, [section]);

  // Force fetch activity logs on mount for testing
  useEffect(() => {
    console.log('Component mounted, forcing activity logs fetch...');
    fetchActivityLogs();
  }, []);

  // Auto-polling for earnings data
  useEffect(() => {
    if (section === 'earnings') {
      // Initial fetch
      fetchEarnings();
      fetchAdminStripeStatus();
      
      // Set up polling every 30 seconds
      const earningsInterval = setInterval(() => {
        fetchEarnings();
      }, 30000);
      
      const stripeInterval = setInterval(() => {
        fetchAdminStripeStatus();
      }, 30000);
      
      return () => {
        clearInterval(earningsInterval);
        clearInterval(stripeInterval);
      };
    }
  }, [section]);

  // --- MODAL FOR REJECTING AUCTION ---
  const openRejectModal = (type, id) => {
    setRejectTarget({ type, id });
    setRejectionReason("");
    setShowRejectModal(true);
  };
  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectTarget(null);
    setRejectionReason("");
  };
  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) return;
    if (rejectTarget.type === "seller") {
      await handleSellerApproval(rejectTarget.id, false);
    } else if (rejectTarget.type === "settled") {
      await handleSettledAuctionApproval(rejectTarget.id, false, rejectionReason);
    } else if (rejectTarget.type === "live") {
      await handleLiveAuctionApproval(rejectTarget.id, false, rejectionReason);
    }
    closeRejectModal();
  };

  // Helper to open view modal
  const openViewModal = (type, data) => {
    setViewModalType(type);
    setViewModalData(data);
    setViewModalOpen(true);
  };
  const closeViewModal = () => setViewModalOpen(false);

  // Filtered auctions for manage/all auctions
  const getFilteredAuctions = (auctions) => {
    if (auctionFilter === 'all') return auctions;
    return auctions.filter(a => (a.status || a.auction_status) === auctionFilter);
  };

  // Auctions today count
  const auctionsToday = [...pendingSettledAuctions, ...pendingLiveAuctions].filter(a => {
    const created = new Date(a.created_at || a.start_time);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  }).length;

  // Top sellers by closed/approved listings
  const sellerCounts = {};
  [...pendingSettledAuctions, ...pendingLiveAuctions].forEach(a => {
    if ((a.status || a.auction_status) === 'closed' || (a.status || a.auction_status) === 'approved') {
      const key = a.seller?.email || a.seller_id;
      if (!sellerCounts[key]) sellerCounts[key] = { ...a.seller, count: 0 };
      sellerCounts[key].count++;
    }
  });
  const topSellers = Object.values(sellerCounts).sort((a, b) => b.count - a.count).slice(0, 3);

  // --- SECTION RENDERERS ---
  const [inlineDetails, setInlineDetails] = useState({ type: null, data: null });

  // Add useEffect to sync inlineDetails with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/admin/users/')) {
      const userId = path.split('/admin/users/')[1];
      if (userId) {
        // Find user in allUsers or fetch if needed
        const user = allUsers.find(u => String(u.id) === String(userId));
        if (user) setInlineDetails({ type: 'user', data: user });
        // else: optionally fetch user by ID
      }
    } else if (path.startsWith('/admin/auctions/')) {
      const parts = path.split('/admin/auctions/')[1].split('/');
      const type = parts[0];
      const auctionId = parts[1];
      if (type && auctionId) {
        const auction = (type === 'live' ? allLiveAuctions : allSettledAuctions).find(a => String(a.id) === String(auctionId));
        if (auction) setInlineDetails({ type: 'auction', data: auction });
        // else: optionally fetch auction by ID
      }
    } else {
      setInlineDetails({ type: null, data: null });
    }
  }, [location.pathname, allUsers, allLiveAuctions, allSettledAuctions]);

  // Only update lastPathRef.current in openUserDetails and openAuctionDetails
  const openUserDetails = (user) => {
    lastPathRef.current = location.pathname;
    setInlineDetails({ type: 'user', data: user });
    navigate(`/admin/manage-users/${user.id}`);
  };
  const openAuctionDetails = (auction) => {
    if (location.pathname.startsWith('/admin/manage-users/')) {
      fromUserRef.current = location.pathname;
    } else {
      fromUserRef.current = null;
    }
    lastPathRef.current = location.pathname;
    setInlineDetails({ type: 'auction', data: auction });
    navigate(`/admin/manage-auctions/${auction.type}/${auction.id}`);
  };

  // When closing details, revert URL
  const closeDetails = () => {
    setInlineDetails({ type: null, data: null });
    if (section === 'manage-auctions' && fromUserRef.current) {
      navigate(fromUserRef.current);
      fromUserRef.current = null;
    } else if (section === 'manage-auctions') {
      navigate('/admin/manage-auctions');
    } else if (section === 'manage-users') {
      navigate('/admin/manage-users');
    } else if (section === 'approve-users') {
      navigate('/admin/approve-users');
    } else {
      navigate('/admin/dashboard');
    }
  };

  // Measure main content height and set sidebar height to match
  useEffect(() => {
    if (mainRef.current) {
      setMainHeight(mainRef.current.offsetHeight);
    }
  }, [section]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (e) {}
    localStorage.removeItem("justbetToken");
    localStorage.removeItem("justbetUser");
    setUser(null);
    sessionStorage.setItem("showLogoutSuccess", "true");
    setTimeout(() => {
      navigate("/login");
    }, 500);
  };

  // --- MODAL FOR APPROVING AUCTION ---
  const openApproveModal = (type, id) => {
    setApproveTarget({ type, id });
    setShowApproveModal(true);
  };
  const closeApproveModal = () => {
    setShowApproveModal(false);
    setApproveTarget(null);
  };
  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    if (approveTarget.type === 'live') {
      await handleLiveAuctionApproval(approveTarget.id, true);
    } else if (approveTarget.type === 'settled') {
      await handleSettledAuctionApproval(approveTarget.id, true);
    }
    closeApproveModal();
  };

  // --- MODAL FOR APPROVING/REJECTING SELLERS ---
  const openSellerApproveModal = (seller) => {
    setSellerTarget({ id: seller.id, name: `${seller.first_name} ${seller.last_name}` });
    setShowSellerApproveModal(true);
  };
  const closeSellerApproveModal = () => {
    setShowSellerApproveModal(false);
    setSellerTarget(null);
  };
  const handleSellerApproveConfirm = async () => {
    if (!sellerTarget) return;
    await handleSellerApproval(sellerTarget.id, true);
    closeSellerApproveModal();
  };

  const openSellerRejectModal = (seller) => {
    setSellerTarget({ id: seller.id, name: `${seller.first_name} ${seller.last_name}` });
    setSellerRejectionReason("");
    setShowSellerRejectModal(true);
  };
  const closeSellerRejectModal = () => {
    setShowSellerRejectModal(false);
    setSellerTarget(null);
    setSellerRejectionReason("");
  };
  const handleSellerRejectConfirm = async () => {
    if (!sellerTarget || !sellerRejectionReason.trim()) return;
    await handleSellerApproval(sellerTarget.id, false, sellerRejectionReason);
    closeSellerRejectModal();
  };

  // Add at the top of AdminDashboard (after other useState):
  const [auctionWinner, setAuctionWinner] = useState(null);
  const [winnerLoading, setWinnerLoading] = useState(false);
  const [winnerChecked, setWinnerChecked] = useState(false);

  // Update the winner loading effect to set winnerChecked
  useEffect(() => {
    if (section === 'manage-auctions' && type && auctionId) {
      const auctionList = type === 'live' ? allLiveAuctions : allSettledAuctions;
      const auction = auctionList.find(a => String(a.id) === String(auctionId));
      if (auction && !auction.winner && (auction.status === 'closed' || auction.status === 'approved')) {
        setWinnerLoading(true);
        setWinnerChecked(false);
        const url = type === 'live'
          ? `${import.meta.env.VITE_BACKEND_URL}/api/auctions/live/${auction.id}/result`
          : `${import.meta.env.VITE_BACKEND_URL}/api/auctions/settled/${auction.id}/result`;
        fetch(url, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.result && data.result.winner) {
              setAuctionWinner(data.result.winner);
            } else {
              setAuctionWinner(null);
            }
          })
          .catch(() => setAuctionWinner(null))
          .finally(() => { setWinnerLoading(false); setWinnerChecked(true); });
      } else if (auction && auction.winner) {
        setAuctionWinner(auction.winner);
        setWinnerLoading(false);
        setWinnerChecked(true);
      } else {
        setAuctionWinner(null);
        setWinnerLoading(false);
        setWinnerChecked(true);
      }
    } else {
      setAuctionWinner(null);
      setWinnerLoading(false);
      setWinnerChecked(false);
    }
  }, [section, type, auctionId, allLiveAuctions, allSettledAuctions]);

  // Add this callback to update user in allUsers and pendingSellers after ban/unban
  const handleBanUnban = (updatedUser) => {
    setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
    setPendingSellers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
  };

  // Restore the renderSection function after the section variable is defined
  const renderSection = () => {
    // User details panel for manage-users and approve-users
    if ((section === 'manage-users' || section === 'approve-users') && userId) {
      if (allUsersLoading || pendingSellersLoading) return <LoadingSpinner />;
      const user = allUsers.find(u => String(u.id) === String(userId)) || pendingSellers.find(u => String(u.id) === String(userId));
      if (user) {
        return (
          <UserDetailsPanel
            user={user}
            onBack={closeDetails}
            onAuctionClick={openAuctionDetails}
            onUserClick={openUserDetails}
            onBanUnban={handleBanUnban}
          />
        );
      }
      return <div className="text-red-400 p-8">User not found.</div>;
    }
    // Auction details panel for manage-auctions
    if (section === 'manage-auctions' && type && auctionId) {
      if (allLiveLoading || allSettledLoading) return <LoadingSpinner />;
      const auctionList = type === 'live' ? allLiveAuctions : allSettledAuctions;
      const auction = auctionList.find(a => String(a.id) === String(auctionId));
      if (auction) {
        return (
          <AuctionDetailsPanel
            auction={{ ...auction, winner: auctionWinner }}
            onBack={closeDetails}
            onViewSeller={openUserDetails}
            onUserClick={openUserDetails}
            winnerLoading={winnerLoading}
            winnerChecked={winnerChecked}
          />
        );
      }
      return <div className="text-red-400 p-8">Auction not found.</div>;
    }
    switch (section) {
      case "dashboard":
        return (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
              <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <button
                  onClick={fetchStats}
                  disabled={statsLoading}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  title="Refresh dashboard stats"
                >
                  <i className={`fa-solid fa-sync-alt ${statsLoading ? 'animate-spin' : ''}`}></i>
                </button>
              </div>
            </div>
            {/* Stats Row */}
            {statsLoading ? <div className="text-gray-300">Loading stats...</div> : statsError ? <div className="text-red-400">{statsError}</div> : statsData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2">
                  <i className="fa-solid fa-users text-2xl text-blue-400"></i>
                  <div className="text-2xl font-bold text-white">{statsData.users?.total ?? '-'}</div>
                  <div className="text-xs text-gray-300 font-semibold">Total Users</div>
                </div>
                <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2">
                  <i className="fa-solid fa-gavel text-2xl text-purple-400"></i>
                  <div className="text-2xl font-bold text-white">{statsData.auctions?.total ?? '-'}</div>
                  <div className="text-xs text-gray-300 font-semibold">Total Auctions</div>
                </div>
                <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2">
                  <i className="fa-solid fa-dollar-sign text-2xl text-green-400"></i>
                  <div className="text-2xl font-bold text-white">${earningsData?.totalEarnings?.toFixed(2) ?? '-'}</div>
                  <div className="text-xs text-gray-300 font-semibold">Total Earnings</div>
                </div>
                <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2">
                  <i className="fa-solid fa-user-plus text-2xl text-yellow-400"></i>
                  <div className="text-2xl font-bold text-white">{statsData.users?.pendingSellerRequests ?? '-'}</div>
                  <div className="text-xs text-gray-300 font-semibold">Pending Seller Requests</div>
                </div>
                <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2">
                  <i className="fa-solid fa-clock text-2xl text-orange-400"></i>
                  <div className="text-2xl font-bold text-white">
                    {(statsData.auctions?.live?.pending || 0) + (statsData.auctions?.settled?.pending || 0)}
              </div>
                  <div className="text-xs text-gray-300 font-semibold">Pending Auctions</div>
                      </div>
              </div>
            )}
            {/* Quick Links/Channels */}
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div onClick={() => navigate('/admin/manage-users')} className="rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition bg-blue-900/60 text-blue-300 backdrop-blur-md">
                <i className="fa-solid fa-user-cog text-xl mb-2"></i>
                <div className="font-semibold text-sm">Manage Users</div>
              </div>
              <div onClick={() => { navigate('/admin/manage-auctions'); setAuctionFilter('pending'); }} className="rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition bg-green-900/60 text-green-300 backdrop-blur-md">
                <i className="fa-solid fa-check-circle text-xl mb-2"></i>
                <div className="font-semibold text-sm">Approve Auctions</div>
              </div>
              <div onClick={() => { navigate('/admin/earnings'); setTimeout(() => { const el = document.querySelector('#admin-payout-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100); }} className="rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition bg-purple-900/60 text-purple-300 backdrop-blur-md">
                <i className="fa-solid fa-wallet text-xl mb-2"></i>
                <div className="font-semibold text-sm">Withdraw Earnings</div>
              </div>
              <div onClick={() => navigate('/admin/db-health')} className="rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition bg-blue-900/60 text-blue-300 backdrop-blur-md">
                <i className="fa-solid fa-database text-xl mb-2"></i>
                <div className="font-semibold text-sm">View DB Health</div>
              </div>
            </div>
            {/* Top Sellers Leaderboard --> Replaced with Recent Activity Feed */}
            <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 p-4 flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-white">Recent Activity</h2>
                <button
                  className="text-xs text-purple-300 hover:underline font-semibold"
                  onClick={() => navigate('/admin/activity-logs')}
                >
                  View All
                </button>
              </div>
              {/* Table header for desktop only */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-1 text-xs font-semibold text-gray-400">
                <div className="col-span-1"> </div>
                <div className="col-span-2">User</div>
                <div className="col-span-2">Action</div>
                <div className="col-span-5">Description</div>
                <div className="col-span-2 text-right">Time</div>
              </div>
              {activityLogsLoading ? (
                <div className="text-gray-300 py-4">Loading activity...</div>
              ) : activityLogsError ? (
                <div className="text-red-400 py-4">{activityLogsError}</div>
              ) : (activityLogs && activityLogs.length > 0) ? (
                <ul className="divide-y divide-white/10">
                  {activityLogs.slice(0, 3).map((log, idx) => {
                    let icon = 'fa-list-alt', color = 'text-blue-300';
                    if (log.type === 'user') { icon = 'fa-user-plus'; color = 'text-yellow-300'; }
                    else if (log.type === 'live_auction' || log.type === 'settled_auction') { icon = 'fa-gavel'; color = 'text-purple-300'; }
                    else if (log.type === 'live_auction_result' || log.type === 'settled_auction_result') { icon = 'fa-trophy'; color = 'text-green-300'; }
                    else if (log.type === 'transaction') { icon = 'fa-dollar-sign'; color = 'text-green-400'; }
                    return (
                      <li key={idx} className="py-2">
                        {/* Desktop grid row */}
                        <div className="hidden md:grid grid-cols-12 gap-2 items-center text-xs md:text-sm">
                          <div className="col-span-1 flex justify-center">
                            <span className={`w-7 h-7 rounded-full bg-[#181c2f] flex items-center justify-center ${color}`}>
                              <i className={`fa-solid ${icon}`}></i>
                            </span>
                          </div>
                          <div className="col-span-2 truncate font-semibold text-white">{log.user || '-'}</div>
                          <div className="col-span-2">
                            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium">{log.action || '-'}</span>
                          </div>
                          <div className="col-span-5 text-gray-300 break-words whitespace-pre-line">{log.description || '-'}</div>
                          <div className="col-span-2 text-right text-gray-400">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</div>
                        </div>
                        {/* Mobile stacked row */}
                        <div className="block md:hidden flex flex-col gap-1 pl-1 py-2 border-l-2 border-purple-700/30">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-7 h-7 rounded-full bg-[#181c2f] flex items-center justify-center ${color}`}>
                              <i className={`fa-solid ${icon}`}></i>
                            </span>
                            <span className="font-semibold text-white text-sm">{log.user || '-'}</span>
                            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium">{log.action || '-'}</span>
                          </div>
                          <div className="text-gray-300 text-xs break-words whitespace-pre-line ml-9">{log.description || '-'}</div>
                          <div className="text-xs text-gray-400 ml-9">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</div>
                        </div>
                    </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-gray-400">No recent activity.</div>
              )}
            </div>
          </>
        );
      case "manage-users":
        // Pagination logic
        const USERS_PER_PAGE = 7;
        const totalUserPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
        const paginatedUsers = allUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Manage Users</h2>
              <button
                onClick={fetchAllUsers}
                disabled={allUsersLoading}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Refresh users data"
              >
                <i className={`fa-solid fa-sync-alt ${allUsersLoading ? 'animate-spin' : ''}`}></i>
              </button>
            </div>
            <div className="flex-1 h-full min-h-0 overflow-auto">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="md:table table-fixed w-full bg-transparent rounded-xl overflow-hidden">
                  <thead>
                    <tr>
                      <th className="w-1/4 text-left px-4 py-2 font-bold text-base">Name</th>
                      <th className="w-1/3 text-left px-4 py-2 font-bold text-base">Email</th>
                      <th className="w-1/6 text-center px-4 py-2 font-bold text-base">Role</th>
                      <th className="w-24 text-center px-4 py-2 font-bold text-base">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-left text-sm">
                    {paginatedUsers.length === 0 ? <tr><td colSpan={4} className="text-center text-gray-400 p-4">No users found</td></tr> : paginatedUsers.map(user => (
                      <tr key={user.id} className="border-b border-white/10">
                        <td className="p-3 font-semibold text-white align-middle text-left">{user.first_name} {user.last_name}</td>
                        <td className="p-3 align-middle text-left">{user.email}</td>
                        <td className="p-3 align-middle text-center">{user.role}</td>
                        <td className="p-3 align-middle text-center">
                          <div className="flex justify-center">
                            <button onClick={() => openUserDetails(user)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-4 py-2 rounded text-xs">View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card List */}
              <div className="block md:hidden space-y-4">
                {paginatedUsers.length === 0 ? (
                  <div className="text-center text-gray-400 p-4">No users found</div>
                ) : paginatedUsers.map(user => (
                  <div key={user.id} className="rounded-xl border border-white/10 p-4 flex flex-col gap-2 shadow">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-base">{user.first_name} {user.last_name}</span>
                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium ml-2">{user.role}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-300 text-sm break-all">{user.email}</span>
                      <button onClick={() => openUserDetails(user)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination Controls */}
              {totalUserPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                    onClick={() => setUserPage(p => Math.max(1, p - 1))}
                    disabled={userPage === 1}
                  >Prev</button>
                  <span className="text-white text-sm">Page {userPage} of {totalUserPages}</span>
                  <button
                    className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                    onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                    disabled={userPage === totalUserPages}
                  >Next</button>
                </div>
              )}
            </div>
          </div>
        );
      case "approve-users":
        // Pagination logic
        const SELLERS_PER_PAGE = 7;
        const totalSellerPages = Math.ceil(pendingSellers.length / SELLERS_PER_PAGE);
        const paginatedSellers = pendingSellers.slice((sellerPage - 1) * SELLERS_PER_PAGE, sellerPage * SELLERS_PER_PAGE);
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Approve Sellers</h2>
              <button
                onClick={fetchPendingSellers}
                disabled={pendingSellersLoading}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Refresh pending sellers data"
              >
                <i className={`fa-solid fa-sync-alt ${pendingSellersLoading ? 'animate-spin' : ''}`}></i>
              </button>
            </div>
            <div className="flex-1 h-full min-h-0 overflow-auto">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="md:table table-fixed w-full bg-transparent rounded-xl overflow-hidden">
                  <thead>
                    <tr>
                      <th className="w-1/4 text-left px-4 py-2 font-bold text-base">Name</th>
                      <th className="w-1/3 text-left px-4 py-2 font-bold text-base">Email</th>
                      <th className="w-1/6 text-left px-4 py-2 font-bold text-base">Business</th>
                      <th className="w-24 text-center px-4 py-2 font-bold text-base">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-left text-sm">
                    {paginatedSellers.length === 0 ? <tr><td colSpan={4} className="text-center text-gray-400 p-4">No pending sellers</td></tr> : paginatedSellers.map(seller => (
                      <tr key={seller.id} className="border-b border-white/10">
                        <td className="p-3 text-left"><a href="#" onClick={e => { e.preventDefault(); openUserDetails(seller); }}>{seller.first_name} {seller.last_name}</a></td>
                        <td className="p-3 text-left">{seller.email}</td>
                        <td className="p-3 text-left">{seller.business_name}</td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => openUserDetails(seller)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                            <button disabled={actionLoading} onClick={() => openSellerApproveModal(seller)} className="bg-[#38b000] text-white hover:bg-[#2d8a00] px-3 py-1 rounded text-xs">Approve</button>
                            <button disabled={actionLoading} onClick={() => openSellerRejectModal(seller)} className="bg-[#db2955] hover:bg-[#b71c3a] text-white px-3 py-1 rounded text-xs">Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card List */}
              <div className="block md:hidden space-y-4">
                {paginatedSellers.length === 0 ? (
                  <div className="text-center text-gray-400 p-4">No pending sellers</div>
                ) : paginatedSellers.map(seller => (
                  <div key={seller.id} className="rounded-xl border border-white/10 p-4 flex flex-col gap-2 shadow">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-base">{seller.first_name} {seller.last_name}</span>
                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium ml-2">{seller.business_name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-300 text-sm break-all">{seller.email}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openUserDetails(seller)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                        <button disabled={actionLoading} onClick={() => openSellerApproveModal(seller)} className="bg-[#38b000] text-white hover:bg-[#2d8a00] px-3 py-1 rounded text-xs">Approve</button>
                        <button disabled={actionLoading} onClick={() => openSellerRejectModal(seller)} className="bg-[#db2955] hover:bg-[#b71c3a] text-white px-3 py-1 rounded text-xs">Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination Controls */}
              {totalSellerPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                    onClick={() => setSellerPage(p => Math.max(1, p - 1))}
                    disabled={sellerPage === 1}
                  >Prev</button>
                  <span className="text-white text-sm">Page {sellerPage} of {totalSellerPages}</span>
                  <button
                    className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                    onClick={() => setSellerPage(p => Math.min(totalSellerPages, p + 1))}
                    disabled={sellerPage === totalSellerPages}
                  >Next</button>
                </div>
              )}
            </div>
            {actionError && <div className="text-red-400 mt-2">{actionError}</div>}
          </div>
        );
      case "manage-auctions":
        const AUCTIONS_PER_PAGE = 7;
        const filteredAuctions = getFilteredAuctions([
          ...allSettledAuctions.map(a => ({ ...a, type: 'settled' })),
          ...allLiveAuctions.map(a => ({ ...a, type: 'live' }))
        ]);
        const totalAuctionPages = Math.ceil(filteredAuctions.length / AUCTIONS_PER_PAGE);
        const paginatedAuctions = filteredAuctions.slice((auctionPage - 1) * AUCTIONS_PER_PAGE, auctionPage * AUCTIONS_PER_PAGE);
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Manage Auctions</h2>
              <button
                onClick={() => { fetchAllSettledAuctions(); fetchAllLiveAuctions(); }}
                disabled={allSettledLoading || allLiveLoading}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Refresh auctions data"
              >
                <i className={`fa-solid fa-sync-alt ${allSettledLoading || allLiveLoading ? 'animate-spin' : ''}`}></i>
              </button>
            </div>
            <div className="flex-1 h-full min-h-0 overflow-auto">
              {/* Filter controls */}
              <div className="mb-4 flex items-center gap-2">
                <label className="text-gray-300">Filter:</label>
                <select value={auctionFilter} onChange={e => setAuctionFilter(e.target.value)} className="bg-[#23235b] text-white rounded px-2 py-1 border border-white/10">
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="min-w-full md:table-fixed w-full bg-transparent rounded-xl overflow-x-auto md:overflow-visible block md:table">
                  <thead className="block md:table-header-group w-full">
                    <tr className="block md:table-row">
                      <th className="w-1/9 text-left px-3 py-1 font-bold">Title</th>
                      <th className="w-1/8 text-center px-3 py-1 font-bold ">Type</th>
                      <th className="w-1/8 text-center px-3 py-1 font-bold">Status</th>
                      <th className="w-26 text-center px-3 py-1 font-bold">Seller</th>
                      <th className="w-1/8 text-center px-6 py-3 font-bold text-lg">Start</th>
                      <th className="w-1/8 text-center px-6 py-3 font-bold text-lg">End</th>
                      <th className="w-32 text-center px-6 py-3 font-bold text-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="block md:table-row-group w-full">
                    {paginatedAuctions.length === 0 ? <tr><td colSpan={7} className="text-center text-gray-400 p-4">No auctions found</td></tr> : paginatedAuctions.map(auction => (
                      <tr key={auction.id} className="block md:table-row border-b border-white/10">
                        <td className="p-2 font-semibold text-white align-middle text-left">{auction.title}</td>
                        <td className="p-2 align-middle text-center">{auction.type === 'live' ? 'Live' : 'Settled'}</td>
                        <td className="p-2 align-middle text-center">{auction.status || auction.auction_status}</td>
                        <td className="p-2 align-middle text-center">{auction.seller?.first_name} {auction.seller?.last_name}</td>
                        <td className="p-2">{new Date(auction.start_time).toLocaleString()}</td>
                        <td className="p-2">{new Date(auction.end_time).toLocaleString()}</td>
                        <td className="p-2">
                          {(auction.status === 'pending' || auction.auction_status === 'pending') ? (
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => openAuctionDetails(auction)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                              <button disabled={actionLoading} onClick={() => openApproveModal(auction.type, auction.id)} className="bg-[#38b000] text-white hover:bg-[#2d8a00] px-3 py-1 rounded text-xs">Approve</button>
                              <button disabled={actionLoading} onClick={() => openRejectModal(auction.type, auction.id)} className="bg-[#db2955] hover:bg-[#b71c3a] text-white px-3 py-1 rounded text-xs">Reject</button>
                            </div>
                          ) : (
                            <button onClick={() => openAuctionDetails(auction)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card List */}
              <div className="block md:hidden space-y-4">
                {paginatedAuctions.length === 0 ? (
                  <div className="text-center text-gray-400 p-4">No auctions found</div>
                ) : paginatedAuctions.map(auction => (
                  <div key={auction.id} className="rounded-xl border border-white/10 p-4 flex flex-col gap-2 shadow">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-base">{auction.title}</span>
                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium ml-2">{auction.type === 'live' ? 'Live' : 'Settled'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-300">
                      <span>Status: <span className="font-semibold text-white">{auction.status || auction.auction_status}</span></span>
                      <span>Seller: <span className="font-semibold text-white">{auction.seller?.first_name} {auction.seller?.last_name}</span></span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-300">
                      <span>Start: <span className="font-semibold text-white">{new Date(auction.start_time).toLocaleString()}</span></span>
                      <span>End: <span className="font-semibold text-white">{new Date(auction.end_time).toLocaleString()}</span></span>
                    </div>
                    <div className="flex gap-2 mt-2 justify-end">
                      {(auction.status === 'pending' || auction.auction_status === 'pending') ? (
                        <>
                          <button onClick={() => openAuctionDetails(auction)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                          <button disabled={actionLoading} onClick={() => openApproveModal(auction.type, auction.id)} className="bg-[#38b000] text-white hover:bg-[#2d8a00] px-3 py-1 rounded text-xs">Approve</button>
                          <button disabled={actionLoading} onClick={() => openRejectModal(auction.type, auction.id)} className="bg-[#db2955] hover:bg-[#b71c3a] text-white px-3 py-1 rounded text-xs">Reject</button>
                        </>
                      ) : (
                        <button onClick={() => openAuctionDetails(auction)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination Controls */}
              {totalAuctionPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                    onClick={() => setAuctionPage(p => Math.max(1, p - 1))}
                    disabled={auctionPage === 1}
                  >Prev</button>
                  <span className="text-white text-sm">Page {auctionPage} of {totalAuctionPages}</span>
                  <button
                    className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                    onClick={() => setAuctionPage(p => Math.min(totalAuctionPages, p + 1))}
                    disabled={auctionPage === totalAuctionPages}
                  >Next</button>
                </div>
              )}
            </div>
          </div>
        );
      case "earnings":
        return (
          <div className="h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Platform Earnings</h2>
              <button
                onClick={fetchEarnings}
                disabled={earningsLoading}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Refresh earnings data"
              >
                <i className={`fa-solid fa-sync-alt ${earningsLoading ? 'animate-spin' : ''}`}></i>
              </button>
            </div>
            {earningsLoading ? (
              <div className="text-gray-300">Loading earnings data...</div>
            ) : earningsError ? (
              <div className="text-red-400">{earningsError}</div>
            ) : earningsData ? (
              <div className="space-y-6 pb-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="rounded-xl p-6 border border-white/10 bg-gradient-to-br from-green-500/10 to-green-600/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Earnings</p>
                        <p className="text-2xl font-bold text-green-400">
                          ${earningsData.totalEarnings?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div className="text-green-400 text-3xl">
                        <i className="fa-solid fa-dollar-sign"></i>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-xl p-6 border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Available to Withdraw</p>
                        <p className="text-2xl font-bold text-blue-400">
                          ${earningsData.availableBalance?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div className="text-blue-400 text-3xl">
                        <i className="fa-solid fa-wallet"></i>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-xl p-6 border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Last 30 Days</p>
                        <p className="text-2xl font-bold text-blue-400">
                          ${earningsData.recentEarnings?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div className="text-blue-400 text-3xl">
                        <i className="fa-solid fa-calendar"></i>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-xl p-6 border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Total Transactions</p>
                        <p className="text-2xl font-bold text-purple-400">
                          {earningsData.totalCount || 0}
                        </p>
                      </div>
                      <div className="text-purple-400 text-3xl">
                        <i className="fa-solid fa-receipt"></i>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Chart */}
                {earningsData.monthlyData && earningsData.monthlyData.length > 0 && (
                  <div className="rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-chart-line"></i>
                      Monthly Earnings Trend
                    </h3>
                    <div className="space-y-3">
                      {earningsData.monthlyData.map((month, index) => (
                        <div key={month.month} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-300 font-medium">
                              {new Date(month.month + '-01').toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long' 
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ 
                                  width: `${Math.min(100, (month.amount / Math.max(...earningsData.monthlyData.map(m => m.amount))) * 100)}%` 
                                }}
                              ></div>
                            </div>
                            <span className="text-green-400 font-semibold">
                              ${month.amount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                <div className="rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-list"></i>
                    Recent Platform Fees
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left p-3 text-gray-400 font-medium">Date</th>
                          <th className="text-left p-3 text-gray-400 font-medium">User</th>
                          <th className="text-left p-3 text-gray-400 font-medium">Auction</th>
                          <th className="text-left p-3 text-gray-400 font-medium">Amount</th>
                          <th className="text-left p-3 text-gray-400 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earningsData.earnings && earningsData.earnings.length > 0 ? (
                          earningsData.earnings.slice(0, 10).map((earning, index) => (
                            <tr key={index} className="border-b border-white/5">
                              <td className="p-3 text-white">
                                {new Date(earning.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-white">
                                {earning.user_email || `${earning.first_name || ''} ${earning.last_name || ''}`.trim() || 'Unknown'}
                              </td>
                              <td className="p-3 text-gray-300">
                                {earning.description?.includes('auction') ? 
                                  earning.description.replace('Platform fee from auction ', '').replace('Platform fee from live auction ', '') : 
                                  'N/A'
                                }
                              </td>
                              <td className="p-3 text-green-400 font-semibold">
                                ${parseFloat(earning.amount).toFixed(2)}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  earning.status === 'succeeded' 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {earning.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center text-gray-400 p-8">
                              No Recent platform fees
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Admin Stripe Connect Section */}
                <div className="rounded-xl p-6 border border-white/10 mt-8">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-university"></i>
                    Admin Payout Management
                  </h3>
                  
                  {/* Admin Stripe Connect Onboarding Status */}
                  {adminStripeStatusLoading ? (
                    <div className="text-center py-4">Checking admin onboarding status...</div>
                  ) : (
                    (!adminStripeStatus || (adminStripeStatusError && /no connected account|not found|404/i.test(adminStripeStatusError))) ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">🔗</div>
                        <div className="text-lg font-semibold mb-2 text-red-400">No admin Stripe account connected</div>
                        <div className="text-gray-300 mb-4">To receive platform fee payouts, you must connect your Stripe account as admin. Click below to create or connect your account.</div>
                        <Button
                          variant="primary"
                          size="default"
                          onClick={handleAdminStartOnboarding}
                          disabled={adminOnboardingLoading}
                          className="flex items-center gap-2"
                        >
                          {adminOnboardingLoading ? 'Loading...' : 'Create/Connect Admin Stripe Account'}
                        </Button>
                        {adminStripeStatusError && !/no connected account|not found|404/i.test(adminStripeStatusError) && (
                          <div className="text-red-400 text-sm mt-4">{adminStripeStatusError}</div>
                        )}
                      </div>
                    ) : adminStripeStatusError ? (
                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4 text-center text-red-400">{adminStripeStatusError}</div>
                    ) : (
                      <>
                        <div className="mb-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${
                            adminStripeStatus.payouts_enabled ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' :
                            adminStripeStatus.details_submitted ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
                            'bg-red-900/30 text-red-400 border border-red-500/30'
                          }`}>
                            {adminStripeStatus.payouts_enabled ? 'Ready for Payouts' :
                              adminStripeStatus.details_submitted ? 'Pending Verification' :
                              'Onboarding Required'}
                          </span>
                          <div className="text-gray-300 mt-2">
                            {adminStripeStatus.payouts_enabled ? (
                              <>Your admin Stripe account is fully onboarded and ready to receive platform fee payouts.</>
                            ) : adminStripeStatus.details_submitted ? (
                              <>Your admin onboarding is submitted and pending verification by Stripe. You will be notified when payouts are enabled.</>
                            ) : (
                              <>You must complete admin onboarding to receive platform fee payouts. Click below to start or continue onboarding.</>
                            )}
                          </div>
                        </div>
                        
                        {/* Admin Onboarding Button */}
                        {!adminStripeStatus.payouts_enabled && (
                          <div className="text-center mb-6">
                            <Button
                              variant="primary"
                              size="default"
                              onClick={handleAdminStartOnboarding}
                              disabled={adminOnboardingLoading}
                              className="flex items-center gap-2"
                            >
                              {adminOnboardingLoading ? 'Loading...' : 'Start/Continue Admin Stripe Onboarding'}
                            </Button>
                          </div>
                        )}
                        
                        {/* Admin Payout Form */}
                        {adminStripeStatus.payouts_enabled && (
                          <div className="mt-8">
                            <h4 className="text-lg font-semibold mb-2 text-green-400">Request Platform Fee Payout</h4>
                            {/* Platform Fees Available to Withdraw */}
                            <div className="mb-4 text-center">
                              <span className="block text-md text-gray-200 font-semibold mb-1">Platform Fees Available to Withdraw:</span>
                              <span className="text-2xl font-bold text-green-300">
                                ${earningsData?.availableBalance?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                            <form
                              onSubmit={e => {
                                e.preventDefault();
                                const amount = Number(adminPayoutAmount);
                                const available = Number(earningsData?.availableBalance || 0);
                                
                                if (!adminPayoutAmount || amount <= 0) {
                                  setAdminPayoutError('Please enter a valid amount');
                                  showToast('Please enter a valid amount', 'error');
                                  return;
                                }
                                
                                if (amount > available) {
                                  setAdminPayoutError(`Amount exceeds available balance ($${available.toFixed(2)})`);
                                  showToast(`Amount exceeds available balance ($${available.toFixed(2)})`, 'error');
                                  return;
                                }
                                
                                handleAdminPayout();
                              }}
                              className="max-w-md mx-auto"
                  >
                              <div className="flex flex-col gap-3">
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  placeholder="Amount to withdraw (CAD)"
                                  value={adminPayoutAmount}
                                  onChange={e => setAdminPayoutAmount(e.target.value)}
                                  className={`bg-white/10 border rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-400 ${
                                    adminPayoutAmount && Number(adminPayoutAmount) > Number(earningsData?.availableBalance || 0)
                                      ? 'border-red-400 focus:ring-red-400'
                                      : 'border-white/20 focus:ring-green-400'
                                  }`}
                                />
                                <div className="h-6 flex items-center justify-center">
                                  {adminPayoutAmount && Number(adminPayoutAmount) > Number(earningsData?.availableBalance || 0) && (
                                    <div className="text-red-400 text-sm text-center">
                                      Amount exceeds available balance (${earningsData?.availableBalance?.toFixed(2) || '0.00'})
                                    </div>
                                  )}
                                </div>
                                <Button
                                  type="submit"
                                  variant="primary"
                                  size="default"
                                  disabled={adminPayoutLoading || !adminPayoutAmount || Number(adminPayoutAmount) <= 0 || Number(adminPayoutAmount) > Number(earningsData?.availableBalance || 0)}
                                >
                                  {adminPayoutLoading ? 'Processing...' : 'Request Platform Fee Payout'}
                                </Button>
                                {/* Error/Success display */}
                                {adminPayoutError && (
                                  <div className="text-red-400 text-sm mt-1">
                                    {adminPayoutError.includes('PaymentIntent') || adminPayoutError.includes('stripe')
                                      ? 'Failed to create admin payout. Please check your Stripe account and try again.'
                                      : adminPayoutError}
                                  </div>
                                )}
                                {adminPayoutSuccess && <div className="text-green-400 text-sm mt-1">{adminPayoutSuccess}</div>}
                              </div>
                            </form>
                          </div>
                        )}
                      </>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-400">No earnings data available.</div>
            )}
          </div>
        );
      case "db-health":
        return (
          <div className="h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold"> Health Monitor</h2>
              <button
                onClick={fetchDbHealth}
                disabled={dbHealthLoading}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Refresh database health data"
              >
                <i className={`fa-solid fa-sync-alt ${dbHealthLoading ? 'animate-spin' : ''}`}></i>
              </button>
            </div>
            {dbHealthLoading ? (
              <div className="text-gray-300">Loading database health data...</div>
            ) : dbHealthError ? (
              <div className="text-red-400">{dbHealthError}</div>
            ) : dbHealthData ? (
              <div className="space-y-6 pb-6">
                {/* Connection Status */}
                <div className="rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-plug"></i>
                    Connection Status
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        dbHealthData.error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {dbHealthData.error ? 'Error' : 'Healthy'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">Response Time:</span>
                      <span className="text-white font-semibold">{dbHealthData.queryPerformance || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-300">Last Check:</span>
                      <span className="text-white text-sm">
                        {new Date(dbHealthData.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Connection Pool Stats */}
                <div className="rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-database"></i>
                    Connection Pool Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">{dbHealthData.poolStats?.total || 0}</div>
                      <div className="text-xs text-gray-400">Total Connections</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-green-400">{dbHealthData.poolStats?.active || 0}</div>
                      <div className="text-xs text-gray-400">Active Connections</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-400">{dbHealthData.poolStats?.idle || 0}</div>
                      <div className="text-xs text-gray-400">Idle Connections</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-2xl font-bold text-purple-400">{dbHealthData.poolStats?.waiting || 0}</div>
                      <div className="text-xs text-gray-400">Waiting Connections</div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-lightbulb"></i>
                    Recommendations
                  </h3>
                  {dbHealthData.recommendations && dbHealthData.recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {dbHealthData.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-300">
                          <i className="fa-solid fa-arrow-right text-blue-400 mt-1 text-xs"></i>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-400">No recommendations at this time.</div>
                  )}
                </div>

                {/* Error Details */}
                {dbHealthData.error && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-400">
                      <i className="fa-solid fa-exclamation-triangle"></i>
                      Error Details
                    </h3>
                    <div className="text-red-300 text-sm">
                      {dbHealthData.error}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400">No database health data available.</div>
            )}
          </div>
        );
      case "activity-logs":
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Activity Logs</h2>
              <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                Showing {activityLogs.length} logs from the last 48 hours
                </div>
                <button
                  onClick={fetchActivityLogs}
                  disabled={activityLogsLoading}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  title="Refresh activity logs"
                >
                  <i className={`fa-solid fa-sync-alt ${activityLogsLoading ? 'animate-spin' : ''}`}></i>
                </button>
              </div>
            </div>
            <div className="flex-1 h-full min-h-0 overflow-auto">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full bg-transparent rounded-xl overflow-hidden">
                  <thead>
                    <tr>
                      <th className="w-1/6 text-left px-4 py-2 font-bold text-base">Date</th>
                      <th className="w-1/6 text-left px-4 py-2 font-bold text-base">User</th>
                      <th className="max-w-xs text-left px-4 py-2 font-bold text-base">Action</th>
                      <th className="min-w-0 text-left px-4 py-2 font-bold text-base">Description</th>
                    </tr>
                  </thead>
                  <tbody className="h-full min-h-0 text-left text-sm">
                    {activityLogsLoading ? (
                      <tr><td colSpan={4} className="text-center text-gray-300 p-8">Loading activity logs...</td></tr>
                    ) : activityLogsError ? (
                      <tr><td colSpan={4} className="text-center text-red-400 p-8">{activityLogsError}</td></tr>
                    ) : activityLogs.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-gray-400 p-8">No activity logs found</td></tr>
                    ) : activityLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-white/10">
                        <td className="p-2 align-middle text-left text-white">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                        <td className="p-2 align-middle text-left text-white font-medium">{log.user || '-'}</td>
                        <td className="p-2 align-middle text-left text-white max-w-xs truncate">
                          <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs font-medium">{log.action || '-'}</span>
                        </td>
                        <td className="p-2 align-middle text-left text-gray-300 min-w-0 break-words whitespace-pre-line">{log.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card List */}
              <div className="block md:hidden space-y-4">
                {activityLogsLoading ? (
                  <div className="text-center text-gray-300 p-4">Loading activity logs...</div>
                ) : activityLogsError ? (
                  <div className="text-center text-red-400 p-4">{activityLogsError}</div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center text-gray-400 p-4">No activity logs found</div>
                ) : activityLogs.map((log, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 p-4 flex flex-col gap-2 shadow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white text-base">{log.user || '-'}</span>
                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded text-xs font-medium ml-2">{log.action || '-'}</span>
                    </div>
                    <div className="text-gray-300 text-sm break-words whitespace-pre-line">{log.description || '-'}</div>
                    <div className="text-xs text-gray-400">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Add at the top of AdminDashboard (after other refs):
  const lastPathRef = useRef(location.pathname);
  const fromUserRef = useRef(null);

  const handleMobileNav = (key) => {
    if (key === 'dashboard') navigate('/admin/dashboard');
    else if (key === 'manage-users') navigate('/admin/manage-users');
    else if (key === 'manage-auctions') navigate('/admin/manage-auctions');
    else if (key === 'approve-users') navigate('/admin/approve-users');
    else if (key === 'earnings') navigate('/admin/earnings');
    else if (key === 'db-health') navigate('/admin/db-health');
    else if (key === 'activity-logs') navigate('/admin/activity-logs');
  };

  // Add after all other useState hooks at the top of AdminDashboard:
  const [userPage, setUserPage] = useState(1);
  const [auctionPage, setAuctionPage] = useState(1);
  const [sellerPage, setSellerPage] = useState(1);

  return (
    <div className={`w-full bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] flex flex-col md:flex-row items-center md:items-start justify-center py-2 md:py-6 px-0 md:px-2 transition-opacity duration-300 ${isLoggingOut ? 'opacity-0' : 'opacity-100'} min-h-screen md:min-h-screen`}>
      {/* Mobile Navbar and Drawer */}
      <AdminMobileNavbar navLinks={navLinks} section={section} onNav={handleMobileNav} onLogout={handleLogout} />
      <div className="w-full max-w-7xl flex flex-col md:flex-row overflow-hidden rounded-2xl min-h-[92vh] md:min-h-[92vh] h-full">
        {/* Sidebar (hidden on mobile) */}
        <aside className="hidden md:flex w-64 min-h-[92vh] md:min-h-[92vh] bg-[#181c2f]/80 backdrop-blur-md border-r border-white/10 flex-col py-8 px-6 text-white rounded-l-2xl">
          <div>
            <div className="flex flex-col items-center gap-2 mb-8 select-none">
              <img src={`https://ui-avatars.com/api/?name=${user?.firstName || 'A'}+${user?.lastName || 'D'}&background=2a2a72&color=fff`} alt="avatar" className="w-16 h-16 rounded-full border-2 border-white/30" />
              <div className="font-bold text-white text-lg">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-gray-400">{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}</div>
            </div>
            <nav className="flex flex-col gap-2 mt-6 mb-2">
              {navLinks.filter(link => link.key !== "approve-auctions").map(link => (
                <button
                  key={link.key}
                  onClick={() => {
                    if (link.key === 'dashboard') navigate('/admin/dashboard');
                    else if (link.key === 'manage-users') navigate('/admin/manage-users');
                    else if (link.key === 'manage-auctions') navigate('/admin/manage-auctions');
                    else if (link.key === 'approve-users') navigate('/admin/approve-users');
                    else if (link.key === 'earnings') navigate('/admin/earnings');
                    else if (link.key === 'db-health') navigate('/admin/db-health');
                    else if (link.key === 'activity-logs') navigate('/admin/activity-logs');
                  }}
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
        <main ref={mainRef} className="flex-1 min-h-[92vh] md:min-h-[92vh] bg-[#181c2f]/40 backdrop-blur-md rounded-none md:rounded-r-2xl p-2 md:p-6 flex flex-col gap-4 text-white overflow-auto md:overflow-visible">
          {renderSection()}
        </main>
      </div>

      {/* Approve Auction Modal */}
      {showApproveModal && (
        <ConfirmModal
          open={showApproveModal}
          title="Approve Auction"
          message="Are you sure you want to approve this auction?"
          onCancel={closeApproveModal}
          onConfirm={handleApproveConfirm}
          loading={actionLoading}
          confirmText="Approve"
          cancelText="Cancel"
          confirmColor="green"
          cancelColor="bg-gray-600 hover:bg-gray-700"
        />
      )}

      {/* Approve Seller Modal */}
      {showSellerApproveModal && (
        <ConfirmModal
          open={showSellerApproveModal}
          title="Approve Seller"
          message={`Are you sure you want to approve ${sellerTarget?.name} as a seller?`}
          onCancel={closeSellerApproveModal}
          onConfirm={handleSellerApproveConfirm}
          loading={actionLoading}
          confirmText="Approve"
          cancelText="Cancel"
          confirmColor="green"
          cancelColor="bg-gray-600 hover:bg-gray-700"
        />
      )}

      {/* Reject Seller Modal */}
      {showSellerRejectModal && (
        <ConfirmModal
          open={showSellerRejectModal}
          title="Reject Seller"
          message={
            <div>
              <div className="mb-4">Are you sure you want to reject <span className="font-semibold text-white">{sellerTarget?.name}</span> as a seller?</div>
              <label className="block text-gray-300 text-sm mb-2">Reason for rejection:</label>
              <textarea
                value={sellerRejectionReason}
                onChange={e => setSellerRejectionReason(e.target.value)}
                className="w-full bg-[#181c2f] border border-white/10 rounded px-3 py-2 text-white placeholder-gray-400 resize-none mb-2"
                rows="3"
                placeholder="Enter reason for rejection..."
              />
            </div>
          }
          onCancel={closeSellerRejectModal}
          onConfirm={handleSellerRejectConfirm}
          loading={actionLoading}
          confirmDisabled={!sellerRejectionReason.trim() || actionLoading}
          confirmText="Reject"
          cancelText="Cancel"
          confirmColor="red"
          confirmClassName={!sellerRejectionReason.trim() || actionLoading ? 'opacity-50 cursor-not-allowed' : ''}
        />
      )}

      {/* Reject Auction Modal */}
      {showRejectModal && (
        <ConfirmModal
          open={showRejectModal}
          title="Reject Auction"
          message={
            <div>
              <div className="mb-4">Are you sure you want to reject this auction?</div>
              <label className="block text-gray-300 text-sm mb-2">Reason for rejection:</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full bg-[#181c2f] border border-white/10 rounded px-3 py-2 text-white placeholder-gray-400 resize-none mb-2"
                rows="3"
                placeholder="Enter reason for rejection..."
              />
            </div>
          }
          onCancel={closeRejectModal}
          onConfirm={handleRejectConfirm}
          loading={actionLoading}
          confirmDisabled={!rejectionReason.trim() || actionLoading}
          confirmText="Reject"
          cancelText="Cancel"
          confirmColor="red"
          confirmClassName={!rejectionReason.trim() || actionLoading ? 'opacity-50 cursor-not-allowed' : ''}
        />
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
          duration={toast.duration}
        />
      )}
    </div>
  );
}

export default AdminDashboard; 
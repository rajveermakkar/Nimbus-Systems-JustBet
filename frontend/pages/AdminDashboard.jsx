import React, { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "../src/context/UserContext";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import axios from "axios";
import Toast from "../src/components/Toast";
import UserDetailsPanel from '../src/components/UserDetailsPanel';
import AuctionDetailsPanel from '../src/components/auctions/AuctionDetailsPanel';
import LoadingSpinner from '../src/components/LoadingSpinner';
import ConfirmModal from '../src/components/ConfirmModal';

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
    if (pathname.startsWith('/admin/manage-users')) return 'manage-users';
    if (pathname.startsWith('/admin/manage-auctions')) return 'manage-auctions';
    if (pathname.startsWith('/admin/approve-users')) return 'approve-users';
    if (pathname.startsWith('/admin/earnings')) return 'earnings';
    if (pathname.startsWith('/admin/db-health')) return 'db-health';
    return 'dashboard';
  };
  const section = getSectionFromPath(location.pathname);

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
    { key: "earnings", label: "Earnings", icon: "fa-dollar-sign" },
    { key: "db-health", label: "DB Health", icon: "fa-database" },
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
    baseURL: import.meta.env.VITE_BACKEND_URL + "/api",
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
  const handleSellerApproval = async (userId, approved) => {
    setActionLoading(true); setActionError(null);
    try {
      await api.patch(`/admin/sellers/${userId}/approve`, { approved });
      
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
      if (approved) {
        await api.patch(`/admin/auctions/settled/${id}/approve`);
      } else {
        await api.patch(`/admin/auctions/settled/${id}/reject`, { rejectionReason: reason });
      }
      
      // Immediately update local state instead of refetching
      setPendingSettledAuctions(prev => prev.filter(auction => auction.id !== id));
      
      // Also update all auctions if we're in manage-auctions section
      if (section === 'manage-auctions') {
        setAllSettledAuctions(prev => prev.map(auction => 
          auction.id === id 
            ? { ...auction, status: approved ? 'approved' : 'rejected' }
            : auction
        ));
      }
      
      // Show success message
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
      if (approved) {
        await api.patch(`/admin/auctions/live/${id}/approve`);
      } else {
        await api.patch(`/admin/auctions/live/${id}/reject`, { rejectionReason: reason });
      }
      
      // Immediately update local state instead of refetching
      setPendingLiveAuctions(prev => prev.filter(auction => auction.id !== id));
      
      // Also update all auctions if we're in manage-auctions section
      if (section === 'manage-auctions') {
        setAllLiveAuctions(prev => prev.map(auction => 
          auction.id === id 
            ? { ...auction, status: approved ? 'approved' : 'rejected' }
            : auction
        ));
      }
      
      // Show success message
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
    if (section === "db-health") fetchDbHealth();
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
    await handleSellerApproval(sellerTarget.id, false);
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
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <span className="text-gray-400 text-sm">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
                  <i className="fa-solid fa-calendar-day text-2xl text-green-400"></i>
                  <div className="text-2xl font-bold text-white">{auctionsToday}</div>
                  <div className="text-xs text-gray-300 font-semibold">Auctions Today</div>
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
              <div onClick={() => { navigate('/admin/manage-auctions'); setAuctionFilter('all'); }} className="rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition bg-purple-900/60 text-purple-300 backdrop-blur-md">
                <i className="fa-solid fa-gavel text-xl mb-2"></i>
                <div className="font-semibold text-sm">Manage Auctions</div>
              </div>
              <div onClick={() => { navigate('/admin/manage-auctions'); setAuctionFilter('pending'); }} className="rounded-2xl shadow border border-white/10 flex flex-col items-center justify-center py-4 px-4 gap-2 cursor-pointer hover:scale-105 transition bg-green-900/60 text-green-300 backdrop-blur-md">
                <i className="fa-solid fa-check-circle text-xl mb-2"></i>
                <div className="font-semibold text-sm">Approve Auctions</div>
              </div>
                </div>
            {/* Top Sellers Leaderboard */}
            <div className="bg-[#23235b]/80 rounded-2xl shadow border border-white/10 p-4 flex flex-col gap-2 mt-4">
              <h2 className="text-lg font-bold text-white mb-2">Top Sellers (Most Closed/Approved Listings)</h2>
              {topSellers.length === 0 ? (
                <div className="text-gray-400">No sellers found.</div>
              ) : (
                <ol className="list-decimal ml-6">
                  {topSellers.map((seller, idx) => (
                    <li key={seller.email || seller.id} className="flex items-center gap-2 text-white">
                      <span className="font-semibold">{seller.first_name} {seller.last_name}</span>
                      <span className="text-xs text-gray-400">({seller.count} listings)</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        );
      case "manage-users":
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 h-full min-h-0 overflow-auto">
              <table className="table-fixed w-full bg-transparent rounded-xl overflow-hidden">
                <thead>
                  <tr>
                    <th className="w-1/4 text-left px-4 py-2 font-bold text-base">Name</th>
                    <th className="w-1/3 text-left px-4 py-2 font-bold text-base">Email</th>
                    <th className="w-1/6 text-center px-4 py-2 font-bold text-base">Role</th>
                    <th className="w-24 text-center px-4 py-2 font-bold text-base">Actions</th>
                  </tr>
                </thead>
                <tbody className="h-full min-h-0 text-left text-sm">
                  {allUsers.length === 0 ? <tr><td colSpan={4} className="text-center text-gray-400 p-4">No users found</td></tr> : allUsers.map(user => (
                    <tr key={user.id} className="border-b border-white/10">
                      <td className="p-2 font-semibold text-white align-middle text-left">{user.first_name} {user.last_name}</td>
                      <td className="p-2 align-middle text-left">{user.email}</td>
                      <td className="p-2 align-middle text-center">{user.role}</td>
                      <td className="p-2 align-middle text-center">
                        <div className="flex justify-center">
                          <button onClick={() => openUserDetails(user)} className="bg-[#0077b6] hover:bg-[#005f8a] text-white px-3 py-1 rounded text-xs">View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "approve-users":
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 h-full min-h-0 overflow-auto">
              <table className="table-fixed w-full bg-transparent rounded-xl overflow-hidden">
                <thead>
                  <tr>
                    <th className="w-1/4 text-left px-4 py-2 font-bold text-base">Name</th>
                    <th className="w-1/3 text-left px-4 py-2 font-bold text-base">Email</th>
                    <th className="w-1/6 text-left px-4 py-2 font-bold text-base">Business</th>
                    <th className="w-32 text-center px-4 py-2 font-bold text-base">Actions</th>
                  </tr>
                </thead>
                <tbody className="h-full min-h-0 text-left text-sm">
                  {pendingSellers.length === 0 ? <tr><td colSpan={4} className="text-center text-gray-400 p-4">No pending sellers</td></tr> : pendingSellers.map(seller => (
                    <tr key={seller.id} className="border-b border-white/10">
                      <td className="p-2 text-left"><a href="#" onClick={e => { e.preventDefault(); openUserDetails(seller); }}>{seller.first_name} {seller.last_name}</a></td>
                      <td className="p-2 text-left">{seller.email}</td>
                      <td className="p-2 text-left">{seller.business_name}</td>
                      <td className="p-2 text-center">
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
            {actionError && <div className="text-red-400 mt-2">{actionError}</div>}
          </div>
        );
      case "manage-auctions":
        const filteredAuctions = getFilteredAuctions([
          ...allSettledAuctions.map(a => ({ ...a, type: 'settled' })),
          ...allLiveAuctions.map(a => ({ ...a, type: 'live' }))
        ]);
        return (
          <div className="flex flex-col flex-1 h-full min-h-0">
            <div className="flex-1 h-full min-h-0 overflow-auto">
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
              <table className="table-fixed w-full bg-transparent rounded-xl overflow-hidden text-sm">
                <thead>
                  <tr>
                    <th className="w-1/9 text-left px-3 py-1 font-bold">Title</th>
                    <th className="w-1/8 text-center px-3 py-1 font-bold ">Type</th>
                    <th className="w-1/8 text-center px-3 py-1 font-bold">Status</th>
                    <th className="w-26 text-center px-3 py-1 font-bold">Seller</th>

                    <th className="w-1/8 text-center px-6 py-3 font-bold text-lg">Start</th>
                    <th className="w-1/8 text-center px-6 py-3 font-bold text-lg">End</th>
                    <th className="w-32 text-center px-6 py-3 font-bold text-lg">Actions</th>
                  </tr>
                </thead>
                <tbody className="h-full min-h-0 text-sm">
                  {filteredAuctions.length === 0 ? <tr><td colSpan={7} className="text-center text-gray-400 p-4">No auctions found</td></tr> : filteredAuctions.map(auction => (
                    <tr key={auction.id} className="border-b border-white/10">
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
          </div>
        );
      case "earnings":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Earnings</h2>
            <div className="text-gray-400">Coming Soon</div>
          </div>
        );
      case "db-health":
        return (
          <div className="h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Database Health Monitor</h2>
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

                {/* Refresh Button */}
                <div className="flex justify-center">
                  <button
                    onClick={fetchDbHealth}
                    disabled={dbHealthLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition"
                  >
                    <i className="fa-solid fa-sync-alt"></i>
                    {dbHealthLoading ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">No database health data available.</div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Add at the top of AdminDashboard (after other refs):
  const lastPathRef = useRef(location.pathname);
  const fromUserRef = useRef(null);

  return (
    <div className={`w-full bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] flex items-center justify-center py-6 px-2 transition-opacity duration-300 ${isLoggingOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className="w-full max-w-7xl flex overflow-hidden rounded-2xl min-h-[92vh]" style={{height: mainHeight ? mainHeight : 'auto'}}>
        {/* Sidebar */}
        <aside className="w-64 min-h-full bg-[#181c2f]/80 backdrop-blur-md border-r border-white/10 flex flex-col py-8 px-6 text-white rounded-l-2xl" style={{height: mainHeight ? mainHeight : 'auto'}}>
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
        <main ref={mainRef} className="flex-1 min-h-full bg-[#181c2f]/40 backdrop-blur-md rounded-r-2xl p-6 flex flex-col gap-4 text-white rounded-r-2xl">
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
        />
      )}
    </div>
  );
}

export default AdminDashboard; 
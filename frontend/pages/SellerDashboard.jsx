import React, { useContext, useState, useEffect, useMemo, useRef } from "react";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";
import { useNavigate, useLocation } from "react-router-dom";
import Toast from "../src/components/Toast";
import { getStatusBadgeClass } from '../src/utils/statusBadgeUtils';
import ConfirmModal from "../src/components/ConfirmModal";
import apiService from "../src/services/apiService";
import { walletService } from '../src/services/walletService';

// Tooltip component for rejection reason
function Tooltip({ children, text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <span 
        onClick={() => setShow(!show)}
        className="cursor-pointer"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShow(!show);
          }
        }}
      >
        {children}
      </span>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShow(false)}>
          <div className="bg-red-500/40 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-red-500/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-red-400">Rejection Reason</h3>
              <button 
                onClick={() => setShow(false)}
                className="text-white/70 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <p className="text-white/90 text-sm whitespace-pre-line">{text}</p>
          </div>
        </div>
      )}
    </span>
  );
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ORDER_STATUSES = [
  { value: 'under_process', label: 'Under Process' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' }
];

function SellerDashboard() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [analytics, setAnalytics] = useState(null);
  const [auctionResults, setAuctionResults] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [section, setSection] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderToast, setOrderToast] = useState({ show: false, message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ 
    open: false, 
    orderId: null, 
    status: null, 
    title: '', 
    message: '' 
  });
  const [orderFilter, setOrderFilter] = useState('all');
  // Stripe Connect onboarding/payout state
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(false);
  const [stripeStatusError, setStripeStatusError] = useState('');
  const [onboardingUrl, setOnboardingUrl] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  // Add state for seller earnings
  const [sellerEarnings, setSellerEarnings] = useState(null);
  const tabRefs = useRef([]);
  const mobileTabRefs = useRef([]);
  const [search, setSearch] = useState('');
  const searchTimeout = useRef();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD'
    }).format(price);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/api/seller/analytics');
      setAnalytics(data.analytics);
    } catch (err) {
      setError(err.message || "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  // Fetch wallet balance and transactions
  const fetchWalletInfo = async () => {
    try {
      setWalletLoading(true);
      const [balanceData, transactionsData] = await Promise.all([
        apiService.get('/api/wallet/balance'),
        apiService.get('/api/wallet/transactions')
      ]);
      setWalletBalance(balanceData.balance);
      setWalletTransactions(transactionsData.transactions || []);
    } catch (err) {
      console.error('Failed to fetch wallet info:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  // Fetch auction results
  const fetchAuctionResults = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/api/seller/auction-results');
      // Standardize each result object
      const mappedResults = (data.results || []).map(result => {
        // Standardize id and type
        const id = result.id || result.auction_id;
        const type = result.type || result.auction_type || (result.max_participants ? 'live' : 'settled');
        // Standardize result_type
        let result_type = result.result_type;
        if (!result_type) {
          if (result.status === 'won' || (result.status === 'closed' && result.winner_id)) {
            result_type = 'sold';
          } else if (result.status === 'no_bids' || (!result.winner_id && (!result.final_bid || result.final_bid === 0))) {
            result_type = 'no_bids';
          } else if (result.status === 'reserve_not_met') {
            result_type = 'reserve_not_met';
          } else {
            result_type = result.status;
          }
        }
        // Standardize winner_name
        let winner_name = result.winner_name;
        if (!winner_name && result.winner_first_name && result.winner_last_name) {
          winner_name = `${result.winner_first_name} ${result.winner_last_name}`;
        }
        // Standardize final_bid
        const final_bid = result.final_bid || result.current_highest_bid || result.starting_price || 0;
        return {
          ...result,
          id,
          type,
          result_type,
          winner_name,
          final_bid,
        };
      });
      setAuctionResults(mappedResults);
    } catch (err) {
      setError(err.message || "Failed to fetch auction results");
    } finally {
      setLoading(false);
    }
  };

  // Fetch listings - simple function
  const fetchListings = async (isPolling = false) => {
    try {
      if (!isPolling) {
        setLoading(true);
      }
      // Fetch both live and settled auctions
      const liveData = await apiService.get('/api/seller/auctions/live');
      const settledData = await apiService.get('/api/seller/auctions/settled');
      // Add auction_type to each listing
      const liveListings = (liveData.auctions || []).map(a => ({ ...a, auction_type: 'live' }));
      const settledListings = (settledData.auctions || []).map(a => ({ ...a, auction_type: 'settled' }));
      const allListings = [...liveListings, ...settledListings];
      setListings(allListings);
    } catch (err) {
      if (!isPolling) {
        setError(err.message || "Failed to fetch listings");
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchAnalytics();
      fetchWalletInfo();
    } else if (activeTab === 'results') {
      fetchAuctionResults();
    } else if (activeTab === 'listings') {
      fetchListings(false); // Initial load, not polling
    } else if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'settings') {
      fetchStripeStatus();
      fetchSellerEarnings();
    }
  }, [activeTab]);

  // Simple polling for listings - just fetch data every 5 seconds
  useEffect(() => {
    if (!user || !user.isApproved || activeTab !== 'listings') return;

    // Initial fetch
    fetchListings(false);

    // Simple polling every 5 seconds
    const interval = setInterval(() => {
      if (activeTab === 'listings') {
        fetchListings(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, activeTab]);

  useEffect(() => {
    if (section === 'orders') fetchOrders();
  }, [section]);

  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const data = await apiService.get('/api/orders/seller');
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrderToast({ show: true, message: err.message || 'Failed to load orders', type: 'error' });
    } finally {
      setOrdersLoading(false);
    }
  }

  function showStatusConfirmation(orderId, status) {
    const statusLabels = {
      'under_process': 'Under Process',
      'shipped': 'Shipped', 
      'delivered': 'Delivered'
    };
    
    setConfirmModal({
      open: true,
      orderId,
      status,
      title: `Mark Order as ${statusLabels[status]}?`,
      message: `Are you sure you want to mark this order as ${statusLabels[status].toLowerCase()}?`
    });
  }

  async function updateOrderStatus(orderId, status) {
    try {
      await apiService.patch(`/api/orders/${orderId}/status`, { status });
      setOrderToast({ show: true, message: 'Order status updated', type: 'success' });
      fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      setOrderToast({ show: true, message: err.message || 'Failed to update status', type: 'error' });
    }
  }

  function handleConfirmStatusUpdate() {
    if (confirmModal.orderId && confirmModal.status) {
      updateOrderStatus(confirmModal.orderId, confirmModal.status);
    }
    setConfirmModal({ open: false, orderId: null, status: null, title: '', message: '' });
  }

  function handleCancelStatusUpdate() {
    setConfirmModal({ open: false, orderId: null, status: null, title: '', message: '' });
  }

  // Filter orders based on selected filter
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter(order => order.status === orderFilter);
  }, [orders, orderFilter]);

  const handleToastClose = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

  const handleViewAuction = (result) => {
    // Use auction_id if present, otherwise fallback to id
    const auctionType = result.type;
    const auctionId = result.auction_id || result.id;
    const path = `/seller/completed-auction/${auctionType}/${auctionId}`;
    navigate(path);
  };

  // Update tab and URL when user clicks a tab
  const handleTabChange = (tabId, idx, isMobile = false) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(location.search);
    params.set('tab', tabId);
    navigate({ search: params.toString() });
    // Only scroll into view for mobile
    if (isMobile && mobileTabRefs.current[idx]) {
      mobileTabRefs.current[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // Fetch Stripe Connect status on mount (if seller)
  useEffect(() => {
    if (user && user.role === 'seller') {
      fetchStripeStatus();
    }
  }, [user]);

  async function fetchStripeStatus() {
    setStripeStatusLoading(true);
    setStripeStatusError('');
    try {
      const res = await walletService.getStripeConnectStatus();
      setStripeStatus(res);
    } catch (err) {
      setStripeStatusError(err?.response?.data?.error || err.message || 'Failed to fetch payout status');
      setStripeStatus(null);
    }
    setStripeStatusLoading(false);
  }

  // Start onboarding and get link
  async function handleStartOnboarding() {
    setOnboardingLoading(true);
    setStripeStatusError('');
    try {
      const res = await walletService.startStripeOnboarding();
      setOnboardingUrl(res.url);
      // Auto-redirect to Stripe onboarding as soon as link is received
      window.location.href = res.url;
    } catch (err) {
      setStripeStatusError(err?.response?.data?.error || err.message || 'Failed to start onboarding');
    }
    setOnboardingLoading(false);
  }

  // Request payout
  async function handlePayout() {
    setPayoutLoading(true);
    setPayoutError('');
    setPayoutSuccess('');
    try {
      await walletService.createStripePayout(Number(payoutAmount));
      setPayoutSuccess('Payout requested successfully!');
      setPayoutAmount('');
      // Refresh seller earnings data
      await fetchSellerEarnings();
      // Show success toast
      setToast({ show: true, message: 'Payout requested successfully! Your funds will be transferred to your bank account.', type: 'success' });
    } catch (err) {
      setPayoutError(err?.response?.data?.error || err.message || 'Failed to request payout');
      // Show error toast
      setToast({ show: true, message: err?.response?.data?.error || err.message || 'Failed to request payout', type: 'error' });
    }
    setPayoutLoading(false);
  }

  // Fetch seller earnings
  const fetchSellerEarnings = async () => {
    try {
      const data = await apiService.get('/api/wallet/seller-earnings');
      setSellerEarnings(data.earnings);
    } catch (err) {
      setSellerEarnings(0);
    }
  };

  // Debounce search input
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  // Helper function for LIVE_NOW
  function isLiveNow(listing) {
    return (
      listing.status === 'approved' &&
      listing.start_time && new Date(listing.start_time) <= new Date() &&
      listing.end_time && new Date(listing.end_time) > new Date()
    );
  }

  if (!user || !user.isApproved) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Seller Dashboard</h1>
        <p className="mb-4">Welcome, {user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Seller"}!</p>
          <div className="text-yellow-300 font-semibold mb-4 flex items-center justify-center gap-2">
            <i className="fas fa-hourglass-half"></i>
            Your seller account is pending approval.
          </div>
        </div>
      </div>
    );
  }

  const filteredListings = listings.filter(listing =>
    listing.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    listing.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
          duration={3000}
        />
      )}
      
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
        confirmText="Update Status"
        cancelText="Cancel"
        confirmColor="green"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-6">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">🛒 Seller Dashboard</h1>
            <p className="text-gray-300">Welcome back, {user?.firstName} {user?.lastName}!</p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-4 justify-center mb-8">
            <Button onClick={() => navigate("/seller/create-listing")}>
              <i className="fa-solid fa-plus mr-2"></i>
              Create Auction
            </Button>
          </div>

          {/* Tabs */}
          {/* Responsive mini-navbar for mobile/tablet, original for desktop */}
          <div className="mb-6">
            {/* Mobile/Tablet: horizontal scrollable mini-navbar */}
            <div className="flex md:hidden gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
              {[
                { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-line' },
                { id: 'results', label: 'Auction Results', icon: 'fa-solid fa-trophy' },
                { id: 'listings', label: 'My Listings', icon: 'fa-solid fa-list' },
                { id: 'orders', label: 'Manage Orders', icon: 'fa-solid fa-box' },
                { id: 'settings', label: 'Seller Management', icon: 'fa-solid fa-user-cog' }
              ].map((tab, idx) => (
                <button
                  key={tab.id}
                  ref={el => mobileTabRefs.current[idx] = el}
                  onClick={() => handleTabChange(tab.id, idx, true)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 text-s font-semibold transition-colors min-w-[80px] ${
                    activeTab === tab.id 
                      ? 'bg-white/10 bg-purple-500/30 text-purple-300 border border-purple-400/40 shadow-[0_0_12px_#a78bfa66] backdrop-blur-md' 
                      : 'text-gray-300 hover:text-purple'
                  }`}
                >
                  <i className={tab.icon}></i>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            {/* Desktop: original tab bar (no refs/scrollIntoView needed) */}
            <div className="hidden md:flex justify-center">
              <div className="bg-white/10 rounded-lg p-1 flex">
                {[
                  { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-line' },
                  { id: 'results', label: 'Auction Results', icon: 'fa-solid fa-trophy' },
                  { id: 'listings', label: 'My Listings', icon: 'fa-solid fa-list' },
                  { id: 'orders', label: 'Manage Orders', icon: 'fa-solid fa-box' },
                  { id: 'settings', label: 'Seller Management', icon: 'fa-solid fa-user-cog' }
                ].map((tab, idx) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id, idx, false)}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-white/10 bg-purple-500/30 text-purple-300 border border-purple-400/40 shadow-[0_0_12px_#a78bfa66] backdrop-blur-md ' 
                        : 'text-gray-300 hover:text-purple'
                    }`}
                  >
                    <i className={tab.icon}></i>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white/10 rounded-lg p-4 sm:p-6 border border-white/20 w-full">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-sm">Loading...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-center">
                <p className="text-red-400">{error}</p>
                <Button onClick={() => handleTabChange(activeTab, tabRefs.current.findIndex(el => el.textContent.includes(activeTab)))} className="mt-2">
                  Try Again
                </Button>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && analytics && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold mb-4">📊 Analytics Overview</h2>
                
                {/* Wallet Overview */}
                <div className="bg-white/5 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-green-400">💰 Seller Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">{formatPrice(walletBalance)}</div>
                      <div className="text-sm text-gray-300">Total Balance</div>
                    </div>
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">{analytics ? formatPrice(analytics.overall.totalRevenue) : '...'}</div>
                      <div className="text-sm text-gray-300">Total Earned</div>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-400">{analytics.overall.totalAuctions}</div>
                      <div className="text-sm text-gray-300">Total Auctions</div>
                    </div>
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">{analytics.overall.totalCompleted}</div>
                      <div className="text-sm text-gray-300">Completed Auctions</div>
                    </div>
                  </div>
                </div>


                {/* Live vs Settled */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 text-red-400">🔥 Live Auctions</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-semibold">{analytics.live.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active:</span>
                        <span className="font-semibold text-green-400">{analytics.live.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Completed:</span>
                        <span className="font-semibold">{analytics.live.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>With Bids:</span>
                        <span className="font-semibold">{analytics.live.withBids}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span className="font-semibold text-green-400">{formatPrice(analytics.live.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Sale:</span>
                        <span className="font-semibold">{formatPrice(analytics.live.avgSalePrice)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 text-blue-400">📋 Settled Auctions</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-semibold">{analytics.settled.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active:</span>
                        <span className="font-semibold text-green-400">{analytics.settled.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Completed:</span>
                        <span className="font-semibold">{analytics.settled.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>With Bids:</span>
                        <span className="font-semibold">{analytics.settled.withBids}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span className="font-semibold text-green-400">{formatPrice(analytics.settled.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Sale:</span>
                        <span className="font-semibold">{formatPrice(analytics.settled.avgSalePrice)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auction Results Tab */}
            {activeTab === 'results' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">🏆 Auction Results</h2>
                
                {auctionResults.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🎯</div>
                    <h3 className="text-xl font-semibold mb-2">No Completed Auctions</h3>
                    <p className="text-gray-400">You haven't completed any auctions yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {auctionResults.map((result, idx) => {
                      const isSold = result.result_type === 'sold' || (result.status === 'closed' && result.winner_id);
                      const isNoBids = result.result_type === 'no_bids' || (!result.winner_id && !isSold);
                      // Use a more unique key
                      const key = `${result.type || result.auction_type || 'settled'}-${result.id || result.auction_id}-${idx}`;
                      return (
                        <div 
                          key={key}
                          className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors relative"
                        >
                          {/* Auction Type Badge */}
                          <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[11px] font-bold border shadow z-10
                            ${result.type === 'settled' ? 'bg-blue-500/20 text-blue-400 border-blue-400/30' : 'bg-red-500/20 text-red-400 border-red-400/30'}`}
                          >
                            {result.type === 'settled' ? 'Settled' : 'Live'}
                          </span>
                          {/* Auction Image */}
                          <div className="mb-3 h-32 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                            {result.image_url ? (
                              <img
                                src={result.image_url}
                                alt={result.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <i className="fa-solid fa-image text-gray-400 text-2xl"></i>
                            )}
                          </div>
                          {/* Auction Info */}
                          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{result.title}</h3>
                          <div className="space-y-1 text-sm mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(result.status || result.result_type)}`}>
                                {isSold ? 'Sold' : isNoBids ? 'No Bids' : result.status === 'reserve_not_met' ? 'Reserve Not Met' : result.status}
                              </span>
                            </div>
                            <p className="text-gray-400">Ended: {formatDate(result.end_time)}</p>
                          </div>
                          {/* Result Info */}
                          {isSold ? (
                            <div className="bg-green-900/20 border border-green-500/30 rounded p-3 mb-3">
                              <div className="text-center">
                                <p className="text-sm text-gray-300">Sold for</p>
                                <p className="text-lg font-bold text-green-400">{formatPrice(result.final_bid)}</p>
                                <p className="text-xs text-gray-400">
                                  Winner: {result.winner_name ? result.winner_name : (result.winner_first_name && result.winner_last_name ? `${result.winner_first_name} ${result.winner_last_name}` : 'No Winner')}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mb-3">
                              <div className="text-center">
                                <p className="text-sm text-gray-300">No bids placed</p>
                                <p className="text-xs text-gray-400">Starting: {formatPrice(result.starting_price)}</p>
                                <p className="text-xs text-gray-400 mt-1">Winner: No Winner</p>
                              </div>
                            </div>
                          )}
                          {/* Action Button */}
                          <Button
                            onClick={() => handleViewAuction(result)}
                            className="w-full text-sm"
                          >
                            View Details
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Listings Tab */}
            {activeTab === 'listings' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">📋 My Listings</h2>
                
                {listings.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">No Listings Yet</h3>
                    <p className="text-gray-400 mb-4">Create your first auction to get started!</p>
                    <Button onClick={() => navigate("/seller/create-listing")}>
                      Create Your First Auction
                    </Button>
                  </div>
                ) : (
                  <div className="mb-4 max-w-md mx-auto flex items-center gap-2">
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search your listings..."
                      aria-label="Search listings"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none bg-white/10 text-white placeholder-gray-400 transition"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="ml-2 px-2 py-1 rounded text-gray-300 hover:text-white focus:outline-none"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}

                {filteredListings.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">No Listings Found</h3>
                    <p className="text-gray-400">No listings match your search criteria.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredListings
                      .filter(listing => listing.status !== 'closed')
                      .map((listing, idx) => (
                        <div key={`${listing.auction_type || 'listing'}-${listing.id}-${idx}`} className="bg-white/5 rounded-lg p-4 border border-white/20 relative">
                          {/* LIVE_NOW badge - now top left */}
                          {isLiveNow(listing) && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
                              LIVE_NOW
                            </span>
                          )}
                          <h3 className="font-semibold text-lg mb-2">{listing.title}</h3>
                          <img 
                            src={listing.image_url} 
                            alt={listing.title} 
                            className="w-full h-32 object-cover rounded mb-3" 
                          />
                          <div className="text-xs text-gray-300 space-y-1 mb-3">
                            <p className="line-clamp-2">{listing.description}</p>
                            <p>Start: {formatDate(listing.start_time)}</p>
                            <p>End: {formatDate(listing.end_time)}</p>
                            <p>Starting Price: {formatPrice(listing.starting_price)}</p>
                            {listing.reserve_price && (
                              <p>Reserve Price: {formatPrice(listing.reserve_price)}</p>
                            )}
                          </div>
                          <div className="text-xs mb-3">
                            <div className="flex items-center gap-2 mb-1">
                              {listing.status === 'rejected' && listing.rejection_reason ? (
                                <Tooltip text={listing.rejection_reason}>
                                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-900/60 text-red-200 border border-red-400/30 cursor-pointer hover:bg-red-700/80 transition">
                                    Rejected
                                  </span>
                                </Tooltip>
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(listing.status || (listing.is_approved ? 'approved' : 'pending'))}`}>
                                  {listing.status === 'won' || (listing.status === 'closed' && listing.winner_id) ? 'Sold' : listing.status === 'no_bids' ? 'No Bids' : listing.status === 'reserve_not_met' ? 'Reserve Not Met' : listing.status}
                                </span>
                              )}
                            </div>
                            {/* Only show winner info for closed auctions with winners */}
                            {listing.status === 'closed' && listing.winner && (
                              <div className="text-xs text-gray-400 mt-1">
                                <span className="text-green-400">Winner: </span>
                                {listing.winner.first_name && listing.winner.last_name ? 
                                  `${listing.winner.first_name} ${listing.winner.last_name}` : 
                                  'Unknown'
                                }
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => navigate(`/auction/${listing.auction_type}/${listing.id}`)}
                              className="flex-1 text-sm"
                            >
                              View Auction
                            </Button>
                            <Button
                              onClick={() => navigate(`/seller/edit-listing/${listing.id}?type=${listing.auction_type}`)}
                              variant="secondary"
                              className={`flex-1 text-sm ${isLiveNow(listing) ? 'cursor-not-allowed opacity-60' : ''}`}
                              disabled={isLiveNow(listing)}
                            >
                              <i className="fas fa-edit mr-1"></i>
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Manage Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">📦 Manage Orders</h2>
                
                {orderToast.show && (
                  <Toast
                    message={orderToast.message}
                    type={orderToast.type}
                    onClose={() => setOrderToast({ show: false, message: '', type: 'info' })}
                    duration={3000}
                  />
                )}

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-2 mb-6 justify-center">
                  {[
                    { value: 'all', label: 'All Orders', icon: 'fa-solid fa-list' },
                    { value: 'under_process', label: 'Under Process', icon: 'fa-solid fa-clock' },
                    { value: 'shipped', label: 'Shipped', icon: 'fa-solid fa-shipping-fast' },
                    { value: 'delivered', label: 'Delivered', icon: 'fa-solid fa-check-circle' }
                  ].map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => setOrderFilter(filter.value)}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all ${
                        orderFilter === filter.value
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-400/40 shadow-[0_0_12px_#a78bfa66]'
                          : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white border border-white/20'
                      }`}
                    >
                      <i className={filter.icon}></i>
                      {filter.label}
                    </button>
                  ))}
                </div>
                
                {ordersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-sm">Loading orders...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📦</div>
                    <h3 className="text-xl font-semibold mb-2">
                      {orderFilter === 'all' ? 'No Orders Yet' : `No ${orderFilter.replace('_', ' ')} Orders`}
                    </h3>
                    <p className="text-gray-400">
                      {orderFilter === 'all' 
                        ? 'Orders will appear here when buyers claim their winning auctions.'
                        : `No orders with status "${orderFilter.replace('_', ' ')}" found.`
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrders.map((order, idx) => (
                      <div key={`order-${order.id}-${idx}`} className="bg-white/5 rounded-lg p-4 border border-white/20 hover:bg-white/10 transition-colors">
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-box text-blue-400"></i>
                            <span className="text-sm text-gray-400">Order #{order.id.slice(0, 8)}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'under_process' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
                            order.status === 'shipped' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' :
                            order.status === 'delivered' ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
                            'bg-gray-900/30 text-gray-400 border border-gray-500/30'
                          }`}>
                            {ORDER_STATUSES.find(s => s.value === order.status)?.label || order.status}
                          </span>
                        </div>

                        {/* Product Image */}
                        <div className="mb-3 h-32 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                          {order.image_url ? (
                            <img
                              src={order.image_url}
                              alt={order.title || 'Product'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <i className="fa-solid fa-image text-gray-400 text-2xl"></i>
                          )}
                        </div>

                        {/* Auction Info */}
                        <div className="mb-3">
                          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{order.title || `Auction #${order.auction_id.slice(0, 8)}`}</h3>
                          <p className="text-sm text-gray-400 mb-1">
                            Winner: {order.winner_first_name && order.winner_last_name 
                              ? `${order.winner_first_name} ${order.winner_last_name}` 
                              : order.winner_email || `${order.winner_id.slice(0, 8)}...`}
                          </p>
                          <p className="text-xs text-gray-500 mb-1">Created: {formatDate(order.created_at)}</p>
                          {order.final_bid && (
                            <p className="text-xs text-green-400 font-semibold">Final Bid: {formatPrice(order.final_bid)}</p>
                          )}
                        </div>

                        {/* Shipping Address */}
                        <div className="bg-white/5 rounded p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <i className="fa-solid fa-shipping-fast text-green-400"></i>
                            <span className="text-sm font-semibold">Shipping Address</span>
                          </div>
                          <div className="text-xs text-gray-300 space-y-1">
                            <p>{order.shipping_address}</p>
                            <p>{order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}</p>
                            <p>{order.shipping_country}</p>
                          </div>
                        </div>

                        {/* Status Update Buttons */}
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400 mb-2">Update Status:</p>
                          <div className="grid grid-cols-3 gap-2">
                            {ORDER_STATUSES.map(s => {
                              const isCurrentStatus = order.status === s.value;
                              let buttonClass = '';
                              const isDelivered = order.status === 'delivered';
                              if (isCurrentStatus) {
                                switch (s.value) {
                                  case 'under_process':
                                    buttonClass = 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/50 cursor-not-allowed';
                                    break;
                                  case 'shipped':
                                    buttonClass = 'bg-blue-500/30 text-blue-300 border border-blue-400/50 cursor-not-allowed';
                                    break;
                                  case 'delivered':
                                    buttonClass = 'bg-green-500/30 text-green-300 border border-green-400/50 cursor-not-allowed';
                                    break;
                                  default:
                                    buttonClass = 'bg-purple-500/30 text-purple-300 border border-purple-400/50 cursor-not-allowed';
                                }
                              } else {
                                buttonClass = 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white border border-white/20';
                              }
                              return (
                                <button
                                  key={s.value}
                                  onClick={() => !isCurrentStatus && !isDelivered && showStatusConfirmation(order.id, s.value)}
                                  disabled={isCurrentStatus || isDelivered}
                                  className={`px-2 py-1 text-xs rounded transition-all ${buttonClass}`}
                                >
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                          {order.status === 'delivered' && (
                            <div className="text-green-300 text-xs mt-2">Order is delivered. Status cannot be changed.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Seller Management/Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">⚙️ Seller Management</h2>
                <div className="max-w-lg mx-auto bg-white/5 rounded-lg p-6 border border-white/20">
                  {/* Stripe Connect Onboarding Status */}
                  {stripeStatusLoading ? (
                    <div className="text-center py-4">Checking onboarding status...</div>
                  ) : (
                    (!stripeStatus || (stripeStatusError && /no connected account|not found|404/i.test(stripeStatusError))) ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">🔗</div>
                        <div className="text-lg font-semibold mb-2 text-red-400">No Stripe account connected</div>
                        <div className="text-gray-300 mb-4">To receive payouts, you must connect your Stripe account. Click below to create or connect your account.</div>
                        <Button
                          variant="primary"
                          size="default"
                          onClick={async () => {
                            await handleStartOnboarding();
                            if (onboardingUrl) window.open(onboardingUrl, '_blank', 'noopener');
                          }}
                          disabled={onboardingLoading}
                        >
                          {onboardingLoading ? 'Loading...' : 'Create/Connect Stripe Account'}
                        </Button>
                        {stripeStatusError && !/no connected account|not found|404/i.test(stripeStatusError) && (
                          <div className="text-red-400 text-sm mt-4">{stripeStatusError}</div>
                        )}
                      </div>
                    ) : stripeStatusError ? (
                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4 text-center text-red-400">{stripeStatusError}</div>
                    ) : (
                      <>
                        <div className="mb-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${
                            stripeStatus.payouts_enabled ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' :
                            stripeStatus.details_submitted ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
                            'bg-red-900/30 text-red-400 border border-red-500/30'
                          }`}>
                            {stripeStatus.payouts_enabled ? 'Ready for Payouts' :
                              stripeStatus.details_submitted ? 'Pending Verification' :
                              'Onboarding Required'}
                          </span>
                          <div className="text-gray-300 mt-2">
                            {stripeStatus.payouts_enabled ? (
                              <>Your Stripe account is fully onboarded and ready to receive payouts.</>
                            ) : stripeStatus.details_submitted ? (
                              <>Your onboarding is submitted and pending verification by Stripe. You will be notified when payouts are enabled.</>
                            ) : (
                              <>You must complete onboarding to receive payouts. Click below to start or continue onboarding.</>
                            )}
                          </div>
                        </div>
                        {/* Onboarding Button */}
                        {!stripeStatus.payouts_enabled && (
                          <div className="text-center mb-6">
                            <Button
                              variant="primary"
                              size="default"
                              onClick={async () => {
                                if (onboardingUrl) {
                                  window.open(onboardingUrl, '_blank', 'noopener');
                                } else {
                                  await handleStartOnboarding();
                                  if (onboardingUrl) window.open(onboardingUrl, '_blank', 'noopener');
                                }
                              }}
                              disabled={onboardingLoading}
                            >
                              {onboardingLoading ? 'Loading...' : 'Start/Continue Stripe Onboarding'}
                            </Button>
                          </div>
                        )}
                        {/* Payout Form */}
                        {stripeStatus.payouts_enabled && (
                          <div className="mt-8">
                            <h3 className="text-lg font-semibold mb-2 text-green-400">Request Payout</h3>
                            {/* Funds Available to Withdraw */}
                            <div className="mb-4 text-center">
                              <span className="block text-md text-gray-200 font-semibold mb-1">Funds Available to Withdraw:</span>
                              <span className="text-2xl font-bold text-green-300">{walletLoading || sellerEarnings === null ? '...' : formatPrice(sellerEarnings)}</span>
                            </div>
                            <form
                              onSubmit={e => {
                                e.preventDefault();
                                const amount = Number(payoutAmount);
                                const available = Number(sellerEarnings || 0);
                                
                                if (!payoutAmount || amount <= 0) {
                                  setPayoutError('Please enter a valid amount');
                                  setToast({ show: true, message: 'Please enter a valid amount', type: 'error' });
                                  return;
                                }
                                
                                if (amount > available) {
                                  setPayoutError(`Amount exceeds available balance (${formatPrice(available)})`);
                                  setToast({ show: true, message: `Amount exceeds available balance (${formatPrice(available)})`, type: 'error' });
                                  return;
                                }
                                
                                handlePayout();
                              }}
                              className="flex flex-col gap-3"
                            >
                              <input
                                type="number"
                                min="1"
                                step="0.01"
                                placeholder="Amount to withdraw (CAD)"
                                value={payoutAmount}
                                onChange={e => setPayoutAmount(e.target.value)}
                                className={`bg-white/10 border rounded px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-400 ${
                                  payoutAmount && Number(payoutAmount) > Number(sellerEarnings || 0)
                                    ? 'border-red-400 focus:ring-red-400'
                                    : 'border-white/20 focus:ring-green-400'
                                }`}
                              />
                              <div className="h-6 flex items-center justify-center">
                                {payoutAmount && Number(payoutAmount) > Number(sellerEarnings || 0) && (
                                  <div className="text-red-400 text-sm text-center">
                                    Amount exceeds available balance ({formatPrice(sellerEarnings || 0)})
                                  </div>
                                )}
                              </div>
                              <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                className="w-full"
                                disabled={payoutLoading || !payoutAmount || Number(payoutAmount) <= 0 || Number(payoutAmount) > Number(sellerEarnings || 0)}
                              >
                                {payoutLoading ? 'Processing...' : 'Request Payout'}
                              </Button>
                              <div className="flex items-center justify-center mt-2">
                                <Tooltip text={
                                  'When you withdraw money, you may see several smaller transactions instead of one big one. This is normal and just means your withdrawal is being completed in parts. The total will always match what you requested to withdraw.'
                                }>
                                  <span className="text-xs text-gray-400 underline cursor-pointer ml-2">Why multiple transactions?</span>
                                </Tooltip>
                              </div>
                              {/* Improved error/success display */}
                              {payoutError && (
                                <div className="text-red-400 text-sm mt-1">
                                  {payoutError.includes('PaymentIntent') || payoutError.includes('stripe')
                                    ? 'Failed to create payout. Please check your Stripe account and try again.'
                                    : payoutError}
                                </div>
                              )}
                              {payoutSuccess && <div className="text-purple-400 text-sm mt-1">{payoutSuccess}</div>}
                            </form>
                          </div>
                        )}
                      </>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
    </>
  );
}

export default SellerDashboard; 
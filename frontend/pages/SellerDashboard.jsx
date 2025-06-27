import React, { useContext, useState, useEffect } from "react";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";
import { useNavigate, useLocation } from "react-router-dom";
import Toast from "../src/components/Toast";

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

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/seller/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch analytics");
      setAnalytics(data);
    } catch (err) {
      setError(err.message || "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  // Fetch auction results
  const fetchAuctionResults = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/seller/auction-results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch auction results");
      // Map backend status to frontend result_type
      const mappedResults = (data.results || []).map(result => ({
        ...result,
        result_type:
          (result.status === 'won' || (result.status === 'closed' && result.winner_id))
            ? 'sold'
            : result.status === 'no_bids'
            ? 'no_bids'
            : result.status === 'reserve_not_met'
            ? 'reserve_not_met'
            : result.status
      }));
      setAuctionResults(mappedResults);
    } catch (err) {
      setError(err.message || "Failed to fetch auction results");
    } finally {
      setLoading(false);
    }
  };

  // Fetch listings
  const fetchListings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      // Fetch both live and settled auctions
      const [liveRes, settledRes] = await Promise.all([
        fetch(`${apiUrl}/api/seller/live-auction`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${apiUrl}/api/seller/auctions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      const liveData = await liveRes.json();
      const settledData = await settledRes.json();
      
      if (!liveRes.ok) throw new Error(liveData.message || "Failed to fetch live listings");
      if (!settledRes.ok) throw new Error(settledData.message || "Failed to fetch settled listings");
      
      // Combine and add auction_type field
      const liveListings = liveData.map(auction => ({ ...auction, auction_type: 'live' }));
      const settledListings = settledData.map(auction => ({ ...auction, auction_type: 'settled' }));
      
      setListings([...liveListings, ...settledListings]);
    } catch (err) {
      setError(err.message || "Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (user && user.isApproved) {
      if (activeTab === 'overview') {
        fetchAnalytics();
      } else if (activeTab === 'results') {
        fetchAuctionResults();
      } else if (activeTab === 'listings') {
        fetchListings();
      }
    }
  }, [activeTab, user]);

  const handleToastClose = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

  const handleViewAuction = (result) => {
    const auctionType = result.type || result.auction_type || 'settled';
    const auctionId = result.auction_id;
    const path = `/seller/completed-auction/${auctionType}/${auctionId}`;
    navigate(path);
  };

  // Update tab and URL when user clicks a tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(location.search);
    params.set('tab', tabId);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

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
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 rounded-lg p-1 flex">
              {[
                { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-line' },
                { id: 'results', label: 'Auction Results', icon: 'fa-solid fa-trophy' },
                { id: 'listings', label: 'My Listings', icon: 'fa-solid fa-list' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
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

          {/* Content */}
          <div className="bg-white/10 rounded-lg p-6">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-sm">Loading...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-center">
                <p className="text-red-400">{error}</p>
                <Button onClick={() => handleTabChange(activeTab)} className="mt-2">
                  Try Again
                </Button>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && analytics && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold mb-4">📊 Analytics Overview</h2>
                
                {/* Overall Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{analytics.overall.totalAuctions}</div>
                    <div className="text-sm text-gray-300">Total Auctions</div>
                  </div>
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{formatPrice(analytics.overall.totalRevenue)}</div>
                    <div className="text-sm text-gray-300">Total Revenue</div>
                  </div>
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">{analytics.overall.totalCompleted}</div>
                    <div className="text-sm text-gray-300">Completed Auctions</div>
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
                    {auctionResults.map((result) => (
                      <div 
                        key={`${result.auction_type}-${result.id}`}
                        className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
                      >
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
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              result.auction_type === 'live' 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {result.auction_type}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              result.result_type === 'sold' 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {result.result_type === 'sold' ? 'Sold' : 'No Bids'}
                            </span>
                          </div>
                          <p className="text-gray-400">Ended: {formatDate(result.end_time)}</p>
                        </div>

                        {/* Result Info */}
                        {result.result_type === 'sold' ? (
                          <div className="bg-green-900/20 border border-green-500/30 rounded p-3 mb-3">
                            <div className="text-center">
                              <p className="text-sm text-gray-300">Sold for</p>
                              <p className="text-lg font-bold text-green-400">{formatPrice(result.final_bid)}</p>
                              <p className="text-xs text-gray-400">Winner: {result.winner_name || 'Unknown'}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mb-3">
                            <div className="text-center">
                              <p className="text-sm text-gray-300">No bids placed</p>
                              <p className="text-xs text-gray-400">Starting: {formatPrice(result.starting_price)}</p>
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
                    ))}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listings.map((listing) => (
                      <div key={listing.id} className="bg-white/5 rounded-lg p-4 border border-white/20">
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
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              listing.auction_type === 'live' 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {listing.auction_type}
                            </span>
                            <span>Status: {(listing.is_approved || listing.status === 'approved') ? (
                              <span className="text-green-400">Approved</span>
                            ) : (
                              <span className="text-yellow-300">Pending</span>
                            )}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => navigate(listing.auction_type === 'live' ? `/live-auctions/${listing.id}` : `/auctions/${listing.id}`)}
                            className="flex-1 text-sm"
                          >
                            View Auction
                          </Button>
                          <Button
                            onClick={() => navigate(`/seller/edit-listing/${listing.id}?type=${listing.auction_type}`)}
                            variant="secondary"
                            className="flex-1 text-sm"
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
          </div>
        </div>
    </div>
    </>
  );
}

export default SellerDashboard; 
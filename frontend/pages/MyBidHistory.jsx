import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import apiService from '../src/services/apiService';

// Custom hook for screen size
function useScreenSize() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

function MyBidHistory() {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Pagination settings
  const isMobile = useScreenSize();
  const CARDS_PER_PAGE = 3;
  const [page, setPage] = useState(1);

  // Only calculate pagination after loading is false and bidHistory is loaded
  let totalPages = 1;
  let paginatedBids = bidHistory;
  if (!loading && bidHistory.length > 0 && isMobile) {
    totalPages = Math.ceil(bidHistory.length / CARDS_PER_PAGE);
    paginatedBids = bidHistory.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);
  }

  // Reset page to 1 if bidHistory changes and current page is out of range
  useEffect(() => {
    if (!loading && bidHistory.length > 0 && isMobile) {
      const newTotalPages = Math.ceil(bidHistory.length / CARDS_PER_PAGE);
      if (page > newTotalPages) setPage(1);
    }
    // eslint-disable-next-line
  }, [bidHistory.length, isMobile, loading]);

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD'
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

  // Fetch bid history
  const fetchBidHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiService.get('/api/auth/bid-history');
      setBidHistory(data.bidHistory || []);
    } catch (err) {
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Please log in again to view your bid history.');
      } else {
        setError('Failed to load bid history. Please try again.');
      }
      console.error('Error fetching bid history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBidHistory();
    } else {
      setError('Please log in to view your bid history.');
      setLoading(false);
    }
  }, [user]);

  const handleToastClose = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

  const handleViewAuction = (bid) => {
    if (bid.status === 'closed' || bid.status === 'ended') {
      navigate(`/ended-auction/${bid.auction_id}`, {
        state: { auctionType: bid.auction_type || 'settled', fromMyBids: true }
      });
    } else {
      navigate(`/auction/${bid.auction_type}/${bid.auction_id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading your bid history...</p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 max-w-md mx-auto">
            <i className="fas fa-exclamation-triangle text-red-400 text-3xl mb-4"></i>
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-red-300 mb-4">Please log in to view your bid history.</p>
            <Button onClick={() => navigate('/login')}>
              Go to Login
            </Button>
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
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">📊 My Bid History</h1>
            <p className="text-gray-300">All your bids across auctions</p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-center">
              <p className="text-red-400">{error}</p>
              <Button 
                onClick={fetchBidHistory}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {bidHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-xl font-semibold mb-2">No Bids Yet</h2>
              <p className="text-gray-400 mb-6">You haven't placed any bids yet. Start bidding to see your history!</p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/live-auctions')}>
                  Browse Live Auctions
                </Button>
                <Button onClick={() => navigate('/auctions')}>
                  Browse Settled Auctions
                </Button>
              </div>
            </div>
          ) : (
            <>
            <div className="space-y-4">
              {(!loading && bidHistory.length > 0 ? (isMobile ? paginatedBids : bidHistory) : []).map((bid) => (
                <div 
                  key={`${bid.auction_type}-${bid.id}`}
                  className="bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors"
                >
                  {/* Responsive image position */}
                  <div className={isMobile ? "flex flex-row items-center gap-3" : "flex flex-row items-start gap-4"}>
                    {/* Auction Image */}
                    <div className={
                      isMobile
                        ? "w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                        : "w-20 h-20 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 mr-4"
                    }>
                      {bid.image_url ? (
                        <img
                          src={bid.image_url}
                          alt={bid.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <i className="fa-solid fa-image text-gray-400 text-xl"></i>
                      )}
                    </div>
                    {/* Bid Info */}
                    {isMobile ? (
                      <>
                        <div className="flex-1 min-w-0 w-full text-center flex flex-col justify-center">
                          <div className="flex flex-col items-center mb-1">
                            <h3 className="font-semibold text-base truncate mb-0">{bid.title}</h3>
                            <div className="flex gap-2 mt-1 justify-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                bid.auction_type === 'live' 
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {bid.auction_type}
                              </span>
                              {bid.is_winning_bid && (
                                <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full text-xs font-semibold">
                                  Winning
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-center">
                            <div>
                              <p className="text-gray-400">Seller</p>
                              <p className="text-white truncate">{bid.seller_name}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Bid</p>
                              <p className="text-green-400 font-semibold">{formatPrice(bid.amount)}</p>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400 text-center">
                            <span>Bid Date: <span className="text-white">{formatDate(bid.created_at)}</span></span>
                          </div>
                          <div className="mt-1 text-xs text-gray-400 text-center">
                            Auction Status:
                            <span className={`font-semibold ${
                              bid.status === 'closed' ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {bid.status === 'closed'
                                ? <>
                                    Ended&nbsp;<span className="ml-1 text-gray-400 font-normal"><br/>End Date: {formatDate(bid.end_time)}</span>
                                  </>
                                : 'Active'}
                            </span>
                          </div>
                        </div>
                        {/* View Auction Button in third column on mobile */}
                        <div className="flex items-center pl-2">
                          <Button
                            onClick={() => handleViewAuction(bid)}
                            className="text-xs px-2 py-1"
                          >
                            View
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 w-full text-left">
                          <div className="flex items-center mb-2">
                            <h3 className="font-semibold text-lg truncate mr-2">{bid.title}</h3>
                            <div className="flex gap-2 ml-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                bid.auction_type === 'live' 
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {bid.auction_type}
                              </span>
                              {bid.is_winning_bid && (
                                <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full text-xs font-semibold">
                                  Winning
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm items-end">
                            <div>
                              <p className="text-gray-400">Seller</p>
                              <p className="text-white">{bid.seller_name}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Bid Amount</p>
                              <p className="text-green-400 font-semibold">{formatPrice(bid.amount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Bid Date</p>
                              <p className="text-white">{formatDate(bid.created_at)}</p>
                            </div>
                            {/* Button column on desktop/tablet */}
                            <div className="flex justify-end items-end h-full">
                              <Button
                                onClick={() => handleViewAuction(bid)}
                                className="text-sm"
                              >
                                View Auction
                              </Button>
                            </div>
                          </div>
                          {/* Auction Status and Ended info */}
                          <div className="mt-3">
                            <p className="text-gray-400 text-sm">
                              Auction Status: <span className={`font-semibold ${
                                bid.status === 'closed' ? 'text-red-400' : 'text-green-400'
                              }`}>
                                {bid.status === 'closed' ? 'Ended' : 'Active'}
                              </span>
                            </p>
                            {bid.status === 'closed' && (
                              <p className="text-gray-400 text-sm">
                                Ended: {formatDate(bid.end_time)}
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Mobile Pagination Controls */}
            {!loading && bidHistory.length > 0 && isMobile && totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button
                  className="px-4 py-2 rounded bg-white/10 text-white disabled:opacity-40"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span className="text-white/80 text-sm">Page {page} of {totalPages}</span>
                <button
                  className="px-4 py-2 rounded bg-white/10 text-white disabled:opacity-40"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
            </>
          )}

          {/* Back Button */}
          <div className="text-center mt-8">
            <Button onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default MyBidHistory; 
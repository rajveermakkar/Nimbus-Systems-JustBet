import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import auctionService from '../src/services/auctionService';
import socketService from '../src/services/socketService';
import BidHistory from '../src/components/auctions/BidHistory';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';

function AuctionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserContext);
  
  const [auction, setAuction] = useState(null);
  const [recentBids, setRecentBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  
  // Live auction specific states
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isLiveAuction, setIsLiveAuction] = useState(false);

  // Determine auction type from URL path
  const isLiveAuctionFromURL = location.pathname.includes('/live-auctions/');

  // Stable onClose function
  const handleToastClose = useCallback(() => {
    setToast({ show: false, message: '', type: 'info' });
  }, []);

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Calculate time remaining
  const getTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    if (diff <= 0) return { ended: true, text: 'Auction Ended' };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return { ended: false, text: `${days}d ${hours}h ${minutes}m` };
    if (hours > 0) return { ended: false, text: `${hours}h ${minutes}m ${seconds}s` };
    return { ended: false, text: `${minutes}m ${seconds}s` };
  };

  // Calculate time remaining for live auctions
  const getLiveTimeRemaining = () => {
    if (!auction) return { ended: true, text: 'Loading...' };
    
    const now = new Date();
    const end = new Date(auction.end_time);
    const endDiff = end - now;
    
    // If auction has passed its end time
    if (endDiff <= 0) {
      return { ended: true, text: 'Auction Ended' };
    }
    
    // If no bids have been placed yet, show time until auction ends
    if (!auction.current_highest_bidder_id || auction.current_highest_bid === auction.starting_price) {
      const days = Math.floor(endDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((endDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((endDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((endDiff % (1000 * 60)) / 1000);
      
      if (days > 0) return { ended: false, text: `Ends in: ${days}d ${hours}h ${minutes}m` };
      if (hours > 0) return { ended: false, text: `Ends in: ${hours}h ${minutes}m ${seconds}s` };
      return { ended: false, text: `Ends in: ${minutes}m ${seconds}s` };
    }
    
    // If bids have been placed, show that countdown is active
    // Note: The actual countdown is managed by the backend
    return { ended: false, text: 'Bidding Active - 2min Timer' };
  };

  // Get auction status (for live auctions)
  const getAuctionStatus = () => {
    if (!auction) return { status: 'loading', color: 'bg-gray-500' };
    
    const now = new Date();
    const start = new Date(auction.start_time);
    const end = new Date(auction.end_time);

    if (now < start) {
      return { status: 'upcoming', color: 'bg-blue-500' };
    } else if (now >= start && now <= end) {
      return { status: 'live', color: 'bg-red-500' };
    } else {
      return { status: 'ended', color: 'bg-gray-500' };
    }
  };

  // Fetch auction data
  const fetchAuction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isLiveAuctionFromURL) {
        // Fetch as live auction
        try {
          const liveData = await auctionService.getLiveAuction(id);
          setAuction(liveData);
          setRecentBids([]); // Live auctions use different bid system
          setIsLiveAuction(true);
        } catch (liveError) {
          throw new Error('Live auction not found');
        }
      } else {
        // Fetch as settled auction
        try {
          const response = await auctionService.getSettledAuction(id);
          setAuction(response.auction);
          setRecentBids(response.recentBids || []);
          setIsLiveAuction(false);
        } catch (settledError) {
          throw new Error('Settled auction not found');
        }
      }
    } catch (err) {
      setError('Failed to load auction. Please try again.');
      console.error('Error fetching auction:', err);
    } finally {
      setLoading(false);
    }
  }, [id, isLiveAuctionFromURL]);

  // Connect to Socket.IO for live auctions
  useEffect(() => {
    if (!isLiveAuction || !user || !user.token) {
      return;
    }

    // Connect to Socket.IO
    const socket = socketService.connect(user.token);
    
    socket.on('connect', () => {
      setIsConnected(true);
      
      // Join the auction room after connection is established
      socketService.joinLiveAuction(id, (data) => {
        if (data.type === 'auction-update') {
          // Merge socket auction state with existing auction data
          setAuction(prevAuction => {
            if (!prevAuction) return data.auction;
            return {
              ...prevAuction,
              current_highest_bid: data.auction.currentBid,
              current_highest_bidder_id: data.auction.currentBidder,
              // Keep other fields from the original auction data
            };
          });
        } else if (data.type === 'bid-update') {
          setRecentBids(prev => [data.bid, ...prev.slice(0, 9)]); // Keep last 10 bids
          setAuction(prevAuction => {
            if (!prevAuction) return data.auction;
            return {
              ...prevAuction,
              current_highest_bid: data.auction.current_highest_bid,
              current_highest_bidder_id: data.auction.current_highest_bidder_id,
            };
          });
        } else if (data.type === 'participant-update') {
          setParticipantCount(data.participantCount);
        } else if (data.type === 'join-error') {
          setError(data.error);
          setToast({ show: true, message: data.error, type: 'error' });
        } else if (data.type === 'auction-end') {
          setPlacingBid(false);
          setBidAmount('');
          setToast({ show: true, message: `Auction ended! ${data.result.message}`, type: 'info' });
          // Update auction status to show it's ended
          setAuction(prevAuction => ({
            ...prevAuction,
            status: 'closed'
          }));
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      socketService.leaveLiveAuction(id);
      socketService.disconnect();
    };
  }, [id, user, isLiveAuction]);

  // Start polling for settled auction updates
  useEffect(() => {
    if (isLiveAuctionFromURL) return; // Don't poll for live auctions
    
    fetchAuction();
    const stopPolling = auctionService.startAuctionPolling(id, (response) => {
      setAuction(response.auction);
      setRecentBids(response.recentBids || []);
    }, 5000); // 5 seconds
    return () => stopPolling();
  }, [id, isLiveAuctionFromURL, fetchAuction]); // Added fetchAuction to dependencies

  // Initial fetch for live auctions
  useEffect(() => {
    if (isLiveAuctionFromURL) {
      fetchAuction();
    }
  }, [id, isLiveAuctionFromURL, fetchAuction]); // Added fetchAuction to dependencies

  // Update countdown timer
  useEffect(() => {
    if (!auction) return;
    const timer = setInterval(() => {
      setAuction(prev => ({ ...prev }));
    }, 1000);
    return () => clearInterval(timer);
  }, [auction]);

  // Handle bid submission
  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!user) {
      setBidError('Please log in to place a bid.');
      return;
    }
    
    if (isLiveAuction && !isConnected) {
      setBidError('Not connected to live auction. Please refresh the page.');
      return;
    }
    
    // Check if auction is closed
    if (auction.status === 'closed') {
      setBidError('This auction has already ended.');
      return;
    }
    
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      setBidError('Please enter a valid bid amount.');
      return;
    }
    if (amount <= validCurrentBid) {
      setBidError(`Bid must be higher than current bid (${formatPrice(validCurrentBid)})`);
      return;
    }
    if (amount < validCurrentBid + validMinIncrement) {
      setBidError(`Minimum bid increment is ${formatPrice(validMinIncrement)}`);
      return;
    }
    
    try {
      setPlacingBid(true);
      setBidError('');
      setBidSuccess('');
      
      if (isLiveAuction) {
        // Place bid through Socket.IO for live auctions
        socketService.placeLiveBid(id, amount, (response) => {
          if (response.success) {
            setBidSuccess('Live bid placed successfully!');
            setBidAmount('');
            setToast({ show: true, message: `Live bid placed successfully! Your bid: ${formatPrice(amount)}`, type: 'success' });
            setTimeout(() => setBidSuccess(''), 3000);
          } else {
            setBidError(response.message || 'Failed to place bid. Please try again.');
            setToast({ show: true, message: response.message || 'Failed to place bid. Please try again.', type: 'error' });
          }
          setPlacingBid(false);
        });
      } else {
        // Place bid through REST API for settled auctions
        await auctionService.placeSettledBid(id, amount);
        setBidSuccess('Bid placed successfully!');
        setBidAmount('');
        fetchAuction();
        setToast({ show: true, message: `Bid placed successfully! Your bid: ${formatPrice(amount)}`, type: 'success' });
        setTimeout(() => setBidSuccess(''), 3000);
        setPlacingBid(false);
      }
    } catch (err) {
      setBidError(err.response?.data?.message || 'Failed to place bid. Please try again.');
      setToast({ show: true, message: err.response?.data?.message || 'Failed to place bid. Please try again.', type: 'error' });
      setPlacingBid(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 max-w-md mx-auto">
            <i className="fas fa-exclamation-triangle text-red-400 text-2xl mb-4"></i>
            <h3 className="text-lg font-semibold mb-2">Auction Not Found</h3>
            <p className="text-red-300 mb-4 text-sm">{error || 'This auction does not exist.'}</p>
            <button 
              onClick={() => navigate(isLiveAuction ? '/live-auctions' : '/auctions')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Back to {isLiveAuction ? 'Live' : ''} Auctions
            </button>
          </div>
        </div>
      </div>
    );
  }

  const timeRemaining = getTimeRemaining(auction.end_time);
  const currentBid = auction.current_highest_bid || auction.starting_price;
  const minBidIncrement = auction.min_bid_increment || 1;

  // Ensure we have valid numbers
  const validCurrentBid = Number(currentBid) || 0;
  const validMinIncrement = 5; // Always $5 minimum increment for both types

  // Get status for live auctions
  const status = isLiveAuction ? getAuctionStatus() : null;
  
  // Get time remaining (different logic for live vs settled auctions)
  const displayTimeRemaining = isLiveAuction ? getLiveTimeRemaining() : timeRemaining;

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
          duration={toast.type === 'success' ? 1500 : 3000}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center py-6">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/Main Content */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Auction Image */}
            <div className="rounded-lg bg-white/10 shadow p-4 flex items-center justify-center min-h-[180px] relative">
              {auction.image_url ? (
                <img
                  src={auction.image_url}
                  alt={auction.title}
                  className="max-h-48 w-auto rounded object-contain"
                />
              ) : (
                <div className="w-full h-36 flex items-center justify-center">
                  <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
                </div>
              )}
              
              {/* Live Indicator */}
              {isLiveAuction && status?.status === 'live' && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white rounded-full font-semibold text-xs animate-pulse">
                  <i className="fas fa-circle mr-1"></i>
                  LIVE
                </div>
              )}
            </div>

            {/* Auction Info Card */}
            <div className="rounded-lg bg-white/10 shadow p-4">
              <h1 className="text-lg font-bold mb-1 text-left mb-2">{auction.title}</h1>
              <div className="mb-1 text-xs text-gray-300 text-left mt-2">
                Seller: <span className="font-semibold text-white">{auction.business_name || `${auction.first_name} ${auction.last_name}` || auction.email || 'Unknown'}</span>
              </div>
              <div className="text-sm text-gray-200 whitespace-pre-line text-left mt-2">
                {auction.description}
              </div>
            </div>

            {/* Bid History Card */}
            <div className="rounded-lg bg-white/10 shadow p-4">
              {isLiveAuction ? (
                // Live bid history
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-left">Live Bid History</h3>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                      <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                  
                  {recentBids.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <i className="fas fa-gavel text-3xl mb-2"></i>
                      <p className="text-sm">No live bids yet</p>
                      <p className="text-xs">Be the first to place a bid!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {recentBids.map((bid, index) => (
                        <div 
                          key={bid.id || index} 
                          className="flex justify-between items-center p-2 rounded bg-white/5"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">
                                {bid.user_name || `User ${bid.user_id?.slice(0, 8)}`}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(bid.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-400">
                              {formatPrice(bid.amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Settled bid history
                <BidHistory auctionId={id} type="settled" bids={recentBids && recentBids.length > 0 ? recentBids : undefined} />
              )}
            </div>
          </div>

          {/* Right/Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Current Bid Card */}
            <div className="rounded-lg bg-white/10 shadow p-4 flex flex-col items-center">
              <div className="text-sm text-gray-300 mb-1">Current Bid</div>
              <div className="text-2xl font-bold text-green-400 mb-1">{formatPrice(validCurrentBid)}</div>
              <div className="text-xs text-gray-400 mb-1">Starting bid: <span className="text-white font-semibold">{formatPrice(auction.starting_price)}</span></div>
              <div className="text-xs text-gray-400 mb-1">Time Remaining:</div>
              <div className="text-base font-semibold" style={{ color: displayTimeRemaining.ended ? '#f87171' : '#facc15' }}>
                {displayTimeRemaining.text}
              </div>
              {isLiveAuction && (
                <div className="text-xs text-gray-400 mt-1">
                  Participants: <span className="text-blue-400 font-semibold">{participantCount}/{auction.max_participants}</span>
                </div>
              )}
            </div>

            {/* Place Your Bid Card */}
            {(!isLiveAuction || (status?.status === 'live' && !displayTimeRemaining.ended)) && (
              <div className="rounded-lg bg-white/10 shadow p-4">
                <h3 className="text-base font-semibold mb-2 text-left">
                  Place Your {isLiveAuction ? 'Live ' : ''}Bid
                </h3>
                {!user ? (
                  <div className="text-center py-4">
                    <p className="text-gray-400 mb-4 text-sm">Please log in to place a bid</p>
                    <button 
                      onClick={() => navigate('/login')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                      Log In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePlaceBid}>
                    <div className="mb-2">
                      <label className="block text-xs font-medium mb-1 text-left mt-2 mb-2">Bid Amount (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={validCurrentBid + validMinIncrement}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Minimum: ${formatPrice(validCurrentBid + validMinIncrement)}`}
                        className="w-full mt-2 mb-2 px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm"
                        disabled={placingBid || (isLiveAuction && !isConnected)}
                      />
                    </div>
                    {/* Quick Bid Buttons */}
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        className="bg-white/10 hover:bg-white/20 mb-2 text-white px-3 py-2 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
                        onClick={() => {
                          const newBid = validCurrentBid + validMinIncrement;
                          setBidAmount(newBid.toFixed(2));
                        }}
                        disabled={placingBid || (isLiveAuction && !isConnected) || isNaN(validCurrentBid) || isNaN(validMinIncrement)}
                      >
                        Bid {formatPrice(validCurrentBid + validMinIncrement)}
                      </button>
                      <button
                        type="button"
                        className="bg-white/10 hover:bg-white/20 mb-2 text-white px-3 py-2 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
                        onClick={() => {
                          const newBid = validCurrentBid + validMinIncrement * 2;
                          setBidAmount(newBid.toFixed(2));
                        }}
                        disabled={placingBid || (isLiveAuction && !isConnected) || isNaN(validCurrentBid) || isNaN(validMinIncrement)}
                      >
                        Bid {formatPrice(validCurrentBid + validMinIncrement * 2)}
                      </button>
                    </div>
                    {bidError && (
                      <div className="mb-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
                        {bidError}
                      </div>
                    )}
                    {bidSuccess && (
                      <div className="mb-2 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-xs">
                        {bidSuccess}
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={placingBid || !bidAmount || (isLiveAuction && !isConnected)}
                      className="w-full"
                    >
                      {placingBid ? (
                        <span>
                          <i className="fas fa-spinner animate-spin mr-2"></i>
                          Placing {isLiveAuction ? 'Live ' : ''}Bid...
                        </span>
                      ) : (
                        `Place ${isLiveAuction ? 'Live ' : ''}Bid`
                      )}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default AuctionPage; 
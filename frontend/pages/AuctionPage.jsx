import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import auctionService from '../src/services/auctionService';
import socketService from '../src/services/socketService';
import BidHistory from '../src/components/auctions/BidHistory';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import WinnerDeclaration from '../src/components/WinnerDeclaration';
import EndpointSVG from './assets/Endpoint-amico.svg';

function AuctionPage() {
  const { id, type } = useParams();
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
  
  // Winner announcement state
  const [winnerAnnouncement, setWinnerAnnouncement] = useState(null);
  const [winnerChecked, setWinnerChecked] = useState(false);

  // Countdown states
  const [countdown, setCountdown] = useState(null);
  const [countdownStatus, setCountdownStatus] = useState(null);
  const [loadingCountdown, setLoadingCountdown] = useState(true);

  // Redirect countdown for ended auctions
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Add ref to track socket connection
  const socketConnectedRef = useRef(false);

  // Stable onClose function
  const handleToastClose = useCallback(() => {
    setToast({ show: false, message: '', type: 'info' });
  }, []);

  // Check for settled auction winner when auction ends
  useEffect(() => {
    if (auction && !isLiveAuction && !winnerAnnouncement && !winnerChecked) {
      const now = new Date();
      const endTime = new Date(auction.end_time);
      const isEnded = auction.status === 'closed' || now > endTime;
      
      if (isEnded) {
        setWinnerChecked(true); // Mark as checked to prevent re-running
        
        const checkSettledWinner = async () => {
          try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auctions/settled/${auction.id}/result`, {
              headers: {
                'Authorization': `Bearer ${user.token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.result) {
                setWinnerAnnouncement({
                  winner: result.result.winner_id ? {
                    user_id: result.result.winner_id,
                    user_name: result.result.winner_name,
                    amount: result.result.final_bid
                  } : null,
                  status: result.result.status,
                  finalBid: result.result.final_bid
                });

                // Show toast notification
                let message = '';
                if (result.result.winner_id) {
                  message = `🏆 Winner: ${result.result.winner_name} won with ${formatPrice(result.result.final_bid)}!`;
                  if (result.result.winner_id === user?.id) {
                    message = `🎉 Congratulations! You won this auction with ${formatPrice(result.result.final_bid)}!`;
                  }
                } else if (result.result.status === 'reserve_not_met') {
                  message = '❌ Auction ended - Reserve price not met';
                } else if (result.result.status === 'no_bids') {
                  message = '❌ Auction ended - No bids were placed';
                } else {
                  message = 'Auction ended';
                }
                
                setToast({ show: true, message, type: 'info' });

                // Auto-redirect after 3 seconds
                setTimeout(() => {
                  setToast({ show: true, message: 'Redirecting to auctions page...', type: 'info' });
                  setTimeout(() => {
                    navigate('/auctions');
                  }, 1000);
                }, 3000);
              } else {
                // No result yet, but auction has ended - show generic ended message
                setToast({ show: true, message: 'Auction has ended. Winner will be announced shortly.', type: 'info' });
              }
            } else if (response.status === 404) {
              // No result yet, but auction has ended - show generic ended message
              setToast({ show: true, message: 'Auction has ended. Winner will be announced shortly.', type: 'info' });
            }
          } catch (error) {
            console.error('Error fetching settled auction result:', error);
            // Show generic ended message on error
            setToast({ show: true, message: 'Auction has ended. Winner will be announced shortly.', type: 'info' });
          }
        };
        
        checkSettledWinner();
        
        // Set up periodic check every 30 seconds for auction results
        const interval = setInterval(checkSettledWinner, 30000);
        
        return () => clearInterval(interval);
      }
    }
  }, [auction?.id, isLiveAuction, winnerAnnouncement, winnerChecked, user?.token, navigate]);

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
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
      let auctionData = null;
      let isLive = false;
      if (type === 'settled') {
        const settledData = await auctionService.getSettledAuction(id);
        auctionData = settledData;
        isLive = false;
      } else if (type === 'live') {
        const liveData = await auctionService.getLiveAuction(id);
        auctionData = liveData;
        isLive = true;
      } else {
        throw new Error('Invalid auction type');
      }
      setAuction(auctionData);
      setIsLiveAuction(type === 'live');
      // Fetch bid history for live auctions
      if (type === 'live') {
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
          const response = await fetch(`${backendUrl}/api/auctions/live/${id}/bids`);
          if (response.ok) {
            const data = await response.json();
            setRecentBids(data.bids || []);
          }
        } catch (bidError) {
          console.error('[AuctionPage] Error fetching live bids:', bidError);
          setRecentBids([]);
        }
      } else {
        setRecentBids(auctionData.recentBids || []);
      }
    } catch (err) {
      console.error('[AuctionPage] Error fetching auction:', err);
      if (type === 'settled') {
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
          const response = await fetch(`${backendUrl}/api/auctions/settled/${id}`);
          if (response.ok) {
            const auctionData = await response.json();
            if (auctionData.status === 'closed' || auctionData.auction?.status === 'closed') {
              navigate(`/ended-auction/${id}`, { 
                replace: true,
                state: { 
                  auctionData: auctionData,
                  fromRedirect: true,
                  auctionType: auctionData.type || type || 'settled'
                }
              });
              return;
            }
          }
        } catch (checkError) {
          console.error('[AuctionPage] Error checking auction status:', checkError);
        }
      }
      setError('Failed to load auction. Please try again.');
      setAuction(null);
      setIsLiveAuction(false);
      setRecentBids([]);
    } finally {
      setLoading(false);
    }
  }, [id, type, navigate]);

  // Single socket connection useEffect
  useEffect(() => {
    if (!isLiveAuction || !user || !user.token || socketConnectedRef.current) {
      return;
    }

    socketConnectedRef.current = true;

    const setupSocket = async () => {
      try {
        const socket = await socketService.connect(user.token);
        let prevHighestBidderId = null;

        // Always join the auction room on connect (including after reconnect)
        const joinRoom = () => {
          socketService.joinLiveAuction(id, (data) => {
            if (data.type === 'auction-update') {
              setAuction(prevAuction => {
                if (!prevAuction) return data.auction;
                return {
                  ...prevAuction,
                  current_highest_bid: data.auction.currentBid,
                  current_highest_bidder_id: data.auction.currentBidder,
                };
              });
            } else if (data.type === 'auction_state') {
              if (data.existingBids && data.existingBids.length > 0) {
                setRecentBids(data.existingBids);
              }
              setAuction(prevAuction => {
                if (!prevAuction) return data;
                return {
                  ...prevAuction,
                  current_highest_bid: data.currentBid,
                  current_highest_bidder_id: data.currentBidder,
                };
              });
              if (data.bids && Array.isArray(data.bids)) {
                setRecentBids(data.bids);
              }
              if (data.timerEnd) {
                setLiveBidTimerEnd(data.timerEnd);
              }
              const previousId = prevHighestBidderId || auction?.current_highest_bidder_id;
              const currentId = data.currentHighestBidderId || data.currentBidder || (data.bids && data.bids[0]?.user_id);
              if (previousId && previousId !== currentId && previousId === user?.id) {
                setToast({ show: true, message: 'You have been outbid!', type: 'info' });
              }
              prevHighestBidderId = currentId;
              setAuction(prevAuction => {
                if (!prevAuction) return data.auction;
                return {
                  ...prevAuction,
                  current_highest_bid: data.currentBid,
                  current_highest_bidder_id: currentId,
                };
              });
            } else if (data.type === 'bid-update') {
              if (data.bids && Array.isArray(data.bids)) {
                setRecentBids(data.bids);
              }
              setAuction(prevAuction => {
                if (!prevAuction) return prevAuction;
                return {
                  ...prevAuction,
                  current_highest_bid: data.currentBid,
                  current_highest_bidder_id: data.currentBidder,
                };
              });
              if (data.timerEnd) {
                setLiveBidTimerEnd(data.timerEnd);
              }
            } else if (data.type === 'participant-update') {
              setParticipantCount(data.participantCount);
            } else if (data.type === 'join-error') {
              setError(data.error);
              setToast({ show: true, message: data.error, type: 'error' });
              if (data.error && (
                data.error.includes('ended') || 
                data.error.includes('closed') ||
                data.error.includes('not found')
              )) {
                setTimeout(() => {
                  navigate(`/ended-auction/${id}`, { 
                    replace: true,
                    state: { 
                      fromRedirect: true,
                      error: data.error,
                      auctionType: auction?.type || type || 'settled'
                    }
                  });
                }, 2000);
              }
            } else if (data.type === 'auction-end') {
              setPlacingBid(false);
              setBidAmount('');
              let message = '';
              if (data.result.winner) {
                message = `🎉 Winner: ${data.result.winner.user_name || `User ${data.result.winner.user_id?.slice(0, 8)}`} won with ${formatPrice(data.result.winner.amount)}!`;
                setWinnerAnnouncement(data.result);
              } else if (data.result.status === 'reserve_not_met') {
                message = '❌ Auction ended - Reserve price not met';
              } else if (data.result.status === 'no_bids') {
                message = '❌ Auction ended - No bids were placed';
              } else {
                message = 'Auction ended';
              }
              setToast({ show: true, message, type: 'info' });
              setAuction(prevAuction => ({
                ...prevAuction,
                status: 'closed'
              }));
            }
          });
        };

        // Listen for connect event and always join room
        socket.on('connect', () => {
          console.log('Socket connected, joining room...');
          setIsConnected(true);
          joinRoom();
        });

        socket.on('disconnect', () => {
          console.log('Socket disconnected');
          setIsConnected(false);
          socketConnectedRef.current = false;
        });

        socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setIsConnected(false);
          socketConnectedRef.current = false;
        });

        // Check initial connection status
        if (socket.connected) {
          console.log('Socket already connected, joining room...');
          setIsConnected(true);
          joinRoom();
        }

        // Also join room on initial connect
        joinRoom();
      } catch (error) {
        console.error('Failed to connect to socket:', error);
        setError('Failed to connect to live auction');
        setToast({ show: true, message: 'Failed to connect to live auction', type: 'error' });
        socketConnectedRef.current = false;
      }
    };

    setupSocket();

    return () => {
      socketConnectedRef.current = false;
      socketService.leaveLiveAuction(id);
      socketService.disconnect();
    };
  }, [id, user?.token, isLiveAuction]); // Only depend on these values

  // Optimized: Only call fetchAuction for settled auctions, and use Promise.all for live auctions
  useEffect(() => {
    let stopPolling;
    if (type === 'settled') {
      fetchAuction();
      stopPolling = auctionService.startAuctionPolling(id, (response) => {
        setAuction(response.auction || response);
        setRecentBids(response.bids || response.recentBids || []);
      }, 5000); // 5 seconds
    } else if (type === 'live') {
      setLoading(true);
      setError(null);
      async function loadLiveAuction() {
        try {
          const auctionData = await auctionService.getLiveAuction(id);
          setAuction(auctionData);
          setIsLiveAuction(true);
          
          // Check if auction is closed and redirect
          if (auctionData.status === 'closed') {
            // Pass auction data and winner announcement through navigation state
            navigate(`/ended-auction/${id}`, { 
              replace: true,
              state: { 
                auctionData: auctionData,
                fromRedirect: true,
                auctionType: auctionData.type || type || 'settled'
              }
            });
            return;
          }
          
          try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/auctions/live/${id}/bids`);
            if (response.ok) {
              const bidsData = await response.json();
              setRecentBids(bidsData.bids || []);
            } else {
              setRecentBids([]);
            }
          } catch {
            setRecentBids([]);
          }
        } catch (err) {
          console.error('Error loading live auction:', err);
          
          // Check if this might be an ended auction
          try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/auctions/live/${id}`);
            if (response.ok) {
              const auctionData = await response.json();
              if (auctionData.status === 'closed') {
                // Pass auction data and winner announcement through navigation state
                navigate(`/ended-auction/${id}`, { 
                  replace: true,
                  state: { 
                    auctionData: auctionData,
                    fromRedirect: true,
                    auctionType: auctionData.type || type || 'settled'
                  }
                });
                return;
              }
            }
          } catch (checkError) {
            console.error('Error checking auction status:', checkError);
          }
          
          setError('Failed to load auction. Please try again.');
          setAuction(null);
          setIsLiveAuction(false);
          setRecentBids([]);
        } finally {
          setLoading(false);
        }
      }
      loadLiveAuction();
    }
    return () => {
      if (stopPolling) stopPolling();
    };
  }, [id, type]);

  // After setting auction, redirect if closed live auction
  useEffect(() => {
    if (auction && auction.type === 'live' && auction.status === 'closed') {
      navigate(`/ended-auction/${auction.id}`, { replace: true });
    }
  }, [auction, navigate]);

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
    if (isAuctionEndedValue) {
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
        await socketService.placeLiveBid(id, amount, (response) => {
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
        const bidRes = await auctionService.placeSettledBid(id, amount);
        setBidSuccess('Bid placed successfully!');
        setBidAmount('');
        setToast({ show: true, message: `Bid placed successfully! Your bid: ${formatPrice(amount)}`, type: 'success' });
        setTimeout(() => setBidSuccess(''), 3000);
        setPlacingBid(false);
      }
    } catch (err) {
      console.error('[AuctionPage] Error placing bid:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to place bid. Please try again.';
      setBidError(errorMsg);
      setToast({ show: true, message: errorMsg, type: 'error' });
      setPlacingBid(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchCountdown() {
      if (!auction) return;
      setLoadingCountdown(true);
      try {
        const type = auction.type || 'settled';
        const data = await auctionService.getAuctionCountdown(type, auction.id);
        if (isMounted) {
          setCountdown(data.countdown);
          setCountdownStatus(data.status);
        }
      } catch (e) {
        if (isMounted) {
          setCountdown(null);
          setCountdownStatus(null);
        }
      } finally {
        if (isMounted) setLoadingCountdown(false);
      }
    }
    fetchCountdown();
    const interval = setInterval(fetchCountdown, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [auction?.id, auction?.type]);

  // Add state for live bid countdown
  const [liveBidCountdown, setLiveBidCountdown] = useState(null);
  const [liveBidTimerEnd, setLiveBidTimerEnd] = useState(null);

  // Add a useEffect to update the countdown every second
  useEffect(() => {
    if (!liveBidTimerEnd) {
      setLiveBidCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((liveBidTimerEnd - now) / 1000));
      setLiveBidCountdown(diff);
      if (diff <= 0) {
        setLiveBidTimerEnd(null);
        setLiveBidCountdown(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [liveBidTimerEnd]);

  // Helper to format seconds as HH:MM:SS
  const formatSeconds = (secs) => {
    if (secs == null) return '--:--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
  };

  // Get status for live auctions (calculate this before isAuctionEnded)
  const status = isLiveAuction ? getAuctionStatus() : null;

  // Get time remaining (different logic for live vs settled auctions)
  const displayTimeRemaining = { ended: auction?.status === 'closed', text: '' };

  // Check if auction is ended (by status or time)
  const isAuctionEnded = () => {
    if (!auction) return false;
    
    // Check if status is closed
    if (auction.status === 'closed') return true;
    
    // Check if end time has passed
    const now = new Date();
    const endTime = new Date(auction.end_time);
    if (now > endTime) return true;
    
    // For live auctions, also check status
    if (isLiveAuction && status?.status === 'ended') return true;
    
    return false;
  };

  const isAuctionEndedValue = isAuctionEnded();

  // Auto-redirect countdown for ended auctions
  useEffect(() => {
    if (isAuctionEndedValue && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(prev => prev - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (isAuctionEndedValue && redirectCountdown === 0) {
      // Show redirect toast
      setToast({ show: true, message: 'Redirecting to ended auction page...', type: 'info' });
      // Redirect to EndedAuctionPage with auction data for both live and settled
      setTimeout(() => {
        navigate(`/ended-auction/${id}`, { 
          replace: true,
          state: { 
            auctionData: auction,
            fromRedirect: true,
            auctionType: auction?.type || type || 'settled'
          }
        });
      }, 1000);
    }
  }, [isAuctionEndedValue, redirectCountdown, navigate, id, auction]);

  // Reset countdown when auction changes
  useEffect(() => {
    setRedirectCountdown(5);
    setWinnerChecked(false); // Reset winner check flag for new auction
    setWinnerAnnouncement(null); // Reset winner announcement for new auction
  }, [id]);

  // Show message if auction has not started yet and user is seller
  const now = new Date();
  const auctionStart = auction ? new Date(auction.start_time) : null;
  if (
    auction &&
    user &&
    user.role === 'seller' &&
    auctionStart &&
    now < auctionStart
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
        <div className="flex flex-col items-center w-full mb-4">
          <img src={EndpointSVG} alt="Auction Not Started" className="w-full max-w-xs h-auto mb-2" style={{maxWidth: '320px'}} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Auction has not started yet</h1>
        <p className="text-white/80 mb-6 text-center max-w-md mx-auto">This auction will be available to view and bid on once it starts.<br/>Start Time: <span className="font-semibold text-blue-300">{auctionStart.toLocaleString()}</span></p>
        <Button
          variant="primary"
          onClick={() => navigate('/seller/dashboard?tab=listings')}
          className="mx-auto"
        >
          Back to My Listings
        </Button>
      </div>
    );
  }

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

  const currentBid = auction.current_highest_bid || auction.starting_price;
  const minBidIncrement = auction.min_bid_increment || 1;

  // Ensure we have valid numbers
  const validCurrentBid = Number(currentBid) || 0;
  const validMinIncrement = 5; // Always $5 minimum increment for both types

  // Show ended auction message if auction exists but is ended
  if (isAuctionEndedValue) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
        <div className="flex flex-col items-center w-full" style={{ marginBottom: '1.2rem'}}>
          <img src={EndpointSVG} alt="Auction Ended" className="w-full max-w-xs h-auto" style={{maxWidth: '320px', marginBottom: '0.5rem'}} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">This auction has ended</h1>
        <p className="text-white/80 mb-6 text-center max-w-md mx-auto">Bidding is now closed. You will be redirected to the auctions page in a few seconds.</p>
        <div className="text-center mb-6">
          <p className="text-sm text-gray-400 mb-2">Redirecting in:</p>
          <p className="text-2xl font-bold text-blue-400">{redirectCountdown}</p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="primary"
            onClick={() => navigate(isLiveAuction ? '/live-auctions' : '/auctions')}
            className="mx-auto"
          >
            Go Now
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.history.back()}
            className="mx-auto"
          >
            Go Back
          </Button>
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
          duration={toast.type === 'success' ? 1500 : 3000}
        />
      )}

      
      {/* Winner Announcement Modal */}
      {winnerAnnouncement && (
        <WinnerDeclaration
          winnerAnnouncement={winnerAnnouncement}
          onClose={() => {
            setWinnerAnnouncement(null);
          }}
          auctionType={isLiveAuction ? 'live' : 'settled'}
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
                Seller: <span className="font-semibold text-white">{auction.seller?.first_name + ' ' + auction.seller?.last_name + (auction.seller?.business_name ? ` (${auction.seller.business_name})` : '')}</span>
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
                          className={`flex justify-between items-center p-2 rounded ${
                            index === 0 ? 'bg-green-900/20 border border-green-500/30' : 'bg-white/5'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">
                                {bid.user_name || `User ${bid.user_id?.slice(0, 8)}`}
                              </span>
                              {index === 0 && (
                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                  Highest
                                </span>
                              )}
                              {index === 0 && (bid.user_id === user?.id || bid.user_id === user?.email) && (
                                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                                  You
                                </span>
                              )}
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
              <div className="text-xs text-gray-400 mb-1">Time Remaining: <span className="text-green-300">{formatSeconds(countdown)}</span></div>
              <div className="text-base font-semibold" style={{ color: displayTimeRemaining.ended ? '#f87171' : '#facc15' }}>
                {/* Remove or comment out any JSX that displays countdown or 'Starting in:' */}
              </div>
              {isLiveAuction && (
                <div className="text-xs text-gray-400 mt-1">
                  Participants: <span className="text-blue-400 font-semibold">{participantCount}/{auction.max_participants}</span>
                </div>
              )}
            </div>

            {/* Place Your Bid Card */}
            {(!isLiveAuction || (status?.status === 'live' && !isAuctionEndedValue)) && (
              <div className="rounded-lg bg-white/10 shadow p-4">
                <h3 className="text-base font-semibold mb-2 text-left">
                  Place Your {isLiveAuction ? 'Live ' : ''}Bid
                </h3>
                {isLiveAuction && status?.status === 'upcoming' && (
                  <div className="text-center py-4 text-yellow-400 font-semibold">
                    Bidding will open when the auction starts.
                  </div>
                )}
                {isAuctionEndedValue && (
                  <div className="text-center py-4 text-red-400 font-semibold">
                    This auction has ended.
                  </div>
                )}
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
                        disabled={placingBid || (isLiveAuction && (!isConnected || status?.status === 'upcoming')) || isAuctionEndedValue}
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
                        disabled={placingBid || (isLiveAuction && (!isConnected || status?.status === 'upcoming')) || isAuctionEndedValue || isNaN(validCurrentBid) || isNaN(validMinIncrement)}
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
                        disabled={placingBid || (isLiveAuction && (!isConnected || status?.status === 'upcoming')) || isAuctionEndedValue || isNaN(validCurrentBid) || isNaN(validMinIncrement)}
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
                      disabled={placingBid || !bidAmount || (isLiveAuction && (!isConnected || status?.status === 'upcoming')) || isAuctionEndedValue}
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
      {isLiveAuction && liveBidCountdown !== null && (
  <div style={{
    position: 'absolute',
    top: 24,
    right: 24,
    background: 'rgba(35,43,74,0.92)',
    color: '#fff',
    borderRadius: 12,
    padding: '12px 24px',
    boxShadow: '0 2px 8px #0004',
    zIndex: 10,
    minWidth: 180,
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 18
  }}>
    <div style={{ fontSize: 15, color: '#6fffbe', fontWeight: 700, marginBottom: 4 }}>Live Bid Countdown</div>
    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>{formatSeconds(liveBidCountdown)}</div>
    <div style={{ fontSize: 13, color: '#ffd166', marginTop: 6 }}>
      If no bids are placed before this timer ends,<br />the auction will end automatically.<br />Place bids to win!
    </div>
  </div>
)}
    </>
  );
}

export default AuctionPage; 
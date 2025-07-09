import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import auctionService from '../src/services/auctionService';
import BidHistory from '../src/components/auctions/BidHistory';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import WinnerDeclaration from '../src/components/WinnerDeclaration';
import EndpointSVG from './assets/Endpoint-amico.svg';

function EndedAuctionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserContext);
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [winnerChecked, setWinnerChecked] = useState(false);
  const auctionType = location.state?.auctionType || 'settled'; // fallback

  // Debug state changes
  useEffect(() => {
    console.log('EndedAuctionPage: State update:', {
      auction: auction ? { id: auction.id, title: auction.title, status: auction.status } : null,
      winnerAnnouncement,
      winnerChecked,
      loading,
      error,
      navigationState: location.state,
      fromMyWinnings: location.state?.fromMyWinnings
    });
  }, [auction, winnerAnnouncement, winnerChecked, loading, error, location.state]);

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Check for auction winner when page loads
  useEffect(() => {
    // Don't show winner announcement if user is coming from "My Winnings" or "My Bids"
    const fromMyWinnings = location.state?.fromMyWinnings;
    const fromMyBids = location.state?.fromMyBids;
    
    if (auction && !winnerAnnouncement && !winnerChecked && !fromMyWinnings && !fromMyBids) {
      console.log('EndedAuctionPage: Checking for winner announcement, auction:', auction.id);
      setWinnerChecked(true); // Mark as checked to prevent re-running
      
      const checkWinner = async () => {
        try {
          const type = auction.type || 'live';
          let resultUrl = '';
          if (type === 'settled') {
            resultUrl = `${import.meta.env.VITE_BACKEND_URL}/api/auth/settled-auction-result/${auction.id}`;
          } else {
            resultUrl = `${import.meta.env.VITE_BACKEND_URL}/api/auctions/live/${auction.id}/result`;
          }
          console.log('EndedAuctionPage: Checking auction result at', resultUrl, 'for auction type:', type);
          const response = await fetch(resultUrl, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('justbetToken')}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('EndedAuctionPage: Auction result response status:', response.status);
          if (response.ok) {
            const result = await response.json();
            console.log('EndedAuctionPage: Auction result:', result);
            if (result.result) {
              let winnerName = result.result.winner?.first_name && result.result.winner?.last_name
                ? `${result.result.winner.first_name} ${result.result.winner.last_name}`
                : result.result.winner?.email
                  ? result.result.winner.email
                  : result.result.winner_id
                    ? `User ${result.result.winner_id.slice(0, 8)}`
                    : 'Unknown';
              let message = '';
              if (result.result.winner_id) {
                message = `🏆 Winner: ${winnerName} won with ${formatPrice(result.result.final_bid)}!`;
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
              setWinnerAnnouncement({
                winner: result.result.winner_id ? {
                  id: result.result.winner_id,
                  first_name: result.result.winner?.first_name,
                  last_name: result.result.winner?.last_name,
                  email: result.result.winner?.email,
                  amount: result.result.final_bid
                } : null,
                status: result.result.status,
                finalBid: result.result.final_bid
              });
              return;
            }
          
            console.log('EndedAuctionPage: No auction result found for auction type:', type, 'auction ID:', auction.id);
            // Show a generic message if no result exists yet
            setToast({ show: true, message: 'Auction has ended. Winner will be announced shortly.', type: 'info' });
          }
        } catch (error) {
          console.error('EndedAuctionPage: Error fetching auction result:', error);
        }
      };
      checkWinner();
      const interval = setInterval(checkWinner, 30000);
      return () => {
        clearInterval(interval);
      };
    } else if (fromMyWinnings || fromMyBids) {
      console.log('EndedAuctionPage: User came from My Winnings or My Bids, skipping winner announcement');
      setWinnerChecked(true); // Mark as checked to prevent re-running
    }
  }, [auction?.id, auction?.type, winnerAnnouncement, winnerChecked, user?.token, location.state]);

  useEffect(() => {
    async function fetchAuction() {
      setLoading(true);
      setError(null);
      console.log('[Frontend] Fetching auction with ID:', id, 'and type:', auctionType);
      try {
        let data = null;
        if (auctionType === 'live') {
          data = await auctionService.getLiveAuction(id);
          console.log('[Frontend] Live auction fetch response:', data);
        } else {
          data = await auctionService.getSettledAuction(id);
          console.log('[Frontend] Settled auction fetch response:', data);
        }
        if (!data) {
          setError('This auction does not exist or is not ended.');
          setAuction(null);
          setLoading(false);
          return;
        }
        if (data.status !== 'closed') {
          setError('This auction is not ended.');
          setAuction(null);
        } else {
          setAuction({ ...data, type: auctionType });
          // Fetch bid history
          try {
            if (auctionType === 'settled') {
              console.log('[Frontend] Fetching settled auction bids for:', id);
              const bidData = await auctionService.getSettledBids(id);
              console.log('[Frontend] Settled auction bid response:', bidData);
              setBids(Array.isArray(bidData) ? bidData : []);
            } else {
              console.log('[Frontend] Fetching live auction bids for:', id);
              const bidData = await auctionService.getLiveAuctionBids(id);
              console.log('[Frontend] Live auction bid response:', bidData);
              setBids(bidData || []);
            }
          } catch (error) {
            console.error('[Frontend] Error fetching bids:', error);
            setBids([]);
          }
        }
      } catch (err) {
        console.error('[Frontend] Error fetching auction:', err);
        setError('Failed to load auction. Please try again.');
        setAuction(null);
      } finally {
        setLoading(false);
      }
    }
    fetchAuction();
  }, [id, auctionType, location.state]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
        <div className="flex flex-col items-center w-full" style={{ marginBottom: '1.2rem'}}>
          <img src={EndpointSVG} alt="Auction Ended" className="w-full max-w-xs h-auto" style={{maxWidth: '320px', marginBottom: '0.5rem'}} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Auction Not Found</h1>
        <p className="text-white/80 mb-6 text-center max-w-md mx-auto">{error || 'This auction does not exist or is not ended.'}</p>
        <Button
          variant="primary"
          onClick={() => navigate('/live-auctions')}
          className="mx-auto"
        >
          Back to Live Auctions
        </Button>
      </div>
    );
  }

  // Backend already provides first_name, last_name, and email in the correct format
  const displayBids = bids.slice(0, 10);

  console.log('EndedAuctionPage: Bid data for BidHistory:', {
    originalBids: bids,
    displayBids: displayBids,
    auctionType: auction.type,
    auctionId: id
  });

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4 py-8">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'info' })}
          duration={3000}
        />
      )}

      {/* Winner Announcement Modal */}
      {winnerChecked && winnerAnnouncement && !location.state?.fromMyWinnings && !location.state?.fromMyBids && (
        <WinnerDeclaration
          winnerAnnouncement={winnerAnnouncement}
          onClose={() => setWinnerAnnouncement(null)}
          auctionType={auction.type || 'live'}
        />
      )}

      <div className="flex flex-col items-center w-full" style={{ marginBottom: '1.2rem'}}>
        <img src={EndpointSVG} alt="Auction Ended" className="w-full max-w-xs h-auto" style={{maxWidth: '320px', marginBottom: '0.5rem'}} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">This auction has ended</h1>
      <p className="text-white/80 mb-6 text-center max-w-md mx-auto">Bidding is now closed. See the final details and bid history below.</p>
      <div className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Auction Info */}
        <div className="rounded-lg bg-white/10 shadow p-4 flex flex-col items-center">
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              className="max-h-48 w-auto rounded object-contain mb-4"
            />
          ) : (
            <div className="w-full h-36 flex items-center justify-center mb-4">
              <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
            </div>
          )}
          <h2 className="text-lg font-bold mb-1 text-center">{auction.title}</h2>
          <div className="mb-1 text-xs text-gray-300 text-center">
            Seller: <span className="font-semibold text-white">{auction.business_name || `${auction.first_name} ${auction.last_name}` || auction.email || 'Unknown'}</span>
          </div>
          <div className="text-sm text-gray-200 whitespace-pre-line text-center mt-2">
            {auction.description}
          </div>
          <div className="mt-4 text-base font-semibold text-purple-400">Auction Ended</div>
          <div className="text-xs text-gray-400 mt-1">Ended at: {new Date(auction.end_time).toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Final Bid: <span className="text-green-400 font-bold">{auction.current_highest_bid ? `$${auction.current_highest_bid}` : 'No bids'}</span></div>
        </div>
        {/* Bid History */}
        <div className="rounded-lg bg-white/10 shadow p-4">
          <h3 className="text-base font-semibold mb-3 text-left">Bid History</h3>
          <BidHistory auctionId={id} type={auction.type || 'live'} bids={displayBids} />
        </div>
      </div>
      <Button
        variant="primary"
        onClick={() => navigate(auction.type === 'settled' ? '/auctions' : '/live-auctions')}
        className="mx-auto"
      >
        Back to {auction.type === 'settled' ? 'Settled' : 'Live'} Auctions
      </Button>
    </div>
  );
}

export default EndedAuctionPage; 
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import Button from '../src/components/Button';

function CompletedAuctionDetails() {
  const { id, type } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [auction, setAuction] = useState(null);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchAuctionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('justbetToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const auctionUrl = `${import.meta.env.VITE_BACKEND_URL}/api/${type === 'live' ? 'live-auction' : 'auctions'}/${id}`;
      const auctionResponse = await fetch(auctionUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!auctionResponse.ok) {
        throw new Error('Auction not found');
      }

      const auctionData = await auctionResponse.json();
      const auctionObj = auctionData.auction || auctionData;
      setAuction(auctionObj);
      console.log('Auction data:', auctionObj);

      // Get winner details if auction was sold
      if (auctionObj.status === 'closed' && auctionObj.current_highest_bidder_id) {
        const winnerUrl = `${import.meta.env.VITE_BACKEND_URL}/api/auth/user/${auctionObj.current_highest_bidder_id}`;
        const winnerResponse = await fetch(winnerUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (winnerResponse.ok) {
          const winnerData = await winnerResponse.json();
          setWinner(winnerData.user);
        }
      }

    } catch (err) {
      setError(err.message || 'Failed to load auction details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && type) {
      fetchAuctionDetails();
    }
  }, [id, type]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading auction details...</p>
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
            <Button 
              onClick={() => navigate('/seller/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isSold = auction.status === 'closed' && auction.current_highest_bidder_id;
  const finalBid = auction.current_highest_bid || auction.starting_price;
  const auctionType = auction?.type || type || 'settled';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🏆 Completed Auction Details</h1>
          <p className="text-gray-300">Auction Results & Winner Information</p>
        </div>

        {/* Back Button */}
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/seller/dashboard')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Auction Details */}
          <div className="bg-white/10 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-400">📋 Auction Information</h2>
            
            {/* Auction Image */}
            <div className="mb-4 h-48 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
              {auction.image_url ? (
                <img
                  src={auction.image_url}
                  alt={auction.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
              )}
            </div>

            {/* Auction Info */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold mb-2">{auction.title}</h3>
                <p className="text-gray-300 text-sm whitespace-pre-line">{auction.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  auctionType === 'live' 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {auctionType === 'live' ? 'Live Auction' : 'Settled Auction'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  isSold 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {isSold ? 'Sold' : 'No Bids'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Start Time:</span>
                  <p className="font-semibold">{formatDate(auction.start_time)}</p>
                </div>
                <div>
                  <span className="text-gray-400">End Time:</span>
                  <p className="font-semibold">{formatDate(auction.end_time)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Starting Price:</span>
                  <p className="font-semibold text-green-400">{formatPrice(auction.starting_price)}</p>
                </div>
                {auction.reserve_price && (
                  <div>
                    <span className="text-gray-400">Reserve Price:</span>
                    <p className="font-semibold text-yellow-400">{formatPrice(auction.reserve_price)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Winner Information */}
          <div className="bg-white/10 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-green-400">🏆 Auction Results</h2>
            
            {isSold ? (
              <div className="space-y-4">
                {/* Final Bid */}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-300 mb-1">Final Sale Price</p>
                  <p className="text-3xl font-bold text-green-400">{formatPrice(finalBid)}</p>
                </div>

                {/* Winner Details */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 text-green-400">Winner Information</h3>
                  {winner ? (
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-400">Name:</span>
                        <p className="font-semibold">{winner.first_name} {winner.last_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Email:</span>
                        <p className="font-semibold">{winner.email}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">User ID:</span>
                        <p className="font-semibold text-sm">{winner.id}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <i className="fas fa-user text-gray-400 text-2xl mb-2"></i>
                      <p className="text-gray-400">Winner details not available</p>
                    </div>
                  )}
                </div>

                {/* Revenue Info */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2 text-blue-400">Revenue Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Sale Price:</span>
                      <span className="font-semibold text-green-400">{formatPrice(finalBid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Starting Price:</span>
                      <span className="font-semibold">{formatPrice(auction.starting_price)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/20 pt-2">
                      <span>Profit:</span>
                      <span className="font-semibold text-green-400">{formatPrice(finalBid - auction.starting_price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">❌</div>
                <h3 className="text-xl font-semibold mb-2">No Winner</h3>
                <p className="text-gray-400 mb-4">
                  {auction.reserve_price && finalBid < auction.reserve_price 
                    ? 'Reserve price was not met' 
                    : 'No bids were placed on this auction'
                  }
                </p>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300">Starting Price</p>
                  <p className="text-2xl font-bold text-red-400">{formatPrice(auction.starting_price)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompletedAuctionDetails; 
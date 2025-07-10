import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function WonAuctionDetails() {
  const { id, type } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const auctionType = auction?.type || type || 'settled';

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

  // Fetch won auction details
  const fetchWonAuction = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = `${backendUrl}/api/auth/won-auction/${auctionType}/${id}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch auction details');
      }

      const data = await response.json();
      setAuction(data.auction);
    } catch (err) {
      setError('Failed to load auction details. Please try again.');
      console.error('Error fetching won auction:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.token && id && auctionType) {
      fetchWonAuction();
    }
  }, [user, id, auctionType]);

  const handleToastClose = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

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
            <button 
              onClick={() => navigate('/my-winnings')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Back to Winnings
            </button>
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
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-3xl font-bold mb-2">Won Auction Details</h1>
            <p className="text-gray-300">Congratulations! You won this auction</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Image */}
            <div className="rounded-lg bg-white/10 shadow p-4 flex items-center justify-center min-h-[300px]">
              {auction.image_url ? (
                <img
                  src={auction.image_url}
                  alt={auction.title}
                  className="max-h-80 w-auto rounded object-contain"
                />
              ) : (
                <div className="w-full h-64 flex items-center justify-center">
                  <i className="fa-solid fa-image text-gray-400 text-6xl"></i>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Auction Info */}
              <div className="rounded-lg bg-white/10 shadow p-6">
                <h2 className="text-2xl font-bold mb-4">{auction.title}</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-400">Seller</p>
                    <p className="text-white font-semibold">{auction.seller_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Auction Type</p>
                    <p className="text-blue-400 font-semibold capitalize">{auctionType}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Description</p>
                    <p className="text-white whitespace-pre-line">{auction.description}</p>
                  </div>
                </div>
              </div>

              {/* Winning Details */}
              <div className="rounded-lg bg-green-900/20 border border-green-500/30 shadow p-6">
                <h3 className="text-xl font-bold text-green-400 mb-4 text-center">🏆 You Won!</h3>
                <div className="space-y-3 text-center">
                  <div>
                    <p className="text-gray-400 text-sm">Your Winning Bid</p>
                    <p className="text-3xl font-bold text-green-400">{formatPrice(auction.final_bid)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Starting Price</p>
                    <p className="text-white font-semibold">{formatPrice(auction.starting_price)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Auction Ended</p>
                    <p className="text-white font-semibold">{formatDate(auction.end_time)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  onClick={() => navigate('/my-winnings')}
                  className="flex-1"
                >
                  Back to Winnings
                </Button>
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                >
                  Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default WonAuctionDetails; 
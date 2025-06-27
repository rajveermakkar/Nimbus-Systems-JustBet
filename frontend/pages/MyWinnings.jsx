import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function MyWinnings() {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [winnings, setWinnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Fetch winnings
  const fetchWinnings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${backendUrl}/api/auth/winnings`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch winnings');
      }

      const data = await response.json();
      setWinnings(data.winnings || []);
    } catch (err) {
      setError('Failed to load winnings. Please try again.');
      console.error('Error fetching winnings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.token) {
      fetchWinnings();
    }
  }, [user]);

  const handleToastClose = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

  const handleViewAuction = (winning) => {
    if (winning.status === "closed" || winning.status === "ended") {
      navigate(`/ended-auction/${winning.auction_id}`);
    } else {
      navigate(`/auction/${winning.auction_type}/${winning.auction_id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading your winnings...</p>
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
            <h1 className="text-3xl font-bold mb-2">🏆 My Winnings</h1>
            <p className="text-gray-300">Auctions you've won</p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-center">
              <p className="text-red-400">{error}</p>
              <Button 
                onClick={fetchWinnings}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {winnings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-xl font-semibold mb-2">No Winnings Yet</h2>
              <p className="text-gray-400 mb-6">You haven't won any auctions yet. Start bidding to win!</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {winnings.map((winning) => (
                <div 
                  key={`${winning.auction_type}-${winning.auction_id}`}
                  className="bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors"
                >
                  {/* Auction Image */}
                  <div className="mb-4 h-48 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                    {winning.image_url ? (
                      <img
                        src={winning.image_url}
                        alt={winning.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
                    )}
                  </div>

                  {/* Auction Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg line-clamp-2">{winning.title}</h3>
                    
                    <div className="text-sm text-gray-300">
                      <p>Seller: <span className="text-white">{winning.seller_name}</span></p>
                      <p>Type: <span className="text-blue-400 font-semibold capitalize">{winning.auction_type}</span></p>
                      <p>Ended: <span className="text-white">{formatDate(winning.end_time)}</span></p>
                    </div>

                    {/* Price Info */}
                    <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                      <div className="text-center">
                        <p className="text-sm text-gray-300">Your Winning Bid</p>
                        <p className="text-xl font-bold text-green-400">{formatPrice(winning.final_bid)}</p>
                        <p className="text-xs text-gray-400">Starting: {formatPrice(winning.starting_price)}</p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={() => handleViewAuction(winning)}
                      className="w-full"
                    >
                      View Auction Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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

export default MyWinnings; 
import React, { useState, useEffect, useContext } from 'react';
import auctionService from '../../services/auctionService';
import { UserContext } from '../../context/UserContext';

function BidHistory({ auctionId, type = 'settled', bids: propBids }) {
  const [bids, setBids] = useState(propBids || []);
  const [loading, setLoading] = useState(!propBids);
  const [error, setError] = useState(null);
  const { user } = useContext(UserContext);

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Fetch bids
  const fetchBids = async () => {
    try {
      setLoading(true);
      setError(null);
      let data;
      if (type === 'settled') {
        const response = await auctionService.getSettledBids(auctionId);
        data = Array.isArray(response) ? response : [];
      } else if (type === 'live') {
        data = await auctionService.getLiveAuctionBids(auctionId);
      } else {
        data = [];
      }
      setBids(data);
    } catch (err) {
      setError('Failed to load bid history.');
      console.error('Error fetching bids:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propBids !== undefined) {
      // If propBids is provided (even if empty), use it
      setBids(propBids);
      setLoading(false);
    } else if (type === 'settled' || type === 'live') {
      // Only fetch if propBids is not provided
      fetchBids();
    }
  }, [auctionId, type, propBids]);

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Bid History</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Bid History</h3>
        <div className="text-red-400 text-center">{error}</div>
      </div>
    );
  }

  if (bids.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Bid History</h3>
        <div className="text-gray-400 text-center">No bids yet</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Bid History</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {bids.map((bid, index) => (
          <div 
            key={bid.id || index} 
            className={`flex justify-between items-center p-3 rounded ${
              index === 0 ? 'bg-green-900/20 border border-green-500/30' : 'bg-white/5'
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  {bid.first_name && bid.last_name 
                    ? `${bid.first_name} ${bid.last_name}` 
                    : bid.email || 'Anonymous'
                  }
                </span>
                {index === 0 && (
                  <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm ml-1 align-middle" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                    Highest
                  </span>
                )}
                {index === 0 && (bid.user_id === user?.id || bid.email === user?.email) && (
                  <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm ml-1 align-middle" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                    You
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">{formatDate(bid.created_at)}</div>
            </div>
            <div className="text-lg font-bold text-green-400">
              {formatPrice(bid.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BidHistory; 
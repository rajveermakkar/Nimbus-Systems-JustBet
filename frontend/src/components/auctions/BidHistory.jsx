import React, { useState, useEffect } from 'react';
import auctionService from '../../services/auctionService';

function BidHistory({ auctionId, type = 'settled', bids: propBids }) {
  const [bids, setBids] = useState(propBids || []);
  const [loading, setLoading] = useState(!propBids);
  const [error, setError] = useState(null);

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
        data = await auctionService.getSettledBids(auctionId);
      } else {
        // For live auctions, bids will come through Socket.IO
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
    if (propBids && propBids.length > 0) {
      setBids(propBids);
      setLoading(false);
    } else if (type === 'settled') {
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
          <div key={bid.id || index} className="flex justify-between items-center p-3 bg-white/5 rounded">
            <div>
              <div className="font-semibold text-white">
                {bid.first_name && bid.last_name 
                  ? `${bid.first_name} ${bid.last_name}` 
                  : bid.email || 'Anonymous'
                }
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
import React, { useEffect, useState } from 'react';
import auctionService from '../src/services/auctionService';
import AuctionCard from '../src/components/auctions/AuctionCard';
import Button from '../src/components/Button';

function AllAuctionsPage() {
  const [liveAuctions, setLiveAuctions] = useState([]);
  const [settledAuctions, setSettledAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInitialLoading, setShowInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;
    const fetchAll = async (isInitial = false) => {
      if (isInitial) setShowInitialLoading(true);
      setError(null);
      try {
        const [live, settled] = await Promise.all([
          auctionService.getLiveAuctions(),
          auctionService.getSettledAuctions()
        ]);
        setLiveAuctions(live || []);
        setSettledAuctions(settled || []);
      } catch (err) {
        setError('Failed to load auctions. Please try again.');
      } finally {
        if (isInitial) setShowInitialLoading(false);
      }
    };
    fetchAll(true);
    intervalId = setInterval(() => fetchAll(false), 7000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">All Auctions</h1>
        <p className="text-gray-300 mb-8">Browse and bid on amazing items from verified sellers</p>
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 max-w-md mx-auto mb-8">
            <i className="fas fa-exclamation-triangle text-red-400 text-2xl mb-2"></i>
            <span className="text-red-300">{error}</span>
          </div>
        )}
        {showInitialLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading auctions...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Live Auctions Section */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Live Auctions</h2>
                <button 
                  onClick={() => window.location.href = '/live-auctions'}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200"
                >
                  <span>Show More</span>
                  <i className="fas fa-arrow-right text-xs"></i>
                </button>
              </div>
              {liveAuctions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {liveAuctions.slice(0, 4).map(auction => (
                    <AuctionCard key={auction.id} auction={auction} actionLabel="Join Live Auction" />
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-center py-8">No live auctions right now.</div>
              )}
            </div>
            <hr className="border-white/20 my-8" />
            {/* Settled Auctions Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Settled Auctions</h2>
                <button 
                  onClick={() => window.location.href = '/settled-auctions'}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200"
                >
                  <span>Show More</span>
                  <i className="fas fa-arrow-right text-xs"></i>
                </button>
              </div>
              {settledAuctions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {settledAuctions.slice(0, 4).map(auction => (
                    <AuctionCard key={auction.id} auction={auction} actionLabel="Bid Now" />
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-center py-8">No settled auctions right now.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AllAuctionsPage; 
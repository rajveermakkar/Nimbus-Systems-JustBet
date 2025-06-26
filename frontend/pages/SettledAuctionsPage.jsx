import React, { useEffect, useState } from 'react';
import auctionService from '../src/services/auctionService';
import AuctionCard from '../src/components/auctions/AuctionCard';
import Button from '../src/components/Button';

function SettledAuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInitialLoading, setShowInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let intervalId;
    const fetchAuctions = async (isInitial = false) => {
      if (isInitial) setShowInitialLoading(true);
      setError(null);
      try {
        const data = await auctionService.getSettledAuctions();
        setAuctions(data);
      } catch (err) {
        setError('Failed to load settled auctions. Please try again.');
      } finally {
        if (isInitial) setShowInitialLoading(false);
      }
    };
    fetchAuctions(true);
    intervalId = setInterval(() => fetchAuctions(false), 7000);
    return () => clearInterval(intervalId);
  }, []);

  const filtered = auctions.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Settled Auctions</h1>
        <p className="text-gray-300 mb-8">Browse and bid on traditional settled auctions.</p>
        <div className="mb-6 max-w-md mx-auto">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search settled auctions..."
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
        </div>
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
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map(auction => (
              <AuctionCard key={auction.id} auction={auction} actionLabel="Bid Now" />
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No settled auctions found.</div>
        )}
      </div>
    </div>
  );
}

export default SettledAuctionsPage; 
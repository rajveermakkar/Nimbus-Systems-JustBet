import React, { useEffect, useState } from 'react';
import auctionService from '../src/services/auctionService';
import AuctionCard from '../src/components/auctions/AuctionCard';
import Button from '../src/components/Button';
import AuctionFiltersDropdown from '../src/components/auctions/AuctionFiltersDropdown';

function LiveAuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInitialLoading, setShowInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});

  useEffect(() => {
    let intervalId;
    const fetchAuctions = async (isInitial = false) => {
      if (isInitial) setShowInitialLoading(true);
      setError(null);
      try {
        const data = await auctionService.getLiveAuctions();
        setAuctions(data);
      } catch (err) {
        setError('Failed to load live auctions. Please try again.');
      } finally {
        if (isInitial) setShowInitialLoading(false);
      }
    };
    fetchAuctions(true);
    intervalId = setInterval(() => fetchAuctions(false), 7000);
    return () => clearInterval(intervalId);
  }, []);

  const now = new Date();
  const hoursFromNow = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);

  const filtered = auctions.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    // Current Price
    const currentPrice = a.current_highest_bid != null ? a.current_highest_bid : a.starting_price;
    if (filterValues.minCurrentPrice && currentPrice < Number(filterValues.minCurrentPrice)) return false;
    if (filterValues.maxCurrentPrice && currentPrice > Number(filterValues.maxCurrentPrice)) return false;
    // Starting Soon
    if (filterValues.startingSoon && a.start_time) {
      const start = new Date(a.start_time);
      if (!(start > now && start < hoursFromNow(Number(filterValues.startingSoon)))) return false;
    }
    // Ending Soon
    if (filterValues.endingSoon && a.end_time) {
      const end = new Date(a.end_time);
      if (!(end > now && end < hoursFromNow(Number(filterValues.endingSoon)))) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Live Auctions</h1>
        <p className="text-gray-300 mb-8">Join real-time live auctions and bid against others!</p>
        <div className="mb-6 max-w-2xl mx-auto flex items-center gap-2 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search live auctions..."
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
          <AuctionFiltersDropdown
            showCurrentPrice={true}
            showStartingSoon={true}
            showEndingSoon={true}
            values={filterValues}
            onChange={setFilterValues}
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
              <AuctionCard key={auction.id} auction={auction} actionLabel="Join Live Auction" />
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No live auctions found.</div>
        )}
      </div>
    </div>
  );
}

export default LiveAuctionsPage; 
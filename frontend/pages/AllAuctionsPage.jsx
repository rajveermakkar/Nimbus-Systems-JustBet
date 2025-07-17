import React, { useEffect, useState } from 'react';
import auctionService from '../src/services/auctionService';
import AuctionCard from '../src/components/auctions/AuctionCard';
import Button from '../src/components/Button';
import { useRef } from 'react';
import AuctionFiltersDropdown from '../src/components/auctions/AuctionFiltersDropdown';

function AllAuctionsPage() {
  const [liveAuctions, setLiveAuctions] = useState([]);
  const [settledAuctions, setSettledAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInitialLoading, setShowInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const searchTimeout = useRef();
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});

  // Debounce search input
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

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

  // Helper functions for filter logic
  const now = new Date();
  const hoursFromNow = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);

  // Live auctions filtering
  const filteredLive = liveAuctions.filter(a => {
    // Search
    const matchesSearch = a.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      a.description?.toLowerCase().includes(debouncedSearch.toLowerCase());
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

  // Settled auctions filtering
  const filteredSettled = settledAuctions.filter(a => {
    // Search
    const matchesSearch = a.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      a.description?.toLowerCase().includes(debouncedSearch.toLowerCase());
    if (!matchesSearch) return false;
    // Current Price
    const currentPrice = a.current_highest_bid != null ? a.current_highest_bid : a.starting_price;
    if (filterValues.minCurrentPrice && currentPrice < Number(filterValues.minCurrentPrice)) return false;
    if (filterValues.maxCurrentPrice && currentPrice > Number(filterValues.maxCurrentPrice)) return false;
    return true;
  });

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
          <div className="flex-1">
            {/* Search Bar + Filters Button Row */}
            <div className="mb-6 max-w-2xl mx-auto flex items-center gap-2 relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search all auctions..."
                aria-label="Search auctions"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none bg-white/10 text-white placeholder-gray-400 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="ml-2 px-2 py-1 rounded text-gray-300 hover:text-white focus:outline-none"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
              {/* Filters Dropdown Button */}
              <AuctionFiltersDropdown
                showStartingPrice={true}
                showEndingPrice={true}
                showStartingSoon={true}
                showEndingSoon={true}
                values={filterValues}
                onChange={setFilterValues}
              />
            </div>
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
              {filteredLive.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredLive.slice(0, 4).map(auction => (
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
              {filteredSettled.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredSettled.slice(0, 4).map(auction => (
                    <AuctionCard key={auction.id} auction={auction} actionLabel="Bid Now" />
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-center py-8">No settled auctions right now.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AllAuctionsPage; 
import React, { useEffect, useState } from 'react';
import auctionService from '../src/services/auctionService';
import AuctionCard from '../src/components/auctions/AuctionCard';
import Button from '../src/components/Button';
import AuctionFiltersDropdown from '../src/components/auctions/AuctionFiltersDropdown';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function LiveAuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInitialLoading, setShowInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const isMobile = useIsMobile();
  const cardsPerPage = isMobile ? 6 : 12;
  const [page, setPage] = useState(1);

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

  const filtered = auctions.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / cardsPerPage);
  const paginated = filtered.slice((page - 1) * cardsPerPage, page * cardsPerPage);

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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {paginated.map(auction => (
                <AuctionCard key={auction.id} auction={auction} actionLabel="Join Live Auction" />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button
                  className="px-4 py-2 rounded bg-white/10 text-white disabled:opacity-40"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span className="text-white/80 text-sm">Page {page} of {totalPages}</span>
                <button
                  className="px-4 py-2 rounded bg-white/10 text-white disabled:opacity-40"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-400 text-center py-8">No live auctions found.</div>
        )}
      </div>
    </div>
  );
}

export default LiveAuctionsPage; 
import React, { useEffect, useState, useRef } from 'react';
import auctionService from '../src/services/auctionService';
import AuctionCard from '../src/components/auctions/AuctionCard';
import { useNavigate } from 'react-router-dom';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function ClosedAuctionsPage() {
  const [closedAuctions, setClosedAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const searchTimeout = useRef();
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const isMobile = useIsMobile();
  const cardsPerPage = isMobile ? 6 : 12;
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // Debounce search input
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  useEffect(() => {
    async function fetchClosed() {
      setLoading(true);
      setError(null);
      try {
        const closed = await auctionService.getClosedAuctions();
        setClosedAuctions(closed || []);
      } catch (err) {
        setError('Failed to load closed auctions. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchClosed();
  }, []);

  const filteredClosed = closedAuctions.filter(a =>
    a.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    a.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const totalPages = Math.ceil(filteredClosed.length / cardsPerPage);
  const paginatedClosed = filteredClosed.slice((page - 1) * cardsPerPage, page * cardsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Closed Auctions</h1>
        <p className="text-gray-300 mb-8">Browse all completed auctions, their winners, and winning bids.</p>
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 max-w-md mx-auto mb-8">
            <i className="fas fa-exclamation-triangle text-red-400 text-2xl mb-2"></i>
            <span className="text-red-300">{error}</span>
          </div>
        )}
        <div className="mb-6 max-w-md mx-auto flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search closed auctions..."
            aria-label="Search closed auctions"
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
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading closed auctions...</p>
            </div>
          </div>
        ) : filteredClosed.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {paginatedClosed.map(auction => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  actionLabel="View Result"
                  onClick={() => {
                    if (auction.type === 'settled') {
                      navigate(`/auction/settled/${auction.id}`);
                    } else if (auction.type === 'live') {
                      navigate(`/auction/live/${auction.id}`);
                    }
                  }}
                />
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
          <div className="text-gray-400 text-center py-8">No closed auctions yet.</div>
        )}
      </div>
    </div>
  );
}

export default ClosedAuctionsPage; 
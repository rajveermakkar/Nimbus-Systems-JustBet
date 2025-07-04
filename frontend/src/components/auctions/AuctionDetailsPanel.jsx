import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

function AuctionDetailsPanel({ auction, onViewSeller, onBack, onUserClick, winnerLoading }) {
  if (!auction) return null;
  // Winner info
  const winner = auction.winner;
  return (
    <div className="relative w-full h-full flex flex-col p-8">
      <button
        className="absolute top-6 left-6 text-2xl text-white hover:text-blue-400 cursor-pointer"
        onClick={onBack}
        aria-label="Back"
      >
        &#8592;
      </button>
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        <h2 className="text-3xl font-bold mb-8">Auction Details</h2>
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <div className="flex-shrink-0 w-full md:w-64 flex flex-col items-center">
            {auction.image_url ? (
              <img src={auction.image_url} alt="Auction" className="w-full md:w-64 max-h-64 object-contain rounded-xl border border-white/10 bg-black/20" />
            ) : (
              <div className="w-full md:w-64 h-64 flex items-center justify-center bg-black/20 rounded-xl border border-white/10 text-gray-400">No Image</div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-4 text-left">
            <div className="text-2xl font-bold text-white mb-1">{auction.title}</div>
            <div className="text-gray-300 mb-2">{auction.description}</div>
            <div className="flex gap-4 mb-2">
              <span className={`px-3 py-1 rounded font-semibold text-sm ${auction.type === 'live' ? 'bg-red-900/60 text-red-200' : 'bg-blue-900/60 text-blue-200'}`}>{auction.type === 'live' ? 'Live Auction' : 'Settled Auction'}</span>
              <span className="px-3 py-1 rounded bg-blue-900/60 text-blue-200 font-semibold text-sm">{auction.status}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">Seller:</span>
              <span
                className="px-3 py-1 rounded bg-blue-900/60 text-blue-200 font-semibold text-sm cursor-pointer hover:bg-blue-700/80 hover:text-white transition"
                onClick={() => onViewSeller && onViewSeller(auction.seller)}
                title="View Seller Profile"
              >
                {auction.seller.first_name} {auction.seller.last_name}
              </span>
            </div>
            <hr className="border-white/10 my-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><b>Start:</b> {new Date(auction.start_time).toLocaleString()}</div>
              <div><b>End:</b> {new Date(auction.end_time).toLocaleString()}</div>
              <div><b>Starting Price:</b> ${auction.starting_price}</div>
              {auction.reserve_price && <div><b>Reserve Price:</b> ${auction.reserve_price}</div>}
            </div>
            {/* Winner Details */}
            <hr className="border-white/10 my-2" />
            {winnerLoading ? (
              <LoadingSpinner />
            ) : winner ? (
              <div className="bg-green-900/30 rounded-lg p-4 mt-2">
                <div className="font-semibold text-green-300 mb-1">Winner:</div>
                <div className="text-white">
                  <span
                    className="text-green-200 cursor-pointer hover:text-green-400"
                    onClick={() => onUserClick && onUserClick(winner)}
                    title="View Winner Profile"
                  >
                    {winner.first_name} {winner.last_name}
                  </span>
                  {winner.email && <span className="ml-2 text-gray-400">({winner.email})</span>}
                </div>
              </div>
            ) : (
              <div className="text-yellow-300 font-semibold mt-2">No winner (reserve not met or no valid bids)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuctionDetailsPanel; 
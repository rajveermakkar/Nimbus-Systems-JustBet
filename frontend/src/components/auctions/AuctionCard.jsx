import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button';

function AuctionCard({ auction, type = 'settled', actionLabel }) {
  const navigate = useNavigate();

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Calculate time remaining
  const getTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;

    if (diff <= 0) {
      return 'Ended';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Get auction status
  const getAuctionStatus = () => {
    if (type === 'live') {
      const now = new Date();
      const start = new Date(auction.start_time);
      const end = new Date(auction.end_time);

      if (now < start) {
        return { status: 'upcoming', text: 'Upcoming', color: 'bg-blue-500' };
      } else if (now >= start && now <= end) {
        return { status: 'live', text: 'LIVE', color: 'bg-red-500' };
      } else {
        return { status: 'ended', text: 'Ended', color: 'bg-gray-500' };
      }
    } else {
      const now = new Date();
      const end = new Date(auction.end_time);

      if (now > end) {
        return { status: 'ended', text: 'Ended', color: 'bg-gray-500' };
      } else {
        return { status: 'active', text: 'Active', color: 'bg-green-500' };
      }
    }
  };

  const status = getAuctionStatus();
  const timeRemaining = getTimeRemaining(auction.end_time);
  const currentBid = auction.current_highest_bid || auction.starting_price;

  return (
    <div className="bg-white/5 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-w-[220px] max-w-[300px] w-full mx-auto transition-transform hover:scale-[1.025] hover:shadow-2xl">
      {/* Image */}
      <div className="bg-white/10 flex items-center justify-center h-36">
        {auction.image_url ? (
          <img src={auction.image_url} alt={auction.title} className="h-28 w-auto object-contain" />
        ) : (
          <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-white line-clamp-1 text-left mb-2 px-2">{auction.title}</h3>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${status.color}`}>{status.text}</span>
        </div>
        <p className="text-gray-300 text-xs mb-3 line-clamp-2 text-left px-2">{auction.description}</p>
        <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-400 px-2">
          <span className="text-left">Current Bid:</span>
          <span className="text-green-400 font-bold text-left">{formatPrice(currentBid)}</span>
          <span className="text-left">Time Left:</span>
          <span className="text-white font-semibold text-left">{timeRemaining}</span>
          <span className="text-left">Seller:</span>
          <span className="font-semibold text-white text-left">
            {auction.business_name
              || (auction.first_name && auction.last_name ? `${auction.first_name} ${auction.last_name}` : null)
              || auction.seller_name
              || auction.seller
              || auction.email
              || 'Unknown'}
          </span>
          {auction.category && <><span className="text-left">Category:</span><span className="text-white text-left">{auction.category}</span></>}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => {
              if (type === 'live' && status.status === 'live') {
                navigate(`/live-auctions/${auction.id}`);
              } else {
                navigate(`/auctions/${auction.id}`);
              }
            }}
          >
            {actionLabel || (type === 'live' ? (status.status === 'live' ? 'Join Live Auction' : 'View Details') : 'Bid Now')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AuctionCard; 
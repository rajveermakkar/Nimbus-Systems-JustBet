import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button';
import auctionService from '../../services/auctionService';

function AuctionCard({ auction, actionLabel }) {
  const navigate = useNavigate();
  const type = auction.type || 'settled';

  // Format price
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD'
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
    const now = new Date();
    const start = new Date(auction.start_time);
    const end = new Date(auction.end_time);
    if (now < start) {
      return { status: 'upcoming', text: 'Upcoming', color: 'bg-blue-500' };
    } else if (now >= start && now <= end) {
      return { status: 'active', text: 'Active', color: 'bg-green-500' };
    } else {
      return { status: 'ended', text: 'Ended', color: 'bg-gray-500' };
    }
  };

  const status = getAuctionStatus();
  const timeRemaining = getTimeRemaining(auction.end_time);
  const currentBid = auction.current_highest_bid || auction.starting_price;

  // Determine if this is a live auction and if it hasn't started yet
  const isLive = auction.type === 'live';
  const isSettled = auction.type === 'settled';
  const now = Date.now();
  const startTime = new Date(auction.start_time || auction.startTime).getTime();
  const notStarted = (isLive || isSettled) && startTime > now;

  // Countdown for not-yet-started auctions
  const [countdown, setCountdown] = useState(null);
  const [countdownStatus, setCountdownStatus] = useState(null);
  const [loadingCountdown, setLoadingCountdown] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchCountdown() {
      setLoadingCountdown(true);
      try {
        const type = auction.type || 'settled';
        const data = await auctionService.getAuctionCountdown(type, auction.id);
        if (isMounted) {
          setCountdown(data.countdown);
          setCountdownStatus(data.status);
        }
      } catch (e) {
        if (isMounted) {
          setCountdown(null);
          setCountdownStatus(null);
        }
      } finally {
        if (isMounted) setLoadingCountdown(false);
      }
    }
    fetchCountdown();
    const interval = setInterval(fetchCountdown, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [auction.id, auction.type]);

  // Helper to format seconds as HH:MM:SS
  const formatSeconds = (secs) => {
    if (secs == null) return '--:--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
  };

  return (
    <div className="bg-white/5 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-w-[220px] max-w-[300px] w-full mx-auto transition-transform hover:scale-[1.025] hover:shadow-2xl">
      {/* Image */}
      <div className="bg-white/10 flex items-center justify-center h-36 relative">
        {auction.image_url ? (
          <img src={auction.image_url} alt={auction.title} className="h-28 w-auto object-contain" />
        ) : (
          <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
        )}
        {/* Auction type badge in top left */}
        <div className="absolute top-2 left-2 z-10">
          {type === 'live' ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/40 border border-red-400/50 text-red-100 backdrop-blur shadow-sm" style={{fontSize: '11px'}}>Live</span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/40 border border-blue-400/50 text-blue-100 backdrop-blur shadow-sm" style={{fontSize: '11px'}}>Settled</span>
          )}
        </div>
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
          <span className="text-left">{countdownStatus === 'pre' ? 'Starting In:' : countdownStatus === 'ongoing' ? 'Remaining Time:' : 'Time Left:'}</span>
          <span className="text-white font-semibold text-left">
            {formatSeconds(countdown)}
          </span>
          <span className="text-left">Seller:</span>
          <span className="font-semibold text-white text-left">
            {auction.seller
              ? `${auction.seller.first_name} ${auction.seller.last_name}${auction.seller.business_name ? ` (${auction.seller.business_name})` : ''}`
              : auction.email || 'Unknown'}
          </span>
          {auction.category && <><span className="text-left">Category:</span><span className="text-white text-left">{auction.category}</span></>}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          {actionLabel && (
            <div className="mt-4 flex flex-col gap-2">
              {countdownStatus === 'pre' ? (
                <Button
                  variant="secondary"
                  className="w-full opacity-80 cursor-not-allowed"
                  disabled
                >
                  <span>Starting In:</span>
                  <span className="ml-2 font-mono tabular-nums">{formatSeconds(countdown)}</span>
                </Button>
              ) : countdownStatus === 'ongoing' ? (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate(`/auction/${type}/${auction.id}`)}
                >
                  Join Auction
                  <span className="ml-2 text-xs text-yellow-200 font-mono"></span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate(`/auction/${type}/${auction.id}`)}
                >
                  {actionLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuctionCard; 
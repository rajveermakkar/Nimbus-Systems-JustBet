import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import auctionService from '../src/services/auctionService';
import BidHistory from '../src/components/auctions/BidHistory';
import Button from '../src/components/Button';
import EndpointSVG from './assets/Endpoint-amico.svg';

function EndedAuctionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAuction() {
      setLoading(true);
      setError(null);
      try {
        const data = await auctionService.getLiveAuction(id);
        if (data.status !== 'closed') {
          setError('This auction is not ended.');
          setAuction(null);
        } else {
          setAuction(data);
          // Fetch bid history
          try {
            const res = await fetch(`/api/live-auctions/${id}/bids`);
            if (res.ok) {
              const bidData = await res.json();
              setBids(bidData.bids || []);
            } else {
              setBids([]);
            }
          } catch {
            setBids([]);
          }
        }
      } catch (err) {
        setError('Failed to load auction. Please try again.');
        setAuction(null);
      } finally {
        setLoading(false);
      }
    }
    fetchAuction();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
        <div className="flex flex-col items-center w-full" style={{ marginBottom: '1.2rem'}}>
          <img src={EndpointSVG} alt="Auction Ended" className="w-full max-w-xs h-auto" style={{maxWidth: '320px', marginBottom: '0.5rem'}} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Auction Not Found</h1>
        <p className="text-white/80 mb-6 text-center max-w-md mx-auto">{error || 'This auction does not exist or is not ended.'}</p>
        <Button
          variant="primary"
          onClick={() => navigate('/live-auctions')}
          className="mx-auto"
        >
          Back to Live Auctions
        </Button>
      </div>
    );
  }

  // Map backend bid fields to BidHistory expected fields
  const mappedBids = bids.slice(0, 10).map(bid => ({
    ...bid,
    first_name: bid.user_name ? bid.user_name.split(' ')[0] : '',
    last_name: bid.user_name ? bid.user_name.split(' ').slice(1).join(' ') : '',
    email: bid.user_id || '',
  }));

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4 py-8">
      <div className="flex flex-col items-center w-full" style={{ marginBottom: '1.2rem'}}>
        <img src={EndpointSVG} alt="Auction Ended" className="w-full max-w-xs h-auto" style={{maxWidth: '320px', marginBottom: '0.5rem'}} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">This auction has ended</h1>
      <p className="text-white/80 mb-6 text-center max-w-md mx-auto">Bidding is now closed. See the final details and bid history below.</p>
      <div className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Auction Info */}
        <div className="rounded-lg bg-white/10 shadow p-4 flex flex-col items-center">
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              className="max-h-48 w-auto rounded object-contain mb-4"
            />
          ) : (
            <div className="w-full h-36 flex items-center justify-center mb-4">
              <i className="fa-solid fa-image text-gray-400 text-4xl"></i>
            </div>
          )}
          <h2 className="text-lg font-bold mb-1 text-center">{auction.title}</h2>
          <div className="mb-1 text-xs text-gray-300 text-center">
            Seller: <span className="font-semibold text-white">{auction.business_name || `${auction.first_name} ${auction.last_name}` || auction.email || 'Unknown'}</span>
          </div>
          <div className="text-sm text-gray-200 whitespace-pre-line text-center mt-2">
            {auction.description}
          </div>
          <div className="mt-4 text-base font-semibold text-red-400">Auction Ended</div>
          <div className="text-xs text-gray-400 mt-1">Ended at: {new Date(auction.end_time).toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Final Bid: <span className="text-green-400 font-bold">{auction.current_highest_bid ? `$${auction.current_highest_bid}` : 'No bids'}</span></div>
        </div>
        {/* Bid History */}
        <div className="rounded-lg bg-white/10 shadow p-4">
          <h3 className="text-base font-semibold mb-3 text-left">Bid History</h3>
          <BidHistory auctionId={id} type="live" bids={mappedBids} />
        </div>
      </div>
      <Button
        variant="primary"
        onClick={() => navigate('/live-auctions')}
        className="mx-auto"
      >
        Back to Live Auctions
      </Button>
    </div>
  );
}

export default EndedAuctionPage; 
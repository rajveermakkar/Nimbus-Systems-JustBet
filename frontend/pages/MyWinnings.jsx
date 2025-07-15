import React, { useEffect, useState } from 'react';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import { useNavigate } from 'react-router-dom';
import apiService from '../src/services/apiService';
import LoadingSpinner from '../src/components/LoadingSpinner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const STATUS_LABELS = {
  under_process: 'Under Process',
  shipped: 'Shipped',
  delivered: 'Delivered'
};

function MyWinnings() {
  const [winnings, setWinnings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [page, setPage] = useState(1); // For mobile pagination
  const navigate = useNavigate();

  // Pagination settings
  const CARDS_PER_PAGE = 3;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const totalPages = isMobile ? Math.ceil(winnings.length / CARDS_PER_PAGE) : 1;
  const paginatedWinnings = isMobile
    ? winnings.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE)
    : winnings;

  useEffect(() => {
    fetchWinningsAndOrders();
  }, []);

  async function fetchWinningsAndOrders() {
    setLoading(true);
    try {
      // Fetch all winnings
      const winningsData = await apiService.get('/api/auth/winnings');
      const winningsArr = Array.isArray(winningsData.winnings) ? winningsData.winnings : [];
      setWinnings(winningsArr);
      // Fetch all orders for this user
      const ordersArr = await apiService.get('/api/orders/winner');
      setOrders(Array.isArray(ordersArr) ? ordersArr : []);
    } catch (err) {
      setToast({ show: true, message: 'Failed to load winnings', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  // Map orders by auction_id for quick lookup
  const ordersByAuction = {};
  for (const order of orders) {
    ordersByAuction[order.auction_id] = order;
  }

  // Format price
  const formatPrice = (price) => {
    if (!price && price !== 0) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CAD'
    }).format(price);
  };

  if (loading) {
    return <LoadingSpinner message="Loading your winnings..." />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-8">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(t => ({ ...t, show: false }))}
        />
      )}
      <div className="w-full max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">My Winnings</h2>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : winnings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">You have not won any auctions yet.</div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(isMobile ? paginatedWinnings : winnings).map(win => {
              const order = ordersByAuction[win.auction_id];
              let buttonLabel = 'Enter Shipping Details';
              if (order) {
                if (order.status === 'shipped' || order.status === 'delivered') {
                  buttonLabel = 'View Order Status';
                } else if (order.status === 'under_process') {
                  buttonLabel = 'View/Update Shipping';
                }
              }
              return (
                <div
                  key={win.auction_id}
                  className="backdrop-blur-md bg-white/10 rounded-2xl shadow-lg p-0 flex flex-col overflow-hidden hover:scale-[1.025] transition-transform duration-200 relative w-[90%] mx-auto md:w-auto md:mx-0"
                >
                  {win.image_url && (
                    <div className="relative w-full h-48">
                      <img
                        src={win.image_url}
                        alt={win.title}
                        className="w-full h-48 object-cover object-center bg-[#23235b]"
                      />
                      <span
                        className={`absolute top-2 left-2 px-2 py-1 rounded font-semibold text-xs ${win.auction_type === 'live' ? 'bg-red-900/60 text-red-200' : 'bg-blue-900/60 text-blue-200'}`}
                        title={win.auction_type === 'live' ? 'Live Auction' : 'Settled Auction'}
                      >
                        {win.auction_type === 'live' ? 'Live' : 'Settled'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col p-6 gap-2">
                    <div className="font-bold text-xl mb-1 truncate" title={win.title}>{win.title}</div>
                    <div className="text-gray-300 text-sm mb-1">Seller: <span className="text-white font-semibold">{win.seller_name}</span></div>
                    <div className="text-gray-300 text-sm mb-1">End Time: <span className="text-white">{new Date(win.end_time).toLocaleString()}</span></div>
                    <div className="text-gray-300 text-sm mb-1">Winning Bid: <span className="text-green-400 font-bold">{formatPrice(win.final_bid)}</span></div>
                    {order && (
                      <div className="text-gray-300 text-xs mb-1">
                        <span className="font-semibold text-white">Shipping:</span> {order.shipping_address}, {order.shipping_city}, {order.shipping_state}, {order.shipping_postal_code}, {order.shipping_country}
                      </div>
                    )}
                    <div className="text-gray-300 text-sm mb-1">Status: <span className="font-bold text-white">{order ? (STATUS_LABELS[order.status] || order.status) : 'Not Claimed'}</span></div>
                    <div className="flex justify-center mt-4">
                      <Button className="w-fit" onClick={() => navigate(`/winning/${win.auction_id}`, { state: { auctionType: win.auction_type } })}>{buttonLabel}</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mobile Pagination Controls */}
          {isMobile && totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
}

export default MyWinnings; 
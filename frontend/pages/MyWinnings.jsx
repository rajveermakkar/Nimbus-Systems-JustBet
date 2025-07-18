import React, { useEffect, useState } from 'react';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import { useNavigate } from 'react-router-dom';
import apiService from '../src/services/apiService';
import LoadingSpinner from '../src/components/LoadingSpinner';
import { FcDiploma1 } from "react-icons/fc";
import { LiaFileInvoiceDollarSolid } from "react-icons/lia";

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
  const CARDS_PER_PAGE = typeof window !== 'undefined' && window.innerWidth < 768 ? 3 : 8;
  const totalPages = Math.ceil(winnings.length / CARDS_PER_PAGE);
  const paginatedWinnings = winnings.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);

  useEffect(() => {
    fetchWinningsAndOrders();
  }, []);

  // Fetch invoice and certificate URLs for an order
  async function fetchOrderPdfs(orderId) {
    try {
      const [invoiceRes, certRes] = await Promise.all([
        apiService.get(`/api/orders/${orderId}/invoice`),
        apiService.get(`/api/orders/${orderId}/certificate`)
      ]);
      return {
        invoiceUrl: invoiceRes.url,
        certificateUrl: certRes.url
      };
    } catch (err) {
      return { invoiceUrl: null, certificateUrl: null };
    }
  }

  async function fetchWinningsAndOrders() {
    setLoading(true);
    try {
      // Fetch all winnings
      const winningsData = await apiService.get('/api/auth/winnings');
      const winningsArr = Array.isArray(winningsData.winnings) ? winningsData.winnings : [];
      setWinnings(winningsArr);
      // Fetch all orders for this user
      const ordersArr = await apiService.get('/api/orders/winner');
      // For each order, fetch invoice/certificate URLs
      const ordersWithPdfs = await Promise.all(
        ordersArr.map(async (order) => {
          const pdfs = await fetchOrderPdfs(order.id);
          return { ...order, ...pdfs };
        })
      );
      setOrders(Array.isArray(ordersWithPdfs) ? ordersWithPdfs : []);
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
      <div className="w-full max-w-7xl mx-auto px-2">
        <h2 className="text-3xl font-bold mb-8 text-center">My Winnings</h2>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : winnings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">You have not won any auctions yet.</div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedWinnings.map(win => {
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
                  className="backdrop-blur-md bg-white/10 rounded-2xl shadow-lg p-0 flex flex-col overflow-hidden hover:scale-[1.025] transition-transform duration-200 relative w-full"
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
                  <div className="flex-1 flex flex-col p-4 gap-2">
                    <div className="font-bold text-base mb-1 truncate" title={win.title}>{win.title}</div>
                    <div className="text-gray-300 text-xs mb-1">Seller: <span className="text-white font-semibold">{
                      win.seller?.business_name
                        || (win.seller?.first_name && win.seller?.last_name
                          ? `${win.seller.first_name} ${win.seller.last_name}`
                          : 'Not available')
                    }</span></div>
                    <div className="text-gray-300 text-xs mb-1">End Time: <span className="text-white">{new Date(win.end_time).toLocaleString()}</span></div>
                    <div className="text-gray-300 text-xs mb-1">Winning Bid: <span className="text-green-400 font-bold">{formatPrice(win.final_bid)}</span></div>
                    {order && (
                      <div className="text-gray-300 text-xs mb-1">
                        <span className="font-semibold text-white">Shipping:</span> {order.shipping_address}, {order.shipping_city}, {order.shipping_state}, {order.shipping_postal_code}, {order.shipping_country}
                      </div>
                    )}
                    <div className="text-gray-300 text-xs mb-1">Status: <span className="font-bold text-white">{order ? (STATUS_LABELS[order.status] || order.status) : 'Not Claimed'}</span></div>
                    {!order && (
                      <div className="text-yellow-300 text-xs mb-1 italic">Invoice and certificate will be available after claiming your order.</div>
                    )}
                    <div className="flex justify-center mt-4 gap-2">
                      <Button className="w-fit text-xs px-4 py-2" onClick={() => navigate(`/winning/${win.auction_id}`, { state: { auctionType: win.auction_type } })}>{buttonLabel}</Button>
                      {order && order.invoiceUrl && (
                        <a
                          href={order.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 flex items-center justify-center w-9 h-9 rounded-full bg-white text-black text-lg shadow hover:bg-gray-200 transition"
                          title="Download Invoice PDF"
                        >
                          <LiaFileInvoiceDollarSolid />
                        </a>
                      )}
                      {order && order.certificateUrl && (
                        <a
                          href={order.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 flex items-center justify-center w-9 h-9 rounded-full bg-purple-500 text-white text-lg shadow hover:bg-purple-600 transition"
                          title="Download Ownership Certificate PDF"
                        >
                          <FcDiploma1 />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >Prev</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`px-3 py-1 rounded ${page === i + 1 ? 'bg-purple-500 text-white' : 'bg-white/10 text-white hover:bg-purple-400/30'} transition`}
                  onClick={() => setPage(i + 1)}
                >{i + 1}</button>
              ))}
              <button
                className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-40"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >Next</button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

export default MyWinnings; 
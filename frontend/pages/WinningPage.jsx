import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import BidHistory from '../src/components/auctions/BidHistory';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faEnvelope, faTrash } from '@fortawesome/free-solid-svg-icons';
import Modal from '../src/components/Modal';
import LoadingSpinner from '../src/components/LoadingSpinner';
import apiService from '../src/services/apiService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan"
];

const CARD_STYLE = "rounded-2xl shadow-xl bg-white/10 backdrop-blur-lg border border-white/20 max-w-lg w-full";

function WinningPage() {
  const { auctionId } = useParams();
  const location = useLocation();
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [form, setForm] = useState({ address: '', city: '', province: '', postal_code: '' });
  const [submitted, setSubmitted] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [error, setError] = useState(null);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [profile, setProfile] = useState(null);
  const [useProfileAddress, setUseProfileAddress] = useState(false);
  const [showEditAddress, setShowEditAddress] = useState(false);

  // Try to get auction type from location state (passed from MyWinnings), fallback to 'settled'
  const auctionType = location.state?.auctionType || location.state?.type || location.state?.auction_type || 'settled';

  const canEditShipping = order && (order.status === 'under_process' || !order.status);
  const isShipped = order && order.status === 'shipped';
  const isDelivered = order && order.status === 'delivered';

  useEffect(() => {
    fetchOrderAndAuction();
    fetchProfileAddress();
    // eslint-disable-next-line
  }, [auctionId]);

  async function fetchOrderAndAuction() {
    setLoading(true);
    setError(null);
    try {
      // Fetch winner's orders
      console.log('[WinningPage] Fetching orders for user...');
      const orders = await apiService.get('/api/orders/winner');
      console.log('[WinningPage] Orders fetched:', orders);
      const thisOrder = orders.find(o => o.auction_id === auctionId);
      setOrder(thisOrder || null);
      // Don't set notAuthorized here; wait for auction fetch

      // Determine auction type (try both if needed)
      let type = auctionType;
      let auctionData = null;
      let bidsData = [];
      // Try settled first if type is unknown
      if (type === 'settled' || !type) {
        console.log(`[WinningPage] Fetching settled auction: /api/auctions/settled/${auctionId}`);
        try {
          auctionData = await apiService.get(`/api/auctions/settled/${auctionId}`);
          console.log('[WinningPage] Settled auction data:', auctionData);
          if (auctionData.auction) auctionData = auctionData.auction;
          type = 'settled';
          const bidsJson = await apiService.get(`/api/auctions/settled/${auctionId}/bids`);
          console.log('[WinningPage] Settled bids data:', bidsJson);
          bidsData = Array.isArray(bidsJson.bids) ? bidsJson.bids : [];
        } catch (err) {
          console.log('[WinningPage] Settled auction not found, trying live auction');
        }
      }
      // If not found, try live
      if (!auctionData) {
        console.log(`[WinningPage] Fetching live auction: /api/auctions/live/${auctionId}`);
        try {
          auctionData = await apiService.get(`/api/auctions/live/${auctionId}`);
          console.log('[WinningPage] Live auction data:', auctionData);
          if (auctionData.auction) auctionData = auctionData.auction;
          type = 'live';
          const bidsJson = await apiService.get(`/api/auctions/live/${auctionId}/bids`);
          console.log('[WinningPage] Live bids data:', bidsJson);
          bidsData = Array.isArray(bidsJson.bids) ? bidsJson.bids : [];
        } catch (err) {
          console.log('[WinningPage] Live auction not found');
        }
      }
      if (!auctionData) {
        setError('Auction not found or you do not have access.');
        setAuction(null);
        setBids([]);
        console.log('[WinningPage] Auction not found or access denied for auctionId', auctionId);
        return;
      }
      setAuction({ ...auctionData, type });
      setBids(bidsData);
      // If order has shipping, prefill form
      if (thisOrder && thisOrder.shipping_address) {
        setForm({
          address: thisOrder.shipping_address,
          city: thisOrder.shipping_city,
          province: thisOrder.shipping_state,
          postal_code: thisOrder.shipping_postal_code
        });
      }
      // Winner check: only set notAuthorized if user is not the winner
      let winnerId = auctionData.winner_id || auctionData.current_highest_bidder_id || (auctionData.winner && auctionData.winner.id);
      if (!thisOrder && user && winnerId && user.id !== winnerId) {
        setNotAuthorized(true);
        console.log('[WinningPage] Not authorized: user is not the winner. user.id:', user.id, 'winnerId:', winnerId);
      }
    } catch (err) {
      setError('Failed to load order/auction details.');
      setAuction(null);
      setBids([]);
      console.log('[WinningPage] Exception thrown:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfileAddress() {
    try {
      const data = await apiService.get('/api/user/profile');
      setProfile(data);
    } catch (err) {
      // ignore
    }
  }

  // Prefill shipping form with profile address if no order and profile exists
  useEffect(() => {
    if (!order && profile && profile.address) {
      setForm({
        address: profile.address || '',
        city: profile.city || '',
        province: profile.state || '',
        postal_code: profile.postal_code || ''
      });
      setUseProfileAddress(true);
    }
  }, [order, profile]);

  function validate() {
    if (!form.address?.trim()) return 'Address is required.';
    if (!form.city?.trim()) return 'City is required.';
    if (!form.province?.trim() || !CANADA_PROVINCES.includes(form.province)) return 'Select a valid province.';
    if (!form.postal_code?.trim()) return 'Postal code is required.';
    if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/i.test(form.postal_code.trim())) {
      return 'Enter a valid Canadian postal code (e.g., K1A 0B1)';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setToast({ show: true, message: err, type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/api/orders', {
        auction_id: auctionId,
        auction_type: auction.type || 'settled',
        shipping_address: form.address,
        shipping_city: form.city,
        shipping_state: form.province,
        shipping_postal_code: form.postal_code,
        shipping_country: 'Canada'
      });
      setSubmitted(true);
      setToast({ show: true, message: 'Order claimed successfully! The seller will be notified and will ship your item soon.', type: 'success' });
    } catch (err) {
      setToast({ show: true, message: 'Failed to submit shipping details', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // Helper to get seller info robustly
  const getSellerInfo = () => {
    if (!auction) return { name: 'Unknown', email: '' };
    if (auction.seller_email) return { name: auction.seller_name || auction.business_name || `${auction.first_name || ''} ${auction.last_name || ''}`.trim(), email: auction.seller_email };
    if (auction.seller && (auction.seller.email || auction.seller.first_name)) {
      return {
        name: auction.seller.business_name || `${auction.seller.first_name || ''} ${auction.seller.last_name || ''}`.trim(),
        email: auction.seller.email || ''
      };
    }
    return { name: auction.business_name || auction.seller_name || `${auction.first_name || ''} ${auction.last_name || ''}`.trim(), email: auction.email || '' };
  };

  function handleSelectProfileAddress() {
    if (profile) {
      setForm({
        address: profile.address || '',
        city: profile.city || '',
        province: profile.state || '',
        postal_code: profile.postal_code || ''
      });
      setUseProfileAddress(true);
      setShowEditAddress(false);
    }
  }

  function handleEditAddress() {
    setShowEditAddress(true);
    setUseProfileAddress(false);
  }

  async function handleSaveAddress(e) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setToast({ show: true, message: err, type: 'error' });
      return;
    }
    setSaving(true);
          try {
        // Save to user_profiles
        await apiService.patch('/api/user/profile', {
          address: form.address,
          city: form.city,
          state: form.province,
          postal_code: form.postal_code,
          country: 'Canada'
        });
        setToast({ show: true, message: 'Address saved to profile!', type: 'success' });
        fetchProfileAddress();
        setShowEditAddress(false);
        setUseProfileAddress(true);
      } catch (err) {
        setToast({ show: true, message: 'Failed to save address', type: 'error' });
      } finally {
        setSaving(false);
      }
  }

  async function handleDeleteAddress() {
    setSaving(true);
    try {
      await apiService.patch('/api/user/profile', {
        address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Canada'
      });
      setToast({ show: true, message: 'Address deleted!', type: 'success' });
      fetchProfileAddress();
    } catch (err) {
      setToast({ show: true, message: 'Failed to delete address', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="bg-white/10 p-8 rounded-xl flex flex-col items-center">
          <i className="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4"></i>
          <p className="text-white text-lg font-semibold mb-2">Auction Not Found</p>
          <p className="text-gray-300 text-center">Auction not found or you do not have access to this page.</p>
          <Button className="mt-6" onClick={() => navigate('/my-winnings')}>Back to My Winnings</Button>
        </div>
      </div>
    );
  }

  if (notAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="bg-white/10 p-8 rounded-xl flex flex-col items-center">
          <i className="fa-solid fa-lock text-4xl text-red-400 mb-4"></i>
          <p className="text-white text-lg font-semibold mb-2">Not Authorized</p>
          <p className="text-gray-300 text-center">You are not the winner of this auction or do not have access to this page.</p>
          <Button className="mt-6" onClick={() => navigate('/my-winnings')}>Back to My Winnings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-start justify-start py-10 px-2 bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(t => ({ ...t, show: false }))}
        />
      )}
      <div className="w-full max-w-6xl mx-auto">
        {/* Green glassy Congratulations card */}
        <div className="w-full flex justify-center">
          <div className="bg-green-500/20 backdrop-blur rounded-xl shadow border border-green-300/30 py-2 px-4 mb-4 w-full max-w-xl mx-auto">
            <h1 className="text-base md:text-lg font-extrabold text-center flex items-center justify-center gap-2">
              <span role="img" aria-label="trophy">🏆</span> Congratulations on winning!
            </h1>
          </div>
        </div>
        {/* Main content: 2 columns on desktop, stacked on mobile */}
        <div className="flex flex-col md:flex-row gap-6 w-full items-start">
          {/* Left: Product info and shipping */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {/* Product Info */}
            <section>
              {auction && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-xl md:text-2xl font-bold text-left mb-1">{auction.title}</h2>
                  <img src={auction.image_url} alt={auction.title} className="w-56 h-56 object-contain rounded-xl border border-white/10 self-start" />
                  <div className="text-gray-200 mb-1 text-left">{auction.description}</div>
                  <div className="text-base mb-1 text-left">Final Price: <span className="text-green-300 font-bold">${auction.current_highest_bid || auction.final_bid}</span></div>
                  <div className="text-base mb-1 text-left">Type: <span className="font-semibold capitalize">{auction.type || 'settled'}</span></div>
                  <div className="text-base flex items-center gap-2 text-left">Seller: <span className="font-semibold">{getSellerInfo().name}</span>
                    {getSellerInfo().email && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-3 px-3 py-1 text-xs font-semibold"
                        as="a"
                      >
                        <a
                          href={`mailto:${getSellerInfo().email}?subject=Order%20Inquiry%20for%20${encodeURIComponent(auction.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white"
                        >
                          Contact Seller
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
            {/* Divider */}
            <hr className="my-3 border-white/10" />
            {/* Shipping Address / Order Status */}
            <section>
              <h3 className="text-lg font-bold mb-2">
                {isShipped || isDelivered ? 'Order Status' : 'Shipping Address'}
              </h3>
              
              {/* Show shipped/delivered status */}
              {isShipped && (
                <div className="bg-blue-500/20 backdrop-blur rounded-xl shadow border border-blue-300/30 p-4 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fa-solid fa-shipping-fast text-blue-400 text-xl"></i>
                    <span className="text-blue-300 font-semibold">Order has been shipped to:</span>
                  </div>
                  <div className="text-white text-sm text-left">
                    <p className="font-semibold">{order.shipping_address}</p>
                    <p>{order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}</p>
                    <p>{order.shipping_country}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-400/30">
                    <p className="text-blue-200 text-xs mb-2">
                      <i className="fa-solid fa-info-circle mr-1"></i>
                      Shipping address cannot be changed after seller ships the order.
                    </p>
                    <p className="text-blue-200 text-xs">
                      <i className="fa-solid fa-envelope mr-1"></i>
                      For any issues or complaints, contact the seller.
                    </p>
                  </div>
                </div>
              )}

              {isDelivered && (
                <div className="bg-green-500/20 backdrop-blur rounded-xl shadow border border-green-300/30 p-4 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <i className="fa-solid fa-check-circle text-green-400 text-xl"></i>
                    <span className="text-green-300 font-semibold">Order has been delivered to:</span>
                  </div>
                  <div className="text-white text-sm text-left">
                    <p className="font-semibold">{order.shipping_address}</p>
                    <p>{order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}</p>
                    <p>{order.shipping_country}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-green-400/30">
                    <p className="text-green-200 text-xs mb-2">
                      <i className="fa-solid fa-info-circle mr-1"></i>
                      Shipping address cannot be changed after seller ships the order.
                    </p>
                    <p className="text-green-200 text-xs">
                      <i className="fa-solid fa-envelope mr-1"></i>
                      For any issues or complaints, contact the seller.
                    </p>
                  </div>
                </div>
              )}

              {/* Show success message after order submission */}
              {submitted && (
                <div className="bg-green-500/20 backdrop-blur rounded-xl shadow border border-green-300/30 p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <i className="fa-solid fa-check-circle text-green-400 text-xl"></i>
                    <span className="text-green-300 font-semibold">Order Claimed Successfully!</span>
                  </div>
                  <div className="text-white text-sm text-left space-y-2">
                    <p><i className="fa-solid fa-info-circle mr-2 text-green-200"></i>Your order has been submitted and the seller has been notified.</p>
                    <p><i className="fa-solid fa-clock mr-2 text-green-200"></i>The seller will process your order and ship it within 2-3 business days.</p>
                    <p><i className="fa-solid fa-envelope mr-2 text-green-200"></i>You will receive email updates about your order status.</p>
                    <p><i className="fa-solid fa-map-marker-alt mr-2 text-green-200"></i>Shipping address: {form.address}, {form.city}, {form.province} {form.postal_code}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-green-400/30">
                    <p className="text-green-200 text-xs">
                      <i className="fa-solid fa-phone mr-1"></i>
                      Need help? Contact the seller or our support team.
                    </p>
                  </div>
                </div>
              )}

              {/* Show shipping form only if order is not shipped/delivered and not just submitted */}
              {!isShipped && !isDelivered && !submitted && (
                <>
                  {profile && profile.address ? (
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-base">{profile.address}</div>
                        <div className="text-sm text-gray-200">{profile.city}, {profile.state}, {profile.postal_code}, Canada</div>
                      </div>
                      <button className="text-blue-300 hover:text-blue-100 transition text-xl hover:scale-110 focus:outline-none" onClick={handleEditAddress} title="Edit Address" aria-label="Edit Address">
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button className="text-red-400 hover:text-red-200 transition text-xl hover:scale-110 focus:outline-none" onClick={handleDeleteAddress} title="Delete Address" aria-label="Delete Address">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 mb-2 text-green-400 hover:text-green-200 transition text-base font-semibold focus:outline-none"
                      onClick={() => setShowEditAddress(true)}
                      title="Add Address"
                      type="button"
                    >
                      <FontAwesomeIcon icon={faPlus} className="text-2xl" />
                      <span>Add a shipping address</span>
                    </button>
                  )}
                  <Modal open={showEditAddress} onClose={() => setShowEditAddress(false)} title={profile && profile.address ? 'Edit Address' : 'Add Address'}>
                    <form onSubmit={handleSaveAddress} className="space-y-4 w-full animate-fade-in">
                      <div>
                        <label className="block text-xs mb-1 text-left">Address *</label>
                        <input type="text" name="address" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:border-blue-400 text-base" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, Apt, etc." />
                      </div>
                      <div>
                        <label className="block text-xs mb-1 text-left">City *</label>
                        <input type="text" name="city" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:border-blue-400 text-base" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                      </div>
                      <div>
                        <label className="block text-xs mb-1 text-left">Province *</label>
                        <select name="province" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-blue-400 text-base" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}>
                          <option value="">Select Province</option>
                          {CANADA_PROVINCES.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs mb-1 text-left">Postal Code *</label>
                        <input type="text" name="postal_code" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:border-blue-400 text-base" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} placeholder="K1A 0B1" />
                      </div>
                      <div className="flex justify-end mt-4 gap-2">
                        <Button type="submit" disabled={saving} className="px-6 py-2 text-base font-bold">
                          {saving ? 'Saving...' : 'Save Address'}
                        </Button>
                        <Button type="button" className="px-6 py-2 text-base font-bold bg-gray-500/60 hover:bg-gray-600/80" onClick={() => setShowEditAddress(false)}>Cancel</Button>
                      </div>
                    </form>
                  </Modal>
                  <Button
                    type="button"
                    className="w-full mt-6"
                    disabled={!(form.address && form.city && form.province && form.postal_code && !showEditAddress)}
                    onClick={handleSubmit}
                  >
                    Claim Order
                  </Button>
                </>
              )}
            </section>
          </div>
          {/* Right: Bid History */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 mt-0 md:mt-2">
            <section>
                {/* Only one card, not nested */}
                <BidHistory auctionId={auctionId} type={auction?.type || 'settled'} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WinningPage; 
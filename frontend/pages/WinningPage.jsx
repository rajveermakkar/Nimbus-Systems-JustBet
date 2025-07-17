import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../src/context/UserContext';
import Button from '../src/components/Button';
import Toast from '../src/components/Toast';
import BidHistory from '../src/components/auctions/BidHistory';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faEnvelope, faTrash, faDownload, faFileInvoice, faCertificate, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import Modal from '../src/components/Modal';
import LoadingSpinner from '../src/components/LoadingSpinner';
import apiService from '../src/services/apiService';
import Select from 'react-select';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan"
];
const CANADA_CITIES = {
  "Alberta": ["Calgary", "Edmonton", "Red Deer", "Lethbridge", "St. Albert"],
  "British Columbia": ["Vancouver", "Victoria", "Surrey", "Burnaby", "Richmond"],
  "Manitoba": ["Winnipeg", "Brandon", "Steinbach", "Thompson", "Portage la Prairie"],
  "New Brunswick": ["Moncton", "Saint John", "Fredericton", "Dieppe", "Miramichi"],
  "Newfoundland and Labrador": ["St. John's", "Mount Pearl", "Corner Brook", "Conception Bay South", "Paradise"],
  "Nova Scotia": ["Halifax", "Sydney", "Dartmouth", "Truro", "New Glasgow"],
  "Ontario": ["Toronto", "Ottawa", "Mississauga", "Brampton", "Hamilton"],
  "Prince Edward Island": ["Charlottetown", "Summerside", "Stratford", "Cornwall", "Montague"],
  "Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau", "Longueuil"],
  "Saskatchewan": ["Saskatoon", "Regina", "Prince Albert", "Moose Jaw", "Yorkton"]
};

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
  const [pdfUrls, setPdfUrls] = useState({ invoiceUrl: null, certificateUrl: null });

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

  // Fetch PDF URLs when order is loaded
  useEffect(() => {
    async function fetchPdfs() {
      if (order && order.id) {
        try {
          const [invoiceRes, certRes] = await Promise.all([
            apiService.get(`/api/orders/${order.id}/invoice`),
            apiService.get(`/api/orders/${order.id}/certificate`)
          ]);
          setPdfUrls({
            invoiceUrl: invoiceRes.url,
            certificateUrl: certRes.url
          });
        } catch {
          setPdfUrls({ invoiceUrl: null, certificateUrl: null });
        }
      } else {
        setPdfUrls({ invoiceUrl: null, certificateUrl: null });
      }
    }
    fetchPdfs();
  }, [order]);

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
    if (!form.city?.trim() || !CANADA_CITIES[form.province]?.includes(form.city)) return 'Select a valid city.';
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
      // Auto-refresh after 3 seconds to fetch new certificate/invoice links
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      setToast({ show: true, message: 'Failed to submit shipping details', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // Helper to get seller info robustly
  const getSellerInfo = () => {
    if (!auction) return { name: 'Not available', email: '' };
    if (auction.seller && (auction.seller.business_name || auction.seller.first_name)) {
      return {
        name: auction.seller.business_name || `${auction.seller.first_name || ''} ${auction.seller.last_name || ''}`.trim(),
        email: auction.seller.email || ''
      };
    }
    // fallback for legacy data
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

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

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
    <div className="min-h-screen flex flex-col items-center justify-start py-10 px-2 bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white md:items-start">
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
        <div className={isMobile ? "w-full flex justify-center items-center" : "w-full flex justify-center"}>
          <div className="bg-green-500/20 backdrop-blur rounded-xl shadow border border-green-300/30 py-2 px-4 mb-4 w-full max-w-xl mx-auto">
            <h1 className="text-base md:text-lg font-extrabold text-center flex items-center justify-center gap-2 md:text-left">              <span role="img" aria-label="trophy">🏆</span> Congratulations on winning!
            </h1>
          </div>
        </div>
        {/* Main content: 2 columns on desktop, stacked on mobile */}
        <div className="flex flex-col gap-6 w-full items-center md:flex-row md:items-start">
          {/* Left: Product info and shipping */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 items-center w-full md:items-start">
            {/* Product Info */}
            <section>
              {auction && (
                <div className={isMobile ? "flex flex-col gap-4 items-center text-center" : "flex flex-col gap-4"}>
                  <h2 className="text-xl md:text-2xl font-bold text-center mb-1 md:text-left">{auction.title}</h2>
                  <img src={auction.image_url} alt={auction.title} className="w-56 h-56 object-contain rounded-xl border border-white/10 mx-auto md:mx-0 md:self-start" />



                  <div className="text-gray-200 mb-1 text-center md:text-left">{auction.description}</div>

                  <div className="text-base mb-1 text-center md:text-left">Final Price: <span className="text-green-300 font-bold">${auction.current_highest_bid || auction.final_bid}</span></div>
                  <div className="text-base mb-1 text-center md:text-left">Type: <span className="font-semibold capitalize">{auction.type || 'settled'}</span></div>


                  <div className="text-base flex flex-col items-center gap-2 text-center md:flex-row md:items-center md:text-left">Seller: <span className="font-semibold">{getSellerInfo().name}</span>
                    {getSellerInfo().email && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-0 mt-2 px-3 py-1 text-xs font-semibold md:ml-3 md:mt-0"


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
              {!order && (
                // Show shipping form, edit/delete/claim UI here
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
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-white/20">
                        <form onSubmit={handleSaveAddress} className="space-y-4 w-full animate-fade-in">
                          <div>
                            <label className="block text-xs mb-1 text-left">Address *</label>
                            <input type="text" name="address" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:border-blue-400 text-base" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, Apt, etc." />
                          </div>
                          <div>
                            <label className="block text-xs mb-1 text-left">Province *</label>
                            <Select
                              name="province"
                              classNamePrefix="react-select"
                              options={CANADA_PROVINCES.map(p => ({ value: p, label: p }))}
                              value={form.province ? { value: form.province, label: form.province } : null}
                              onChange={option => setForm(f => ({ ...f, province: option ? option.value : '', city: '' }))}
                              placeholder="Select Province"
                              isClearable
                              styles={{
                                control: (base, state) => ({
                                  ...base,
                                  backgroundColor: "rgba(255,255,255,0.05)",
                                  borderColor: state.isFocused ? "#a78bfa" : "#ffffff33",
                                  boxShadow: "none",
                                  color: "#fff",
                                  minHeight: "40px",
                                  borderRadius: "8px",
                                  fontSize: "1rem",
                                  fontFamily: "inherit",
                                  transition: "border-color 0.2s",
                                  textAlign: 'left',
                                }),
                                valueContainer: (base) => ({
                                  ...base,
                                  padding: "0 12px",
                                  textAlign: 'left',
                                }),
                                placeholder: (base) => ({
                                  ...base,
                                  color: "#bdb4e6",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                singleValue: (base) => ({
                                  ...base,
                                  color: "#fff",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                menu: (base) => ({
                                  ...base,
                                  backgroundColor: "#2a2a72",
                                  color: "#fff",
                                  borderRadius: "8px",
                                  marginTop: 2,
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                option: (base, state) => ({
                                  ...base,
                                  backgroundColor: state.isSelected
                                    ? "#4f46e5"
                                    : state.isFocused
                                    ? "#3730a3"
                                    : "#2a2a72",
                                  color: "#fff",
                                  cursor: "pointer",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                dropdownIndicator: (base, state) => ({
                                  ...base,
                                  color: "#bdb4e6",
                                  "&:hover": { color: "#fff" }
                                }),
                                indicatorSeparator: (base) => ({
                                  ...base,
                                  backgroundColor: "#ffffff33"
                                }),
                                input: (base) => ({
                                  ...base,
                                  color: "#fff",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1 text-left">City *</label>
                            <Select
                              name="city"
                              classNamePrefix="react-select"
                              options={form.province && CANADA_CITIES[form.province] ? CANADA_CITIES[form.province].map(c => ({ value: c, label: c })) : []}
                              value={form.city ? { value: form.city, label: form.city } : null}
                              onChange={option => setForm(f => ({ ...f, city: option ? option.value : '' }))}
                              placeholder={form.province ? 'Select City' : 'Select Province First'}
                              isDisabled={!form.province}
                              isClearable
                              styles={{
                                control: (base, state) => ({
                                  ...base,
                                  backgroundColor: "rgba(255,255,255,0.05)",
                                  borderColor: state.isFocused ? "#a78bfa" : "#ffffff33",
                                  boxShadow: "none",
                                  color: "#fff",
                                  minHeight: "40px",
                                  borderRadius: "8px",
                                  fontSize: "1rem",
                                  fontFamily: "inherit",
                                  transition: "border-color 0.2s",
                                  textAlign: 'left',
                                }),
                                valueContainer: (base) => ({
                                  ...base,
                                  padding: "0 12px",
                                  textAlign: 'left',
                                }),
                                placeholder: (base) => ({
                                  ...base,
                                  color: "#bdb4e6",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                singleValue: (base) => ({
                                  ...base,
                                  color: "#fff",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                menu: (base) => ({
                                  ...base,
                                  backgroundColor: "#2a2a72",
                                  color: "#fff",
                                  borderRadius: "8px",
                                  marginTop: 2,
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                option: (base, state) => ({
                                  ...base,
                                  backgroundColor: state.isSelected
                                    ? "#4f46e5"
                                    : state.isFocused
                                    ? "#3730a3"
                                    : "#2a2a72",
                                  color: "#fff",
                                  cursor: "pointer",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                                dropdownIndicator: (base, state) => ({
                                  ...base,
                                  color: "#bdb4e6",
                                  "&:hover": { color: "#fff" }
                                }),
                                indicatorSeparator: (base) => ({
                                  ...base,
                                  backgroundColor: "#ffffff33"
                                }),
                                input: (base) => ({
                                  ...base,
                                  color: "#fff",
                                  fontSize: "1rem",
                                  textAlign: 'left',
                                }),
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs mb-1 text-left">Postal Code *</label>
                            <input type="text" name="postal_code" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-300 focus:outline-none focus:border-blue-400 text-base" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} placeholder="K1A 0B1" />
                          </div>
                          <div className="flex justify-end mt-4 gap-2">
                            <Button type="submit" variant="primary" className="px-6 py-2 text-base font-bold" disabled={saving}>
                              {saving ? 'Saving...' : 'Save Address'}
                            </Button>
                            <Button type="button" variant="secondary" className="px-6 py-2 text-base font-bold" onClick={() => setShowEditAddress(false)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                    </div>
                  </Modal>
                  <Button
                    type="button"
                    className={`w-full mt-6 ${!(profile && profile.address) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!(profile && profile.address)}
                    onClick={!(profile && profile.address) ? () => setToast({ show: true, message: 'Please add a shipping address', type: 'error' }) : handleSubmit}
                  >
                    Claim Order
                  </Button>
                </>
              )}
            </section>
            {/* After the shipping/order status section, add the green box if order is claimed (but not shipped/delivered) */}
            {order && !isShipped && !isDelivered && (
              <div className="bg-green-500/20 backdrop-blur rounded-xl shadow border border-green-300/30 p-4 mb-4 flex flex-col items-center gap-3">
                <i className="fa-solid fa-check-circle text-green-400 text-xl"></i>
                <span className="text-green-300 font-semibold">Order Claimed! Your order has been placed and the seller will process it soon.</span>
                {/* Generate Invoice/Certificate Button */}
                {!(pdfUrls.invoiceUrl && pdfUrls.certificateUrl) && (
                  <Button
                    className="mt-4 flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow"
                    onClick={async () => {
                      setSaving(true);
                      setToast({ show: true, message: 'Generating documents...', type: 'info' });
                      try {
                        await apiService.get(`/api/orders/${order.id}/invoice`);
                        await apiService.get(`/api/orders/${order.id}/certificate`);
                        setToast({ show: true, message: 'Documents generated!', type: 'success' });
                        // Refetch links
                        const [invoiceRes, certRes] = await Promise.all([
                          apiService.get(`/api/orders/${order.id}/invoice`),
                          apiService.get(`/api/orders/${order.id}/certificate`)
                        ]);
                        setPdfUrls({
                          invoiceUrl: invoiceRes.url,
                          certificateUrl: certRes.url
                        });
                      } catch (err) {
                        setToast({ show: true, message: 'Failed to generate documents', type: 'error' });
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                  >
                    <FontAwesomeIcon icon={faFileAlt} /> Generate Invoice & Certificate
                  </Button>
                )}
              </div>
            )}
            {/* After the shipping/order status section, add the note if no order exists */}
            {!order && (
              <div className="text-yellow-300 text-xs mb-2 italic">Invoice and certificate will be available after claiming your order.</div>
            )}
          </div>
          {/* Right: Bid History */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 mt-0 w-full items-center text-center md:items-start md:text-left">
            <section>
                {/* Only one card, not nested */}
                <BidHistory auctionId={auctionId} type={auction?.type || 'settled'} />
                {order && (pdfUrls.invoiceUrl || pdfUrls.certificateUrl) && (
                  <div className="flex gap-4 mt-6 w-full justify-center md:justify-start">
                    {pdfUrls.invoiceUrl && (
                      <a
                        href={pdfUrls.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow transition"
                        title="Download Invoice PDF"
                      >
                        <FontAwesomeIcon icon={faDownload} className="text-white" /> Invoice
                      </a>
                    )}
                    {pdfUrls.certificateUrl && (
                      <a
                        href={pdfUrls.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold shadow transition"
                        title="Download Ownership Certificate PDF"
                      >
                        <FontAwesomeIcon icon={faDownload} className="text-white" /> Certificate
                      </a>
                    )}
                  </div>
                )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WinningPage; 
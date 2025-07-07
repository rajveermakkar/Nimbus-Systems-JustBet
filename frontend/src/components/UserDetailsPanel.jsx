import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ConfirmModal from './ConfirmModal';
import Select from 'react-select';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Create axios instance with credentials
const api = axios.create({
  baseURL: BACKEND_URL + "/api",
  withCredentials: true
});

const roleOptions = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'admin', label: 'Admin' }
];

function UserDetailsPanel({ user, onBanUnban, onBack, onAuctionClick, onUserClick }) {
  console.log('[UserDetailsPanel] user:', user);
  const [toast, setToast] = useState(null);
  const [role, setRole] = useState(user.role);
  const [auctions, setAuctions] = useState([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [auctionsError, setAuctionsError] = useState(null);
  const [pendingRole, setPendingRole] = useState(user.role);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (user && user.id && user.role === 'seller') {
      setAuctionsLoading(true);
      setAuctionsError(null);
      api.get(`/admin/auctions/by-seller/${user.id}`)
        .then(res => {
          console.log('API Response:', res.data);
          setAuctions(res.data.auctions || []);
        })
        .catch((err) => {
          setAuctionsError('Failed to load seller auctions');
          console.error('[UserDetailsPanel] Error fetching auctions:', err);
        })
        .finally(() => setAuctionsLoading(false));
    } else {
      setAuctions([]);
    }
  }, [user.id, user.role]);

  if (!user) return null;
  const handleBanUnban = () => {
    if (onBanUnban) onBanUnban(user);
    setToast(user.is_banned ? 'User unbanned (UI only)' : 'User banned (UI only)');
    setTimeout(() => setToast(null), 2000);
  };
  const handleRoleChange = (e) => {
    setPendingRole(e.target.value);
  };
  const handleApplyRole = () => {
    if (pendingRole !== role) {
      setShowConfirmModal(true);
    }
  };
  const confirmRoleChange = async () => {
    setRoleLoading(true);
    try {
      const token = localStorage.getItem('justbetToken');
      const res = await api.patch(`/admin/users/${user.id}/role`, { role: pendingRole }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRole(pendingRole);
      setShowConfirmModal(false);
      setToast(`Role changed to ${pendingRole}`);
    } catch (err) {
      setToast('Failed to change role');
    } finally {
      setRoleLoading(false);
    }
  };
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || '')}+${encodeURIComponent(user.last_name || '')}&background=2a2a72&color=fff`;

  // Stats
  const stats = auctions.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const customStyles = {
    control: (provided) => ({
      ...provided,
      minHeight: '32px',
      fontSize: '0.95rem',
      padding: '0 4px',
      color: '#fff',
      backgroundColor: '#23235b',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#fff',
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: '0 6px',
    }),
    input: (provided) => ({
      ...provided,
      margin: 0,
      padding: 0,
      color: '#fff',
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      height: '32px',
    }),
    menu: (provided) => ({
      ...provided,
      marginTop: 2,
      borderRadius: 6,
      minWidth: '100%',
      backgroundColor: '#23235b',
    }),
    option: (provided, state) => ({
      ...provided,
      padding: '6px 12px',
      fontSize: '0.95rem',
      color: '#fff',
      backgroundColor: state.isSelected
        ? '#34346b'
        : state.isFocused
        ? '#373a60'
        : '#23235b',
    }),
  };

  const theme = {
    colors: {
      neutral0: '#23235b',
    },
  };

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
        <div className="flex flex-col items-center mb-6">
          <img src={avatarUrl} alt="avatar" className="w-24 h-24 rounded-full border-2 border-white/30 mb-2" />
          <div className="text-gray-300 text-sm mb-2">{user.email}</div>
        </div>
        <div className="max-w-2xl mx-auto flex flex-col gap-2 text-left">
          <label className="font-semibold text-white mb-1">Change Role</label>
          <div className="flex items-center mb-4">
            <div className="w-48">
              <Select
                options={roleOptions}
                value={roleOptions.find(opt => opt.value === pendingRole)}
                onChange={opt => handleRoleChange({ target: { value: opt.value } })}
                isDisabled={roleLoading}
                isSearchable={false}
                styles={customStyles}
                classNamePrefix="react-select"
                menuPlacement="auto"
                theme={theme => ({
                  ...theme,
                  colors: {
                    ...theme.colors,
                    neutral0: '#23235b',
                  },
                })}
              />
            </div>
            <button
              className="ml-2 px-3 py-2 rounded bg-blue-700 text-white font-semibold text-xs disabled:opacity-50"
              onClick={handleApplyRole}
              disabled={pendingRole === role || roleLoading}
              type="button"
            >
              Apply
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {user.role === 'seller' ? (
              user.is_approved ? (
                <span className="px-3 py-1 rounded bg-green-900/60 text-green-200 font-semibold text-sm">Approved Seller</span>
              ) : (
                <span className="px-3 py-1 rounded bg-yellow-900/60 text-yellow-200 font-semibold text-sm">Pending Seller</span>
              )
            ) : user.role === 'buyer' ? (
              <span className="px-3 py-1 rounded bg-blue-900/60 text-blue-200 font-semibold text-sm">Buyer</span>
            ) : user.role === 'admin' ? (
              <span className="px-3 py-1 rounded bg-purple-900/60 text-purple-200 font-semibold text-sm">Admin</span>
            ) : null}
          </div>
          <hr className="border-white/10 my-4" />
          {user.business_name && <div><b>Business:</b> {user.business_name}</div>}
          {user.business_phone && <div><b>Phone:</b> {user.business_phone}</div>}
          {user.business_address && <div><b>Address:</b> {user.business_address}</div>}
          {user.business_description && <div><b>Description:</b> {user.business_description}</div>}
          <button
            className={`mt-6 w-48 px-6 py-2 rounded-lg font-semibold text-left border transition-colors duration-150
              ${user.is_banned
                ? 'bg-green-900/60 text-green-200 border-green-500 hover:bg-green-700 hover:text-white'
                : 'bg-red-900/60 text-red-200 border-red-500 hover:bg-red-700 hover:text-white'}
            `}
            onClick={handleBanUnban}
          >
            {user.is_banned ? 'Unban User' : 'Ban User'}
          </button>
        </div>
        {/* Seller Stats & Listings */}
        {user.role === 'seller' && (
          <div className="mt-10">
            <h3 className="text-xl font-bold mb-4 text-white">Seller Stats</h3>
            <div className="flex gap-4 mb-4 flex-wrap justify-center">
              <span className="px-3 py-1 rounded bg-blue-900/60 text-blue-200 font-semibold text-sm">Total: {auctions.length}</span>
              <span className="px-3 py-1 rounded bg-green-900/60 text-green-200 font-semibold text-sm">Approved: {stats.approved || 0}</span>
              <span className="px-3 py-1 rounded bg-yellow-900/60 text-yellow-200 font-semibold text-sm">Pending: {stats.pending || 0}</span>
              <span className="px-3 py-1 rounded bg-red-900/60 text-red-200 font-semibold text-sm">Rejected: {stats.rejected || 0}</span>
              <span className="px-3 py-1 rounded bg-purple-900/60 text-purple-200 font-semibold text-sm">Closed: {stats.closed || 0}</span>
              <span className="px-3 py-1 rounded bg-blue-900/60 text-blue-200 font-semibold text-sm">Settled: {stats.settled || 0}</span>
              <span className="px-3 py-1 rounded bg-red-900/60 text-red-200 font-semibold text-sm">Live: {stats.live || 0}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Seller stats badges... */}
            </div>
            <hr className="my-4 border-white/10 w-1/2 mx-auto" />
            <h3 className="text-lg font-bold mb-2 text-white">Listings</h3>
            {auctionsLoading ? <div className="text-gray-300">Loading auctions...</div> : auctionsError ? <div className="text-red-400">{auctionsError}</div> : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm table-fixed">
                  <thead>
                    <tr className="text-gray-300">
                      <th className="p-2 w-16 text-center">Image</th>
                      <th className="p-2 text-center">Title</th>
                      <th className="p-2 text-center">Type</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-center">Price</th>
                      <th className="p-2 text-center">Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auctions.length === 0 ? <tr><td colSpan={6} className="text-center text-gray-400 p-4">No auctions found</td></tr> : auctions.map(auction => (
                      <tr
                        key={auction.id}
                        className="border-b border-white/10 cursor-pointer hover:bg-blue-900/20 transition"
                        onClick={() => onAuctionClick && onAuctionClick(auction)}
                      >
                        <td className="p-2 w-16 text-center">
                          {auction.image_url ? (
                            <img src={auction.image_url} alt="thumb" className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center bg-black/20 rounded text-gray-400">-</div>
                          )}
                        </td>
                        <td className="p-2 font-semibold text-white align-middle text-center">{auction.title}</td>
                        <td className="p-2 align-middle text-center">
                          <span className={`px-2 py-1 rounded font-semibold text-xs ${auction.type === 'live' ? 'bg-red-900/60 text-red-200' : 'bg-blue-900/60 text-blue-200'}`}>{auction.type === 'live' ? 'Live' : 'Settled'}</span>
                        </td>
                        <td className="p-2 align-middle text-center">
                          <span className={`px-2 py-1 rounded font-semibold text-xs ${auction.status === 'approved' ? 'bg-green-900/60 text-green-200' : auction.status === 'pending' ? 'bg-yellow-900/60 text-yellow-200' : auction.status === 'rejected' ? 'bg-red-900/60 text-red-200' : auction.status === 'closed' ? 'bg-purple-900/60 text-purple-200' : 'bg-blue-900/60 text-blue-200'}`}>{auction.status}</span>
                        </td>
                        <td className="p-2 align-middle text-center">${auction.starting_price}</td>
                        <td className="p-2 align-middle text-center">
                          {auction.status === 'closed' && auction.winner ? (
                            <span
                              className="text-green-300 font-semibold underline cursor-pointer"
                              onClick={e => { e.stopPropagation(); onUserClick && onUserClick(auction.winner); }}
                              title="View Winner Profile"
                            >
                              {auction.winner.first_name} {auction.winner.last_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Winnings Table */}
            <h3 className="text-lg font-bold mt-10 mb-2 text-white">Winnings</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <thead>
                  <tr className="text-left text-gray-300">
                    <th className="p-2 w-16">Image</th>
                    <th className="p-2 text-center">Title</th>
                    <th className="p-2 text-center">Type</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-center">Price</th>
                    <th className="p-2 text-center">Seller</th>
                  </tr>
                </thead>
                <tbody>
                  {auctions.filter(a => a.winner && a.winner.id === user.id).length === 0 ? <tr><td colSpan={6} className="text-center text-gray-400 p-4">No winnings found</td></tr> : auctions.filter(a => a.winner && a.winner.id === user.id).map(auction => (
                    <tr
                      key={auction.id}
                      className="border-b border-white/10 cursor-pointer hover:bg-green-900/20 transition"
                      onClick={() => onAuctionClick && onAuctionClick(auction)}
                    >
                      <td className="p-2 w-16">
                        {auction.image_url ? (
                          <img src={auction.image_url} alt="thumb" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-black/20 rounded text-gray-400">-</div>
                        )}
                      </td>
                      <td className="p-2 font-semibold text-white align-middle text-center">{auction.title}</td>
                      <td className="p-2 align-middle">
                        <span className={`px-2 py-1 rounded font-semibold text-xs ${auction.type === 'live' ? 'bg-red-900/60 text-red-200' : 'bg-blue-900/60 text-blue-200'}`}>{auction.type === 'live' ? 'Live' : 'Settled'}</span>
                      </td>
                      <td className="p-2 align-middle">
                        <span className={`px-2 py-1 rounded font-semibold text-xs ${auction.status === 'approved' ? 'bg-green-900/60 text-green-200' : auction.status === 'pending' ? 'bg-yellow-900/60 text-yellow-200' : auction.status === 'rejected' ? 'bg-red-900/60 text-red-200' : auction.status === 'closed' ? 'bg-purple-900/60 text-purple-200' : 'bg-blue-900/60 text-blue-200'}`}>{auction.status}</span>
                      </td>
                      <td className="p-2 align-middle">${auction.starting_price}</td>
                      <td className="p-2 align-middle">
                        <span
                          className="text-blue-300 font-semibold underline cursor-pointer"
                          onClick={e => { e.stopPropagation(); onAuctionClick && onAuctionClick(auction.seller); }}
                          title="View Seller Profile"
                        >
                          {auction.seller.first_name} {auction.seller.last_name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {toast && <div className="mt-4 text-center text-yellow-300 font-semibold">{toast}</div>}
        {/* Confirmation Modal */}
        {showConfirmModal && (
          <ConfirmModal
            open={showConfirmModal}
            title="Confirm Role Change"
            message={`Are you sure you want to change this user's role to '${pendingRole}'?`}
            onCancel={() => setShowConfirmModal(false)}
            onConfirm={confirmRoleChange}
            loading={roleLoading}
            confirmText="Confirm"
            cancelText="Cancel"
          />
        )}
      </div>
    </div>
  );
}

export default UserDetailsPanel; 
import React, { useEffect, useState, useContext } from 'react';
import Toast from '../src/components/Toast';
import ConfirmModal from '../src/components/ConfirmModal';
import Button from '../src/components/Button';
import { useNavigate } from 'react-router-dom';
import apiService from '../src/services/apiService';
import { UserContext } from "../src/context/UserContext";
import axios from 'axios';
import Select from 'react-select';
import LoadingSpinner from '../src/components/LoadingSpinner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Country and state data (simple demo)
const countryStateData = {
  US: ["Alabama", "Alaska", "California", "New York", "Texas", "Washington"],
  Canada: ["Alberta", "British Columbia", "Ontario", "Quebec"],
  India: ["Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "West Bengal"],
};
const countryOptions = Object.keys(countryStateData);

// Static mapping for Canada
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

function getAvatarUrl({ first_name, last_name, avatar_url }) {
  if (avatar_url) return avatar_url;
  const name = encodeURIComponent((first_name || '') + ' ' + (last_name || ''));
  return `https://ui-avatars.com/api/?name=${name}&background=2a2a72&color=fff`;
}

function UserProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [countryLoading, setCountryLoading] = useState(true);
  const [stateLoading, setStateLoading] = useState(false);
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { setUser } = useContext(UserContext);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchCountries();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get('/api/user/profile');
      setProfile(data); // use the flat object
      setForm({ ...data }); // use the flat object
    } catch (err) {
      setError('Failed to load profile data');
      setToast({ show: true, message: 'Failed to load profile data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchCountries() {
    setCountryLoading(true);
    try {
      const res = await fetch('https://countriesnow.space/api/v0.1/countries/');
      const data = await res.json();
      if (data && data.data) {
        setCountries(data.data.map(c => ({ country: c.country, states: c.cities })));
      }
    } catch (err) {
      setToast({ show: true, message: 'Failed to load country list', type: 'error' });
    } finally {
      setCountryLoading(false);
    }
  }

  useEffect(() => {
    setStates(CANADA_PROVINCES);
  }, []);

  useEffect(() => {
    if (form.state) {
      setCities(CANADA_CITIES[form.state] || []);
    } else {
      setCities([]);
    }
  }, [form.state]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function validate() {
    if (!form.first_name?.trim()) return 'First name is required.';
    if (!form.last_name?.trim()) return 'Last name is required.';
    if (!form.phone?.trim()) return 'Phone number is required.';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!/^[0-9+\-()\s]{7,20}$/.test(form.phone.trim()) || phoneDigits.length < 7) {
      return 'Enter a valid phone number.';
    }
    if (!form.address?.trim()) return 'Address is required.';
    if (!form.state?.trim() || !CANADA_PROVINCES.includes(form.state)) return 'Select a valid province.';
    if (!form.city?.trim() || !cities.includes(form.city)) return 'Select a valid city.';
    if (!form.postal_code?.trim()) return 'Postal code is required.';
    // Canadian postal code validation: A1A 1A1 or A1A-1A1 or A1A1A1
    if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/i.test(form.postal_code.trim())) {
      return 'Enter a valid Canadian postal code (e.g., K1A 0B1)';
    }
    return null;
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) {
      setError(err);
      setToast({ show: true, message: err, type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const data = await apiService.patch('/api/user/profile', form);
      setProfile(data);
      setForm({ ...data });
      setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setError('Failed to update profile');
      setToast({ show: true, message: 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError('');
    try {
      // 1. Call backend logout endpoint with credentials (same as Navbar)
      try {
        await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
      } catch (e) { /* ignore errors */ }
      // 2. Schedule account deletion
      await apiService.patch('/api/user/schedule-deletion');
      setShowDeleteModal(false);
      setToast({
        show: true,
        message: 'Account deletion requested. You can reactivate by logging in before the scheduled deletion date. After that, your account will be permanently deleted.',
        type: 'info',
        duration: 6000
      });
      setTimeout(() => {
        localStorage.removeItem('justbetToken');
        localStorage.removeItem('justbetUser');
        if (setUser) setUser(null);
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      setError('Failed to request account deletion');
      setToast({ show: true, message: 'Failed to request account deletion', type: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  async function handleReactivateAccount() {
    setReactivating(true);
    setError('');
    try {
      await apiService.patch('/api/user/reactivate');
      // Fetch latest profile after reactivation
      const data = await apiService.get('/api/user/profile');
      // Normalize is_approved to isApproved for context
      const updatedUser = { ...data.user, isApproved: data.user.is_approved };
      if (setUser) setUser(updatedUser);
      localStorage.setItem('justbetUser', JSON.stringify(updatedUser));
      // Redirect based on role
      if (updatedUser.role === 'seller') {
        window.location.href = '/seller/dashboard';
      } else {
        window.location.href = '/user/dashboard';
      }
    } catch (err) {
      setError('Failed to reactivate account');
      setToast({ show: true, message: 'Failed to reactivate account', type: 'error' });
      setReactivating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
        <div className="bg-white/10 p-8 rounded-xl flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (reactivating) {
    return <LoadingSpinner message="Reactivating..." />;
  }

  if (deleting) {
    return <LoadingSpinner message="Deleting account..." />;
  }

  // Custom react-select styles (from CreateListing.jsx)
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderColor: state.isFocused ? '#a78bfa' : '#ffffff33',
      boxShadow: 'none',
      color: '#fff',
      minHeight: '40px',
      borderRadius: '8px',
      fontSize: '1rem',
      fontFamily: 'inherit',
      transition: 'border-color 0.2s',
    }),
    singleValue: (base) => ({ ...base, color: '#fff' }),
    menu: (base) => ({ ...base, background: '#2a2a72', color: '#fff' }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#4f46e5' // blue for selected
        : state.isFocused
        ? '#3730a3' // darker blue for focused
        : '#2a2a72', // default background
      color: '#fff',
      cursor: 'pointer',
      fontSize: '1rem'
    }),
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-8">
      <button
        className="absolute top-16 left-8 text-3xl text-white hover:text-blue-300 transition cursor-pointer"
        onClick={() => navigate(-1)}
        aria-label="Back"
      >
        &#8592;
      </button>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(t => ({ ...t, show: false }))}
        />
      )}
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white/10 rounded-xl p-6 mb-6 border border-white/20 flex flex-col items-center">
          <img
            src={getAvatarUrl(form)}
            alt="avatar"
            className="w-24 h-24 rounded-full border-4 border-white/20 mb-4 shadow-lg object-cover bg-[#23235b]"
          />
          <h2 className="text-2xl font-bold mb-2">My Profile</h2>
          <p className="text-gray-300 mb-4">Manage your personal information and address</p>
          {error && <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4 text-center text-red-400">{error}</div>}
          <form onSubmit={handleSave} className="space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1 text-left">First Name *</label>
                <input type="text" name="first_name" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={form.first_name || ''} onChange={handleChange} placeholder="Enter first name" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-left">Last Name *</label>
                <input type="text" name="last_name" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={form.last_name || ''} onChange={handleChange} placeholder="Enter last name" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1 text-left">Email</label>
                <input type="email" name="email" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none text-sm opacity-60" value={form.email || ''} readOnly />
              </div>
              <div>
                <label className="block text-xs mb-1 text-left">Phone Number *</label>
                <input type="text" name="phone" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={form.phone || ''} onChange={handleChange} placeholder="(123) 456-7890" />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold mb-2 text-left">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1 text-left">Address *</label>
                  <input type="text" name="address" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={form.address || ''} onChange={handleChange} placeholder="Street, Apt, etc." />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-left">Country *</label>
                  <div className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white text-sm opacity-70 cursor-not-allowed select-none bg-[#23235b]">Canada</div>
                </div>
                <div>
                  <label className="block text-xs mb-1 text-left">Province *</label>
                  <Select
                    name="state"
                    classNamePrefix="react-select"
                    options={states.map(s => ({ value: s, label: s }))}
                    value={form.state ? { value: form.state, label: form.state } : null}
                    onChange={option => setForm(f => ({ ...f, state: option ? option.value : '', city: '' }))}
                    placeholder="Select Province"
                    isClearable
                    styles={selectStyles}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-left">City *</label>
                  <Select
                    name="city"
                    classNamePrefix="react-select"
                    options={cities.map(c => ({ value: c, label: c }))}
                    value={form.city ? { value: form.city, label: form.city } : null}
                    onChange={option => setForm(f => ({ ...f, city: option ? option.value : '' }))}
                    placeholder={form.state ? 'Select City' : 'Select Province First'}
                    isDisabled={!form.state}
                    isClearable
                    styles={selectStyles}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 text-left">Postal Code *</label>
                  <input type="text" name="postal_code" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={form.postal_code || ''} onChange={handleChange} placeholder="Postal Code" />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-6 gap-4">
              <button
                className="px-6 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white font-semibold shadow-lg border border-red-500/30 transition disabled:opacity-60"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                type="button"
              >
                Delete Account
              </button>
              <Button type="submit" disabled={saving} className="px-6 py-2 text-base font-semibold">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
        {/* Delete Account Confirmation Modal */}
        {console.log('Profile in ConfirmModal:', profile)}
        {showDeleteModal && (
          <ConfirmModal
            open={showDeleteModal}
            title="Delete Account"
            message={
              <div>
                <div className="mb-4">Are you sure you want to delete your account?</div>
                {profile?.role === 'seller' && (
                  <div className="mb-2 text-yellow-400 font-semibold">
                    Note: All your auctions will be closed right now.
                  </div>
                )}
                <div className="text-gray-300 text-sm">This action cannot be undone. You can reactivate your account within 30 days.</div>
              </div>
            }
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteAccount}
            loading={deleting}
            confirmText="Delete"
            cancelText="Cancel"
            confirmColor="red"
          />
        )}
      </div>
    </div>
  );
}

export default UserProfile; 
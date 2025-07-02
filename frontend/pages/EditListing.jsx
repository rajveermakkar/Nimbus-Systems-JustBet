import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../src/components/Button";
import Toast from "../src/components/Toast";
import { ConfirmModal } from "../src/components/SessionExpiryModal";

function EditListing({ showToast: _showToast }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const auctionTypeFromURL = searchParams.get('type'); // 'live' or 'settled'
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [auctionType, setAuctionType] = useState(auctionTypeFromURL || "live"); // Use URL param as default
  const [duration, setDuration] = useState(""); // For live auctions
  const [startTime, setStartTime] = useState(""); // For both types
  const [endTime, setEndTime] = useState(""); // For settled auctions
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const [toast, setToast] = useState({ show: false, message: '', type: 'info', duration: 3000 });
  const [auctionStatus, setAuctionStatus] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };

  // Fixed duration options for live auctions
  const durationOptions = [
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour" },
    { value: "180", label: "3 hours" },
    { value: "360", label: "6 hours" },
    { value: "720", label: "12 hours" },
    { value: "1440", label: "1 day" }
  ];

  // Helper function to create timezone-aware ISO string
  const toTimezoneISOString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const offset = date.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offset / 60));
    const offsetMinutes = Math.abs(offset % 60);
    const offsetSign = offset <= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
  };

  // Calculate end time based on start time and duration for live auctions
  const calculateEndTime = (startTime, durationMinutes) => {
    const start = new Date(startTime);
    const endTime = new Date(start.getTime() + durationMinutes * 60000);
    return toTimezoneISOString(endTime);
  };

  // Convert UTC date string to local datetime-local value
  function toLocalDatetimeValue(utcString) {
    if (!utcString) return '';
    const date = new Date(utcString);
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Convert local datetime-local value to timezone-aware ISO string
  function toTimezoneISOStringFromLocal(localValue) {
    if (!localValue) return '';
    const date = new Date(localValue);
    return toTimezoneISOString(date);
  }

  // Fetch auction data
  const fetchAuction = async () => {
    try {
      setFetching(true);
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      // Always use seller endpoints for both auction types
      let res, data;
      if (auctionTypeFromURL === 'settled') {
        res = await fetch(`${apiUrl}/api/seller/auctions/settled/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          data = await res.json();
          // Some endpoints wrap in .auction, some don't
          const auctionData = data.auction || data;
          setAuctionType("settled");
          populateForm(auctionData, "settled");
          return;
        }
        // fallback: try live auction endpoint
        res = await fetch(`${apiUrl}/api/seller/auctions/live/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          data = await res.json();
          if (data.max_participants) {
            setAuctionType("live");
            populateForm(data, "live");
            return;
          }
        }
      } else {
        // Try live auction first
        res = await fetch(`${apiUrl}/api/seller/auctions/live/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          data = await res.json();
          if (data.max_participants) {
            setAuctionType("live");
            populateForm(data, "live");
            return;
          }
        }
        // fallback: try settled auction endpoint
        res = await fetch(`${apiUrl}/api/seller/auctions/settled/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          data = await res.json();
          const auctionData = data.auction || data;
          setAuctionType("settled");
          populateForm(auctionData, "settled");
          return;
        }
      }
      throw new Error('Auction not found');
    } catch (err) {
      setError('Failed to load auction. Please try again.');
      showToast('Failed to load auction. Please try again.', "error");
      console.error('Error fetching auction:', err);
    } finally {
      setFetching(false);
    }
  };

  // Populate form with auction data
  const populateForm = (auction, type) => {
    setTitle(auction.title || "");
    setDescription(auction.description || "");
    setImageUrl(auction.image_url || "");
    setStartingPrice(auction.starting_price?.toString() || "");
    setReservePrice(auction.reserve_price?.toString() || "");
    setStartTime(auction.start_time ? toLocalDatetimeValue(auction.start_time) : "");
    setAuctionStatus(auction.status || "");
    if (type === "settled") {
      setEndTime(auction.end_time ? toLocalDatetimeValue(auction.end_time) : "");
    } else {
      if (auction.start_time && auction.end_time) {
        const start = new Date(auction.start_time);
        const end = new Date(auction.end_time);
        const durationMs = end.getTime() - start.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        setDuration(durationMinutes.toString());
      }
    }
  };

  useEffect(() => {
    if (id) {
      fetchAuction();
    }
  }, [id]);

  // Only allow one: imageUrl or imageFiles
  function handleImageUrlChange(e) {
    setImageUrl(e.target.value);
    if (e.target.value) {
      setImageFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  }
  
  function handleImageFilesChange(e) {
    setImageFiles([...e.target.files]);
    if (e.target.files.length > 0) setImageUrl("");
  }

  function validate() {
    if (!title.trim()) return "Product title is required.";
    if (!description.trim()) return "Description is required.";
    if (!imageUrl && imageFiles.length === 0) return "Please provide an image URL or upload an image.";
    if (!startingPrice || isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) return "Starting price must be a positive number.";
    
    if (auctionType === "live") {
      if (!startTime) return "Start date/time is required for live auctions.";
      if (!duration) return "Duration is required for live auctions.";
      
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      const start = new Date(startTime);
      
      if (isNaN(start.getTime())) return "Invalid date format for start date.";
      if (start < now) return "Start date must be today or in the future.";
    } else {
      if (!startTime) return "Start date/time is required for settled auctions.";
      if (!endTime) return "End date/time is required for settled auctions.";
      
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid date format for start or end date.";
      if (start < now) return "Start date must be today or in the future.";
      if (end <= start) return "End date must be after the start date.";
      if (end < new Date()) return "End date must be in the future.";
    }
    
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) {
      setError(err);
      showToast(err, "error");
      return;
    }
    setLoading(true);
    try {
      let finalImageUrl = imageUrl;
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      // If user uploaded an image, upload it to backend first
      if (imageFiles.length > 0) {
        const formData = new FormData();
        formData.append("image", imageFiles[0]);
        const uploadEndpoint = auctionType === "live"
          ? `${apiUrl}/api/seller/auctions/live/upload-image`
          : `${apiUrl}/api/seller/auctions/settled/upload-image`;
        const uploadRes = await fetch(uploadEndpoint, {
          method: "POST",
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || "Image upload failed");
        finalImageUrl = uploadData.url;
      }
      
      // Calculate times
      let finalStartTime, finalEndTime;
      
      if (auctionType === "live") {
        finalStartTime = toTimezoneISOStringFromLocal(startTime);
        finalEndTime = calculateEndTime(startTime, Number(duration));
        
        // Debug logging
        console.log('EditListing time conversion debug:', {
          originalStartTime: startTime,
          duration: duration,
          finalStartTime: finalStartTime,
          finalEndTime: finalEndTime,
          localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          startDateLocal: new Date(startTime).toLocaleString(),
          endDateLocal: new Date(finalEndTime).toLocaleString()
        });
      } else {
        finalStartTime = toTimezoneISOStringFromLocal(startTime);
        finalEndTime = toTimezoneISOStringFromLocal(endTime);
      }
      
      // Choose the correct endpoint based on auction type
      const endpoint = auctionType === "live" 
        ? `${apiUrl}/api/seller/auctions/live/${id}`
        : `${apiUrl}/api/seller/auctions/settled/${id}`;
      
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          imageUrl: finalImageUrl,
          startingPrice,
          reservePrice,
          start_time: finalStartTime,
          end_time: finalEndTime,
          maxParticipants: auctionType === "live" ? 50 : undefined
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update listing");
      }
      
      setLoading(false);
      showToast("Listing updated successfully!", "success");
      navigate("/seller/dashboard");
    } catch (err) {
      setError(err.message || "Failed to update listing");
      showToast(err.message || "Failed to update listing", "error");
      setLoading(false);
    }
  }

  async function handleDelete() {
    setShowConfirm(true);
  }

  async function confirmDelete() {
    setShowConfirm(false);
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const endpoint = auctionType === "live"
        ? `${apiUrl}/api/seller/auctions/live/${id}`
        : `${apiUrl}/api/seller/auctions/settled/${id}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to delete listing");
      showToast("Listing deleted successfully!", "success");
      setTimeout(() => navigate("/seller/dashboard?tab=listings"), 500);
    } catch (err) {
      setError(err.message || "Failed to delete listing");
      showToast(err.message || "Failed to delete listing", "error");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-sm">Loading auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-8">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
          duration={toast.duration}
        />
      )}
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white/10 rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
            <i className="fa-solid fa-edit"></i> Edit Listing
          </h2>
          <p className="text-white/70 text-sm text-left">Update your auction listing</p>
        </div>
        
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white/10 rounded-xl p-6 border border-white/20 mb-4">
            <h3 className="font-semibold mb-4 text-left">Product Information</h3>
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs mb-1 text-left">Product Title *</label>
                <input type="text" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter product title" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs mb-1 text-left">Description *</label>
              <textarea className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm min-h-[80px]" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product in detail..." />
            </div>
            <div className="mb-2">
              <label className="block text-xs mb-1 text-left">Product Images</label>
              <div className="flex gap-2 mb-2 items-center">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageFilesChange}
                  disabled={!!imageUrl}
                />
                <span
                  className={`px-4 py-2 rounded border border-white/30 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition ${!!imageUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (!imageUrl && fileInputRef.current) {
                      fileInputRef.current.value = "";
                      fileInputRef.current.click();
                    }
                  }}
                >
                  Upload Image
                </span>
                {imageFiles.length > 0 && (
                  <span className="ml-2 text-xs text-white/80 flex items-center gap-1">
                    {imageFiles[0].name}
                    <button
                      type="button"
                      className="ml-1 px-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition"
                      onClick={() => {
                        setImageFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </span>
                )}
                <span className="text-xs text-white/50">or</span>
                <input
                  type="text"
                  className="px-2 py-1 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-xs w-48"
                  placeholder="Paste image URL"
                  value={imageUrl}
                  onChange={handleImageUrlChange}
                  disabled={imageFiles.length > 0}
                />
              </div>
              <div className="text-xs text-white/40 text-left">Only Single image accepted, max 5MB, .png, .jpg, .jpeg only</div>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-xl p-6 border border-white/20 mb-4">
            <h3 className="font-semibold mb-4 text-left">Auction Settings</h3>
            
            {/* Auction Type Display (Read-only) */}
            <div className="mb-4">
              <label className="block text-xs mb-1 text-left">Auction Type</label>
              <div className="flex gap-2">
                <span className={`px-4 py-2 rounded text-sm font-semibold ${
                  auctionType === "live"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}>
                  <i className={`fas ${auctionType === "live" ? "fa-broadcast-tower" : "fa-gavel"} mr-2`}></i>
                  {auctionType === "live" ? "Live Auction" : "Settled Auction"}
                </span>
              </div>
            </div>
            
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs mb-1 text-left">Starting Bid ($) *</label>
                <input type="number" min="0" step="0.01" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="flex-1">
                <label className="block text-xs mb-1 text-left">Reserve Price ($)</label>
                <input type="number" min="0" step="0.01" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={reservePrice} onChange={e => setReservePrice(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            
            {/* Conditional Time Fields */}
            {auctionType === "live" ? (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">Start Date/Time *</label>
                  <input type="datetime-local" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  <p className="text-xs text-white/50 mt-1">Set when you want the auction to start (after approval)</p>
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">Duration *</label>
                  <select className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={duration} onChange={e => setDuration(e.target.value)}>
                    <option value="">Select duration</option>
                    {durationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/50 mt-1">Auction will end after this duration</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">Start Date/Time *</label>
                  <input type="datetime-local" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">End Date/Time *</label>
                  <input type="datetime-local" className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate("/seller/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? "Updating..." : "Update Listing"}
            </Button>
            {auctionStatus !== 'closed' && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-700 transition-colors"
              >
                Delete Listing
              </Button>
            )}
          </div>
        </form>
        <p className="text-xs text-white/60 mt-2 text-center">Note: Editing this listing will mark it as Pending and it will require admin re-approval.</p>
      </div>
      <ConfirmModal
        open={showConfirm}
        title="Delete Listing?"
        message="Are you sure you want to delete this listing? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirm(false)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default EditListing; 
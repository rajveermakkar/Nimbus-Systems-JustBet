import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../src/components/Button";
import Toast from "../src/components/Toast";
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const DEV_MODE = true; // Set to false for production, true for dev/testing

function CreateListing() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [auctionType, setAuctionType] = useState("live"); // "live" or "settled"
  const [duration, setDuration] = useState(""); // For live auctions
  const [startTime, setStartTime] = useState(null); // For both types - using Date object
  const [endTime, setEndTime] = useState(null); // For settled auctions - using Date object
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info', duration: 3000 });
  const fileInputRef = useRef();
  const navigate = useNavigate();

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
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    return toTimezoneISOString(endTime);
  };

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

  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);

  function validate() {
    if (!title.trim()) return "Product title is required.";
    if (!description.trim()) return "Description is required.";
    if (!imageUrl && imageFiles.length === 0) return "Please provide an image URL or upload an image.";
    if (!startingPrice || isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) return "Starting price must be a positive number.";
    
    if (auctionType === "live") {
      if (!startTime) return "Start date/time is required for live auctions.";
      if (!duration) return "Duration is required for live auctions.";
      
      const now = new Date();
      const minStartTime = DEV_MODE ? now : new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      if (startTime < minStartTime) return DEV_MODE ? "Start date must be today or in the future." : "Start date must be at least 24 hours from now (admin approval can take 10-12 hours).";
    } else {
      if (!startTime) return "Start date/time is required for settled auctions.";
      if (!endTime) return "End date/time is required for settled auctions.";
      
      const now = new Date();
      const minStartTime = DEV_MODE ? now : new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      if (startTime < minStartTime) return DEV_MODE ? "Start date must be today or in the future." : "Start date must be at least 24 hours from now (admin approval can take 10-12 hours).";
      if (endTime <= startTime) return "End date must be after the start date.";
      if (endTime < new Date()) return "End date must be in the future.";
    }
    
    if (DEV_MODE && startTime && startTime < new Date()) {
      showToast('Start time must be in the future.', 'error');
      return false;
    }
    
    return null;
  }

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) {
      setError(err);
      showToast && showToast(err, "error");
      return;
    }
    setLoading(true);
    try {
      let finalImageUrl = imageUrl;
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      // If user uploaded an image, upload it to backend first
      if (imageFiles.length > 0) {
        const formData = new FormData();
        formData.append("image", imageFiles[0]);
        const uploadEndpoint = auctionType === "live"
          ? `${apiUrl}/api/seller/auctions/live/upload-image`
          : `${apiUrl}/api/seller/auctions/settled/upload-image`;
        const uploadRes = await fetch(uploadEndpoint, {
          method: "POST",
          headers: { 
            'Authorization': `Bearer ${token}` 
          },
          credentials: "include",
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || "Image upload failed");
        finalImageUrl = uploadData.url;
      }
      // Now create the listing
      let finalStartTime, finalEndTime;
      
      if (auctionType === "live") {
        // Convert start time to ISO string with timezone information
        finalStartTime = toTimezoneISOString(startTime);
        
        // Calculate end time
        finalEndTime = calculateEndTime(startTime, Number(duration));
        
        // Debug logging
        console.log('Time conversion debug:', {
          originalStartTime: startTime,
          finalStartTime: finalStartTime,
          duration: duration,
          finalEndTime: finalEndTime,
          localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          startDateLocal: startTime.toLocaleString(),
          endDateLocal: new Date(finalEndTime).toLocaleString(),
          timezoneOffset: startTime.getTimezoneOffset(),
          offsetString: finalStartTime.split('T')[1].split('+')[1] || finalStartTime.split('T')[1].split('-')[1]
        });
      } else {
        // For settled auctions, convert both times to ISO strings with timezone
        finalStartTime = toTimezoneISOString(startTime);
        finalEndTime = toTimezoneISOString(endTime);
      }
      
      // Choose the correct endpoint based on auction type
      const endpoint = auctionType === "live" 
        ? `${apiUrl}/api/seller/auctions/live`
        : `${apiUrl}/api/seller/auctions/settled`;
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          imageUrl: finalImageUrl,
          startingPrice: startingPrice,
          reservePrice: reservePrice,
          startTime: finalStartTime,
          endTime: finalEndTime,
          maxParticipants: auctionType === "live" ? 50 : undefined // Add maxParticipants for live auctions
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create listing");
      }
      setLoading(false);
      showToast("Listing created successfully!", "success");
      navigate("/seller/dashboard?tab=listings");
    } catch (err) {
      setError(err.message || "Failed to create listing");
      showToast && showToast(err.message || "Failed to create listing", "error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-8">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(t => ({ ...t, show: false }))}
        />
      )}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white/10 p-8 rounded-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white text-lg font-semibold">Creating Listing...</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white/10 rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
            <i className="fa-solid fa-plus"></i> Add New Listing
          </h2>
          <p className="text-white/70 text-sm text-left">Create a new auction listing for your product</p>
        </div>
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
            
            {/* Auction Type Selector */}
            <div className="mb-4">
              <label className="block text-xs mb-1 text-left">Auction Type *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-4 py-2 rounded text-sm font-semibold transition ${
                    auctionType === "live"
                      ? "bg-red-500 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                  onClick={() => setAuctionType("live")}
                >
                  <i className="fas fa-broadcast-tower mr-2"></i>
                  Live Auction
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded text-sm font-semibold transition ${
                    auctionType === "settled"
                      ? "bg-blue-500 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                  onClick={() => setAuctionType("settled")}
                >
                  <i className="fas fa-gavel mr-2"></i>
                  Settled Auction
                </button>
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
                  <DatePicker
                    selected={startTime}
                    onChange={(date) => setStartTime(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={1}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    placeholderText="Select start date and time"
                    minDate={DEV_MODE ? startOfToday : new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    filterTime={(time) => {
                      if (DEV_MODE) return true;
                      const now = new Date();
                      const minTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                      return time.getTime() >= minTime.getTime();
                    }}
                    className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm"
                    wrapperClassName="w-full"
                  />
                  <p className="text-xs text-white/50 mt-1">Set when you want the auction to start (after approval)</p>
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">Duration *</label>
                  <Select
                    className="react-select-container"
                    classNamePrefix="react-select"
                    options={durationOptions}
                    value={durationOptions.find(opt => opt.value === duration) || null}
                    onChange={option => setDuration(option ? option.value : "")}
                    placeholder="Select duration"
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
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        padding: "0 12px"
                      }),
                      placeholder: (base) => ({
                        ...base,
                        color: "#bdb4e6",
                        fontSize: "1rem"
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: "#fff",
                        fontSize: "1rem"
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: "#2a2a72",
                        color: "#fff",
                        borderRadius: "8px",
                        marginTop: 2,
                        fontSize: "1rem"
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
                        fontSize: "1rem"
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
                        fontSize: "1rem"
                      }),
                    }}
                  />
                  <p className="text-xs text-white/50 mt-1">Auction will end after this duration</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">Start Date/Time *</label>
                  <DatePicker
                    selected={startTime}
                    onChange={(date) => setStartTime(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={1}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    placeholderText="Select start date and time"
                    minDate={DEV_MODE ? startOfToday : new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm"
                    wrapperClassName="w-full"
                  />
                  <p className="text-xs text-white/50 mt-1">Set when you want the auction to start (after approval)</p>
                </div>
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-left">End Date/Time *</label>
                  <DatePicker
                    selected={endTime}
                    onChange={(date) => setEndTime(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={1}
                    dateFormat="MMMM d, yyyy h:mm aa"
                    placeholderText="Select end date and time"
                    minDate={startTime ? new Date(startTime.getTime() + 60 * 1000) : undefined}
                    className="w-full px-3 py-2 rounded bg-transparent border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-sm"
                    wrapperClassName="w-full"
                  />
                  <p className="text-xs text-white/50 mt-1">Auction will end at this time</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              + Create Listing
            </Button>
          </div>
        </form>
        <p className="text-xs text-white/60 mt-2 text-center">
          Note: Start date must be at least 24 hours from now. Admin approval can take 10-12 hours, 
          so please plan accordingly to ensure your auction starts on time.
        </p>
        <p className="text-xs text-white/60 mt-2 text-center">Note: Your listing will be marked as Pending until approved by an admin.</p>
      </div>
    </div>
  );
}

export default CreateListing; 
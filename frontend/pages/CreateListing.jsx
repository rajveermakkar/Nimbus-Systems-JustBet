import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../src/components/Button";

function CreateListing({ showToast }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [startingPrice, setStartingPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const navigate = useNavigate();

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
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    if (!title.trim()) return "Product title is required.";
    if (!description.trim()) return "Description is required.";
    if (!imageUrl && imageFiles.length === 0) return "Please provide an image URL or upload an image.";
    if (!startingPrice || isNaN(Number(startingPrice)) || Number(startingPrice) <= 0) return "Starting price must be a positive number.";
    if (!startTime) return "Start date/time is required.";
    if (!endTime) return "End date/time is required.";
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid date format for start or end date.";
    if (start < now) return "Start date must be today or in the future.";
    if (end <= start) return "End date must be after the start date.";
    if (end < new Date()) return "End date must be in the future.";
    return null;
  }

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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      // If user uploaded an image, upload it to backend first
      if (imageFiles.length > 0) {
        const formData = new FormData();
        formData.append("image", imageFiles[0]);
        const uploadRes = await fetch(`${apiUrl}/api/seller/auctions/upload-image`, {
          method: "POST",
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || "Image upload failed");
        finalImageUrl = uploadData.url;
      }
      // Now create the listing
      const res = await fetch(`${apiUrl}/api/seller/auctions`, {
        method: "POST",
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
          startTime,
          endTime
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create listing");
      }
      setLoading(false);
      showToast && showToast("Listing created successfully!", "success");
      navigate("/seller/dashboard");
    } catch (err) {
      setError(err.message || "Failed to create listing");
      showToast && showToast(err.message || "Failed to create listing", "error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white py-8">
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
      </div>
    </div>
  );
}

export default CreateListing; 
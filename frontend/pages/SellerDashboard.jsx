import React, { useContext, useState } from "react";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";
import { useNavigate } from "react-router-dom";

function SellerDashboard() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [showListings, setShowListings] = useState(false);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleViewListings() {
    setShowListings(true);
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("justbetToken");
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/seller/auctions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = await res.json();
      setListings(data);
    } catch (err) {
      setError("Could not load listings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 max-w-md w-full text-center mb-6">
        <h1 className="text-3xl font-bold mb-4">Seller Dashboard</h1>
        <p className="mb-4">Welcome, {user && user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Seller"}!</p>
        {user && user.isApproved ? (
          <>
            <div className="text-green-400 font-semibold mb-4 flex items-center justify-center gap-2">
              <i className="fas fa-check-circle"></i>
              Your account is approved!
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="primary" size="sm" onClick={() => navigate("/seller/create-listing")}> 
                <i className="fa-solid fa-plus mr-2"></i>
                Create Listing
              </Button>
            </div>
          </>
        ) : (
          <div className="text-yellow-300 font-semibold mb-4 flex items-center justify-center gap-2">
            <i className="fas fa-hourglass-half"></i>
            Your seller account is pending approval.
          </div>
        )}
      </div>
      {showListings && (
        <div className="w-full max-w-3xl mx-auto mt-4">
          {loading && <div className="text-white/70">Loading...</div>}
          {error && <div className="text-red-400 mb-2">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map(listing => (
              <div key={listing.id} className="bg-white/10 border border-white/20 rounded-lg p-4 text-left">
                <div className="font-bold text-lg mb-1">{listing.title}</div>
                <div className="text-xs text-white/60 mb-2">{listing.status || (listing.is_approved ? 'approved' : 'pending')}</div>
                <div className="mb-2">{listing.description}</div>
                {listing.image_url && (
                  <img src={listing.image_url} alt={listing.title} className="w-full max-h-40 object-cover rounded mb-2" />
                )}
                <div className="text-sm text-white/80">Start: {listing.start_time ? new Date(listing.start_time).toLocaleString() : '-'}</div>
                <div className="text-sm text-white/80">End: {listing.end_time ? new Date(listing.end_time).toLocaleString() : '-'}</div>
                <div className="text-sm text-white/80">Starting Price: ${listing.starting_price}</div>
                {listing.reserve_price && <div className="text-sm text-white/80">Reserve Price: ${listing.reserve_price}</div>}
              </div>
            ))}
            {(!loading && listings.length === 0) && <div className="col-span-2 text-center text-white/60">No listings found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default SellerDashboard; 
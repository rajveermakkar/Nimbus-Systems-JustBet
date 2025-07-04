import React, { useEffect, useState } from 'react';
import axios from 'axios';

function ViewDetailsModal({ open, type, data, onClose }) {
  const [result, setResult] = useState(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState(null);

  useEffect(() => {
    if (open && type === 'auction') {
      console.log('Modal opened for auction:', data);
    }
    if (open && type === 'auction' && (data.status === 'closed' || data.status === 'approved' || data.status === 'settled')) {
      if (data.type === 'settled') {
        setResultLoading(true); setResultError(null);
        const url = `${import.meta.env.VITE_BACKEND_URL}/api/auctions/settled/${data.id}/result`;
        console.log('Fetching settled auction result:', url);
        axios.get(url, { withCredentials: true })
          .then(res => {
            console.log('Settled auction result response:', res.data);
            setResult(res.data.result || res.data);
          })
          .catch((err) => {
            console.log('Settled auction result error:', err);
            setResultError('No result info');
          })
          .finally(() => setResultLoading(false));
      } else if (data.type === 'live' && (data.status === 'closed' || data.status === 'approved')) {
        setResultLoading(true); setResultError(null);
        const url = `${import.meta.env.VITE_BACKEND_URL}/api/auctions/live/${data.id}/result`;
        console.log('Fetching live auction result:', url);
        axios.get(url, { withCredentials: true })
          .then(res => {
            console.log('Live auction result response:', res.data);
            setResult(res.data.result || res.data);
          })
          .catch((err) => {
            console.log('Live auction result error:', err);
            setResultError('No result info');
          })
          .finally(() => setResultLoading(false));
      } else {
        setResult(null);
      }
    } else {
      setResult(null);
    }
  }, [open, type, data]);

  if (!open || !data) return null;

  // Winner info for auctions
  const winner = data.winner_name || data.winner || data.winner_email || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#23235b]/90 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-2xl text-white flex flex-col gap-6 max-h-[95vh] overflow-y-auto border border-white/10">
        <button onClick={onClose} className="absolute top-4 right-4 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm">Close</button>
        {type === 'user' ? (
          <div>
            <h2 className="text-2xl font-bold mb-6">User Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><b>Name:</b> {data.first_name} {data.last_name}</div>
              <div><b>Email:</b> {data.email}</div>
              <div><b>Role:</b> {data.role}</div>
              <div><b>Selling Status:</b> {
                data.role === 'seller'
                  ? (data.is_approved ? 'Approved' : 'Pending')
                  : (data.role === 'buyer' ? 'Not a seller' : 'N/A')
              }</div>
              {data.business_name && <div><b>Business:</b> {data.business_name}</div>}
              {data.business_description && <div className="md:col-span-2"><b>Description:</b> {data.business_description}</div>}
              {data.business_address && <div className="md:col-span-2"><b>Address:</b> {data.business_address}</div>}
              {data.business_phone && <div><b>Phone:</b> {data.business_phone}</div>}
              {/* More user details can be added here */}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-6">Auction Details</h2>
            <div className="flex flex-col md:flex-row gap-6">
              {data.image_url || data.imageUrl ? (
                <img src={data.image_url || data.imageUrl} alt="Auction" className="w-full md:w-64 max-h-64 object-contain rounded-xl border border-white/10 bg-black/20" />
              ) : (
                <div className="w-full md:w-64 h-64 flex items-center justify-center bg-black/20 rounded-xl border border-white/10 text-gray-400">No Image</div>
              )}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><b>Title:</b> {data.title}</div>
                <div className="md:col-span-2"><b>Description:</b> {data.description}</div>
                <div><b>Status:</b> {data.status || data.auction_status}</div>
                <div><b>Type:</b> {data.type || (data.maxParticipants ? 'Live' : 'Settled')}</div>
                <div><b>Seller:</b> {data.seller?.first_name} {data.seller?.last_name}</div>
                <div><b>Start:</b> {new Date(data.start_time).toLocaleString()}</div>
                <div><b>End:</b> {new Date(data.end_time).toLocaleString()}</div>
                <div><b>Starting Price:</b> {data.starting_price}</div>
                {data.reserve_price && <div><b>Reserve Price:</b> {data.reserve_price}</div>}
                {/* Winner/Result info for closed/approved auctions */}
                {resultLoading && <div className="md:col-span-2 text-blue-300">Loading result...</div>}
                {resultError && <div className="md:col-span-2 text-red-400">{resultError}</div>}
                {result && (
                  <>
                    {result.winner ? (
                      <div className="md:col-span-2"><b>Winner:</b> {result.winner.first_name} {result.winner.last_name} ({result.winner.email})</div>
                    ) : (
                      <div className="md:col-span-2 text-yellow-300"><b>No winner (reserve not met or no valid bids)</b></div>
                    )}
                    <div><b>Final Bid:</b> {result.final_bid ?? '-'}</div>
                    <div><b>Reserve Met:</b> {result.reserve_met ? 'Yes' : 'No'}</div>
                    <div><b>Result Status:</b> {result.status}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ViewDetailsModal; 
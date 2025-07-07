import React from 'react';

function SessionExpiryModal({ onExtend, onClose, minutesLeft = 10 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-purple-500/30 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-purple-200/30">
        <svg className="w-10 h-10 mb-3 text-purple-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="text-lg font-bold text-white mb-2 text-center">Session Expiring Soon</h2>
        <p className="text-white/90 text-center mb-6">Your session will expire in <span className="font-semibold text-purple-200">{minutesLeft} minutes</span>.<br/>Would you like to extend your session?</p>
        <div className="flex gap-4 w-full justify-center">
          <button
            onClick={onExtend}
            className="bg-purple-600/80 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition"
          >
            Extend Session
          </button>
          <button
            onClick={onClose}
            className="bg-red-500/80 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionExpiryModal; 
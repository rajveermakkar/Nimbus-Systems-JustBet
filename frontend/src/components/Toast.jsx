import React, { useEffect } from "react";

// type: 'success' | 'error' | 'info'
function Toast({ message, type = 'info', onClose, duration = 3000, actionLabel, onAction }) {
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  let bgColor = 'bg-purple-400/30'; // glass purple for info/success
  let textColor = 'text-white';
  let icon = (
    <svg className="w-5 h-5 text-purple-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === 'success') {
    bgColor = 'bg-purple-400/30';
    textColor = 'text-white';
    icon = (
      <svg className="w-5 h-5 text-purple-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M9 12l2 2l4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  } else if (type === 'error') {
    bgColor = 'bg-red-500/30';
    textColor = 'text-white';
    icon = (
      <svg className="w-5 h-5 text-red-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M15 9l-6 6m0-6l6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <div
      className={`fixed top-10 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 max-w-md w-full shadow-2xl rounded-2xl ${bgColor} flex items-center px-4 py-3 animate-toast-pop backdrop-blur-md`}
      style={{ transition: 'transform 0.2s cubic-bezier(.4,2,.6,1), opacity 0.2s', transform: 'translateY(0)', opacity: 1 }}
      role="alert"
    >
      <span className="mr-3 flex-shrink-0 flex items-center justify-center">{icon}</span>
      <span className={`flex-1 text-sm font-semibold ${textColor}`} style={{lineHeight: '1.5'}}>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="ml-3 rounded-lg px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={onClose}
        className="ml-3 rounded-full p-1.5 hover:bg-purple-200/40 focus:outline-none focus:ring-2 focus:ring-purple-300 text-purple-100"
        aria-label="Close notification"
        tabIndex={0}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <style>{`
        @keyframes toast-pop {
          0% { transform: translateY(-30px) scale(0.95); opacity: 0; }
          80% { transform: translateY(4px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-toast-pop {
          animation: toast-pop 0.35s cubic-bezier(.4,2,.6,1);
        }
      `}</style>
    </div>
  );
}

export default Toast; 
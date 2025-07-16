import React from 'react';

function ConfirmModal({
  open,
  title = "Are you sure?",
  message = "",
  onConfirm,
  onCancel,
  confirmText = "Yes",
  cancelText = "Cancel",
  confirmColor = "purple", // 'green' | 'red' | 'purple'
  loading = false,
  confirmDisabled = false
}) {
  if (!open) return null;
  let confirmBtnClass = "bg-purple-600 hover:bg-purple-700";
  if (confirmColor === 'green') confirmBtnClass = "bg-green-600 hover:bg-green-700";
  if (confirmColor === 'red') confirmBtnClass = "bg-red-600 hover:bg-red-700";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-purple-400/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-purple-200/30">
        <svg className="w-10 h-10 mb-3 text-purple-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="text-lg font-bold text-white mb-2 text-center">{title}</h2>
        <div className="text-white/90 text-center mb-6">{message}</div>
        <div className="flex gap-4 w-full justify-center">
          <button
            onClick={loading ? undefined : onConfirm}
            className={`${confirmBtnClass} text-white font-semibold px-4 py-2 rounded-lg shadow-md transition flex-1`}
            disabled={loading || confirmDisabled}
          >
            {loading ? 'Loading...' : confirmText}
          </button>
          <button
            onClick={loading ? undefined : onCancel}
            className="bg-purple-400/80 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition flex-1"
            disabled={loading}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal; 
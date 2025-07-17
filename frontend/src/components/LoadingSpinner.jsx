import React from "react";
export default function LoadingSpinner({ message }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      {message && <div className="text-white text-lg font-semibold mt-4">{message}</div>}
    </div>
  );
} 
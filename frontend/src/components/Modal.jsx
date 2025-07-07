import React from "react";

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-2xl animate-fade-in">
      <div className="relative bg-[#23235b]/90 rounded-2xl shadow-xl p-6 max-w-md w-full border border-white/20 flex flex-col items-center text-white">
        <button
          className="absolute top-4 right-5 text-white text-2xl hover:text-purple-300 transition focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        {title && <h2 className="text-2xl font-bold mb-6 text-center w-full tracking-tight">{title}</h2>}
        <div className="w-full flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export default Modal; 
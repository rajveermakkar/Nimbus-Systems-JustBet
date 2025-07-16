import React from "react";

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[6px] animate-fade-in">
      <div className="relative bg-black/15 backdrop-blur-[16px] rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/30 flex flex-col items-center text-white" style={{boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'}}>
        <button
          className="absolute top-4 right-5 text-white text-2xl hover:text-purple-300 transition focus:outline-none bg-white/10 rounded-full w-10 h-10 flex items-center justify-center shadow-md border border-white/20"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        {title && <h2 className="text-2xl font-bold mb-6 text-center w-full tracking-tight drop-shadow-lg">{title}</h2>}
        <div className="w-full flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export default Modal; 
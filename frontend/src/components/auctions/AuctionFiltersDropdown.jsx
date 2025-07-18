import React, { useState, useRef, useEffect } from 'react';

export default function AuctionFiltersDropdown({
  showCurrentPrice = true,
  showStartingSoon = true,
  showEndingSoon = true,
  onChange,
  values = {}
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Toggle state for soon filters
  const [startingSoonEnabled, setStartingSoonEnabled] = useState(!!values.startingSoon);
  const [endingSoonEnabled, setEndingSoonEnabled] = useState(!!values.endingSoon);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...values, [name]: value });
  };
  const handleReset = () => {
    setStartingSoonEnabled(false);
    setEndingSoonEnabled(false);
    onChange({});
  };
  const handleToggle = (type, enabled) => {
    if (type === 'startingSoon') {
      setStartingSoonEnabled(enabled);
      if (enabled) {
        onChange({ ...values, startingSoon: 1 }); // Default to 1 hour
      } else {
        onChange({ ...values, startingSoon: undefined });
      }
    } else if (type === 'endingSoon') {
      setEndingSoonEnabled(enabled);
      if (enabled) {
        onChange({ ...values, endingSoon: 1 }); // Default to 1 hour
      } else {
        onChange({ ...values, endingSoon: undefined });
      }
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="px-4 py-2 bg-[black]/30 border border-white/10 rounded-2xl text-white font-semibold shadow-2xl hover:bg-white/10 transition backdrop-blur-md"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        Filters
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 rounded-2xl bg-[black]/30 backdrop-blur-md shadow-2xl border border-white/10 p-6 flex flex-col gap-4 z-50"
          style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)' }}
        >
          {/* Current Price Filter */}
          {showCurrentPrice && (
            <div>
              <div className="font-semibold text-white mb-2">Current Price</div>
              <div className="flex gap-2 items-center mb-2">
                <label className="text-xs w-24 text-white/80">Min</label>
                <input
                  type="number"
                  name="minCurrentPrice"
                  value={values.minCurrentPrice || ''}
                  onChange={handleChange}
                  className="px-2 py-1 rounded-lg border border-white/20 bg-white/10 text-white w-20 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 placeholder-white/60"
                  min="0"
                  placeholder="Min"
                />
                <span className="text-white/60">-</span>
                <label className="text-xs w-10 text-white/80">Max</label>
                <input
                  type="number"
                  name="maxCurrentPrice"
                  value={values.maxCurrentPrice || ''}
                  onChange={handleChange}
                  className="px-2 py-1 rounded-lg border border-white/20 bg-white/10 text-white w-20 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 placeholder-white/60"
                  min="0"
                  placeholder="Max"
                />
              </div>
            </div>
          )}
          {/* Starting Soon Toggle */}
          {showStartingSoon && (
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs w-24 text-white/80">Starting Soon</label>
              <button
                type="button"
                className={`w-10 h-6 rounded-full border transition-colors duration-200 focus:outline-none ${startingSoonEnabled ? 'bg-blue-600 border-blue-600' : 'bg-white/40 border-white/30'}`}
                onClick={() => handleToggle('startingSoon', !startingSoonEnabled)}
                aria-pressed={startingSoonEnabled}
              >
                <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${startingSoonEnabled ? 'translate-x-4' : ''}`}></span>
              </button>
            </div>
          )}
          {/* Ending Soon Toggle */}
          {showEndingSoon && (
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs w-24 text-white/80">Ending Soon</label>
              <button
                type="button"
                className={`w-10 h-6 rounded-full border transition-colors duration-200 focus:outline-none ${endingSoonEnabled ? 'bg-blue-600 border-blue-600' : 'bg-white/40 border-white/30'}`}
                onClick={() => handleToggle('endingSoon', !endingSoonEnabled)}
                aria-pressed={endingSoonEnabled}
              >
                <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${endingSoonEnabled ? 'translate-x-4' : ''}`}></span>
              </button>
            </div>
          )}
          <button
            className="mt-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white border border-white/20 transition shadow"
            onClick={handleReset}
            type="button"
          >
            &#x21bb; Reset Filters
          </button>
        </div>
      )}
    </div>
  );
} 
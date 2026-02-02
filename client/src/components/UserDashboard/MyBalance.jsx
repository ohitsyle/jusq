// client/src/components/UserDashboard/MyBalance.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBalance } from "../../services/userApi";

export default function MyBalance({ balance: externalBalance, setBalance: externalSetBalance }) {
  // Internal state for balance - this ensures we always have control
  const [balance, setBalance] = useState(externalBalance || 0);
  const [showBalance, setShowBalance] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch balance on mount
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await getBalance();
        
        if (data && data.success && typeof data.balance === 'number') {
          setBalance(data.balance);
          // Also update external state if provided
          if (externalSetBalance) {
            externalSetBalance(data.balance);
          }
        } else {
          setError("Failed to fetch balance");
        }
      } catch (err) {
        console.error("Error fetching balance:", err);
        setError(err.message || "Error fetching balance");
      } finally {
        setLoading(false);
      }
    };
    
    fetchBalance();
  }, [externalSetBalance]);

  // Sync with external balance if it changes
  useEffect(() => {
    if (typeof externalBalance === 'number') {
      setBalance(externalBalance);
    }
  }, [externalBalance]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[rgba(255,212,28,0.2)] bg-transparent">
      {/* Header */}
      <div className="bg-[#FFD41C] px-4 py-1 flex items-center justify-between border-b border-[rgba(255,212,28,0.3)]">
        <h3 className="text-[#121C52] font-bold text-sm">
          My Balance
        </h3>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setDropdownOpen(!dropdownOpen);
            }}
            className="text-[#121C52] text-xl font-bold hover:opacity-75 transition-opacity"
            type="button"
          >
            &#8230;
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-32 bg-white text-black rounded shadow z-50">
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-200 text-sm transition-colors"
                onClick={() => {
                  navigate("/faq");
                  setDropdownOpen(false);
                }}
                type="button"
              >
                FAQs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 relative min-h-[90px] text-white/90">
        <div className="flex items-center justify-between text-2xl font-bold">
          <span>
            {loading ? (
              "Loading..."
            ) : error ? (
              <span className="text-red-400 text-sm">{error}</span>
            ) : showBalance ? (
              `₱ ${balance.toLocaleString("en-PH", { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}`
            ) : (
              "₱ ********"
            )}
          </span>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowBalance(prev => !prev);
            }}
            className="ml-3 cursor-pointer focus:outline-none hover:scale-110 transition-transform active:scale-95"
            disabled={loading || !!error}
            type="button"
          >
            {showBalance ? (
              <svg 
                className="w-6 h-6 text-white/70 hover:text-white transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg 
                className="w-6 h-6 text-white/70 hover:text-white transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.658-3.04" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-white/70 text-sm mt-1">available</p>
      </div>
    </div>
  );
}
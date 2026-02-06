// src/pages/admin/Merchant/Dashboard.jsx
// Main dashboard - Matches Treasury admin design pattern

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme, isDarkMode } = useTheme();
  const [merchantStats, setMerchantStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const loadMerchantStats = async () => {
    try {
      const data = await api.get('/merchant/stats');
      setMerchantStats(data);
    } catch (error) {
      console.error('Error loading merchant stats:', error);
      setMerchantStats({
        totalMerchants: 0,
        activeMerchants: 0,
        inactiveMerchants: 0,
        todayTransactions: 0,
        phonesRegistered: 0,
        recentMerchants: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMerchantStats();
    intervalRef.current = setInterval(loadMerchantStats, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-[60px]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>🏠</span> Merchant Home
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Merchant management and monitoring dashboard • Auto-updates every 5 seconds
        </p>
      </div>

      {/* Stats Grid - 4 cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="🏪"
          label="TOTAL MERCHANTS"
          value={merchantStats?.totalMerchants || 0}
          subtitle="registered"
          color="#F59E0B"
          theme={theme}
        />
        <StatCard
          icon="✅"
          label="ACTIVE MERCHANTS"
          value={merchantStats?.activeMerchants || 0}
          subtitle="currently active"
          color="#10B981"
          theme={theme}
        />
        <StatCard
          icon="💳"
          label="TODAY'S TRANSACTIONS"
          value={merchantStats?.todayTransactions || 0}
          subtitle="payments today"
          color="#3B82F6"
          theme={theme}
        />
        <StatCard
          icon="📱"
          label="PHONES REGISTERED"
          value={merchantStats?.phonesRegistered || 0}
          subtitle="devices"
          color="#A855F7"
          theme={theme}
        />
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/merchant/merchants')}
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.1) 100%)'
              : 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.1) 100%)',
            borderColor: 'rgba(245,158,11,0.3)'
          }}
          className="col-span-2 p-5 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.01] hover:shadow-lg cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(245,158,11,0.2)' }}>
            🏪
          </div>
          <div className="text-left">
            <h3 className="text-base font-bold text-amber-500 m-0">Manage Merchants</h3>
            <p style={{ color: theme.text.secondary }} className="text-xs m-0 mt-1">
              View, add, and manage merchant accounts
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin/merchant/phones')}
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.1) 100%)'
              : 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.1) 100%)',
            borderColor: isDarkMode ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'
          }}
          className="col-span-2 p-5 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.01] hover:shadow-lg cursor-pointer"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: isDarkMode ? 'rgba(168,85,247,0.2)' : 'rgba(59,130,246,0.2)' }}
          >
            📱
          </div>
          <div className="text-left">
            <h3 style={{ color: theme.accent.primary }} className="text-base font-bold m-0">Manage Phones</h3>
            <p style={{ color: theme.text.secondary }} className="text-xs m-0 mt-1">
              View and manage phone assignments
            </p>
          </div>
        </button>
      </div>

      {/* Recently Added Merchants - Full width */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden flex-1 flex flex-col">
          <div style={{ borderColor: theme.border.primary }} className="p-4 border-b flex justify-between items-center flex-shrink-0">
            <div>
              <h3 style={{ color: theme.accent.primary }} className="m-0 mb-1 text-base font-bold">
                🆕 Recently Added Merchants
              </h3>
              <p style={{ color: theme.text.secondary }} className="m-0 text-xs">
                Latest merchant accounts added to the system
              </p>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {merchantStats?.recentMerchants && merchantStats.recentMerchants.length > 0 ? (
              <div className="flex flex-col gap-3">
                {merchantStats.recentMerchants.slice(0, 5).map((merchant, index) => (
                  <div
                    key={merchant._id || index}
                    style={{
                      background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: theme.border.primary
                    }}
                    className="flex justify-between items-center p-4 rounded-xl border"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{
                          background: isDarkMode
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))'
                            : 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))',
                          color: theme.accent.primary
                        }}
                      >
                        🏪
                      </div>
                      <div>
                        <div style={{ color: theme.text.primary }} className="font-semibold text-[15px] mb-1">
                          {merchant.businessName || 'Merchant'}
                        </div>
                        <div style={{ color: theme.text.tertiary }} className="text-xs">
                          {merchant.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="py-1 px-3 rounded-full text-[11px] font-bold uppercase tracking-wide" style={{
                        background: merchant.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        border: `1px solid ${merchant.isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        color: merchant.isActive ? '#10B981' : '#EF4444'
                      }}>
                        {merchant.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span style={{ color: theme.text.tertiary }} className="text-[11px] whitespace-nowrap">
                        {merchant.createdAt
                          ? new Date(merchant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Recently'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: theme.text.tertiary }} className="text-center py-16">
                <div className="text-5xl mb-4">🏪</div>
                <p>No merchants added yet</p>
                <p className="text-xs mt-2">Navigate to the Merchants tab to add new merchants</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component - Matches Treasury pattern
function StatCard({ icon, label, value, subtitle, color, theme }) {
  return (
    <div style={{
      background: theme.bg.card,
      borderColor: theme.border.primary
    }} className="p-4 rounded-2xl border relative overflow-hidden transition-all duration-300">
      <div className="absolute right-3 top-3 text-[32px] opacity-15">
        {icon}
      </div>
      <div style={{ color: theme.text.secondary }} className="text-[10px] font-bold uppercase tracking-wide mb-2">
        {label}
      </div>
      <div style={{ color: theme.text.primary }} className="text-2xl font-extrabold mb-1">
        {value}
      </div>
      <div className="text-[10px] font-semibold inline-block py-[2px] px-[8px] rounded-lg" style={{
        color: color,
        background: `${color}20`
      }}>
        {subtitle}
      </div>
    </div>
  );
}

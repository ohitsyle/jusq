// src/pages/admin/Merchant/Reports.jsx
// Reports & Analytics - Theme-aware, uses api utility

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api, { API_BASE_URL } from '../../../utils/api';

export default function ReportsPage() {
  const { theme, isDarkMode } = useTheme();
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    try {
      const data = await api.get(`/merchant/reports?range=${dateRange}`);
      setReportData(data);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (format) => {
    const token = localStorage.getItem('adminToken');
    window.open(`${API_BASE_URL}/merchant/reports/download?format=${format}&range=${dateRange}&token=${token}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-[60px]">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 style={{ color: theme.text.primary }} className="text-2xl font-bold m-0">
          Reports & Analytics
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => downloadReport('csv')}
            className="py-2.5 px-5 rounded-lg text-sm font-semibold cursor-pointer border-none hover:opacity-80 transition-all"
            style={{ background: '#10B981', color: '#FFF' }}
          >
            📥 Export CSV
          </button>
          <button
            onClick={() => downloadReport('pdf')}
            className="py-2.5 px-5 rounded-lg text-sm font-semibold cursor-pointer border-none hover:opacity-80 transition-all"
            style={{ background: '#EF4444', color: '#FFF' }}
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {['today', 'week', 'month', 'quarter', 'year'].map(range => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            style={{
              background: dateRange === range ? theme.accent.primary : `${theme.accent.primary}15`,
              color: dateRange === range ? (isDarkMode ? '#181D40' : '#FFF') : theme.accent.primary,
              borderColor: theme.border.primary
            }}
            className="py-2.5 px-5 border-2 rounded-lg text-sm font-semibold cursor-pointer capitalize transition-all hover:opacity-80"
          >
            {range === 'today' ? 'Today' : range}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <ReportCard
          title="TOTAL REVENUE"
          value={`₱${(reportData?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon="💰"
          color="#F59E0B"
          theme={theme}
        />
        <ReportCard
          title="TOTAL TRANSACTIONS"
          value={(reportData?.totalTransactions || 0).toLocaleString()}
          icon="💳"
          color="#3B82F6"
          theme={theme}
        />
        <ReportCard
          title="AVG TRANSACTION"
          value={`₱${(reportData?.avgTransaction || 0).toFixed(2)}`}
          icon="📊"
          color="#10B981"
          theme={theme}
        />
        <ReportCard
          title="ACTIVE MERCHANTS"
          value={reportData?.activeMerchants || 0}
          icon="🏪"
          color="#A855F7"
          theme={theme}
        />
      </div>

      {/* Top Performing Merchants */}
      {reportData?.topMerchants && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary }}
            className="rounded-2xl border-2 overflow-hidden flex-1 flex flex-col">
            <div style={{ borderColor: theme.border.primary }} className="p-4 border-b flex-shrink-0">
              <h3 style={{ color: theme.accent.primary }} className="m-0 mb-1 text-base font-bold">
                🏆 Top Performing Merchants
              </h3>
              <p style={{ color: theme.text.secondary }} className="m-0 text-xs">
                Ranked by revenue for the selected period
              </p>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {reportData.topMerchants.map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: theme.border.primary
                  }}
                  className="flex justify-between items-center p-3 rounded-xl mb-2 border"
                >
                  <span style={{ color: theme.text.primary }} className="font-semibold">{m.name}</span>
                  <span className="font-bold text-emerald-500">₱{m.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Report Card - Matches Treasury StatCard pattern
function ReportCard({ title, value, icon, color, theme }) {
  return (
    <div style={{
      background: theme.bg.card,
      borderColor: theme.border.primary
    }} className="p-4 rounded-2xl border relative overflow-hidden transition-all duration-300">
      <div className="absolute right-3 top-3 text-[32px] opacity-15">
        {icon}
      </div>
      <div style={{ color: theme.text.secondary }} className="text-[10px] font-bold uppercase tracking-wide mb-2">
        {title}
      </div>
      <div style={{ color: theme.text.primary }} className="text-2xl font-extrabold mb-1">
        {value}
      </div>
      <div className="text-[10px] font-semibold inline-block py-[2px] px-[8px] rounded-lg" style={{
        color: color,
        background: `${color}20`
      }}>
        {title.toLowerCase()}
      </div>
    </div>
  );
}

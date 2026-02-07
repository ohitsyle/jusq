// src/pages/admin/Treasury/MerchantsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Search, X, Store, TrendingUp, Calendar, Clock, DollarSign, Users, Truck, RefreshCw } from 'lucide-react';

export default function MerchantsPage() {
  const { theme, isDarkMode } = useTheme();
  const [allMerchants, setAllMerchants] = useState([]); // ✅ NEW: For stats
  const [merchants, setMerchants] = useState([]); // For display
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const intervalRef = useRef(null);

  // ✅ NEW: Fetch all merchants for stats (no filters)
  const fetchAllMerchantsForStats = async () => {
    try {
      const data = await api.get('/admin/treasury/merchants?limit=999'); // No filters
      if (data?.merchants) {
        setAllMerchants(data.merchants);
      }
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  // Fetch filtered merchants for display
  const fetchMerchants = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active');
      if (searchTerm) params.append('search', searchTerm);

      const data = await api.get(`/admin/treasury/merchants?${params}`);
      if (data?.merchants) {
        setMerchants(data.merchants);
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load merchants');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMerchantsForStats(); // ✅ Fetch stats once on mount
    fetchMerchants();

    intervalRef.current = setInterval(() => {
      fetchAllMerchantsForStats(); // ✅ Update stats periodically
      fetchMerchants(true);
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [statusFilter, searchTerm]);

  // ✅ FIXED: Remove redundant local filtering
  const filteredMerchants = merchants; // Already filtered by API

  // ✅ FIXED: Calculate stats from ALL merchants
  const totalMerchants = allMerchants.length;
  const activeMerchants = allMerchants.filter(m => m.isActive !== false).length;
  const totalCollections = allMerchants.reduce((sum, m) => sum + (m.totalCollections || 0), 0);
  const todayCollections = allMerchants.reduce((sum, m) => sum + (m.todayCollections || 0), 0);

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>🏪</span> Merchants
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          View merchant accounts and transaction metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(59, 130, 246, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(59, 130, 246, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <Store className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Total Merchants</p>
            <p className="text-2xl font-bold text-blue-500">{totalMerchants}</p>
          </div>
        </div>

        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(16, 185, 129, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(16, 185, 129, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Active</p>
            <p className="text-2xl font-bold text-emerald-500">{activeMerchants}</p>
          </div>
        </div>

        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(251, 191, 36, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(251, 191, 36, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Total Collections</p>
            <p className="text-2xl font-bold text-yellow-500">₱{totalCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(139, 92, 246, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(139, 92, 246, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <Calendar className="w-6 h-6 text-violet-500" />
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Today's Collections</p>
            <p className="text-2xl font-bold text-violet-500">₱{todayCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Actions Bar - ManageUsers Style */}
      <div
        style={{
          background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
          borderColor: theme.accent.primary
        }}
        className="rounded-xl border-2 p-4 mb-5"
      >
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Left: Search & Filters */}
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
              <input
                type="text"
                placeholder="Search merchants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50"
              />
            </div>

            {/* Status Filter - Segmented Control */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
              {[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  style={{
                    background: statusFilter === option.value ? theme.accent.primary : 'transparent',
                    color: statusFilter === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 capitalize"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p style={{ color: theme.text.secondary }} className="text-sm">
          Showing <span style={{ color: theme.accent.primary }} className="font-bold">{filteredMerchants.length}</span> of {allMerchants.length} merchants
        </p>
      </div>

      {/* Merchants Grid */}
      <div className="flex-1">
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden">
          {loading ? (
            <div style={{ color: theme.accent.primary }} className="text-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
              Loading merchants...
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div style={{ color: theme.text.tertiary }} className="text-center py-20">
              <div className="text-5xl mb-4">🏪</div>
              <p className="font-semibold">No merchants found</p>
              <p className="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredMerchants.map((merchant) => (
                <MerchantCard
                  key={merchant._id || merchant.merchantId}
                  merchant={merchant}
                  theme={theme}
                  isDarkMode={isDarkMode}
                  onView={() => setSelectedMerchant(merchant)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Merchant Details Modal */}
      {selectedMerchant && (
        <MerchantModal
          merchant={selectedMerchant}
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedMerchant(null)}
        />
      )}
    </div>
  );
}

// Merchant Card Component
function MerchantCard({ merchant, theme, isDarkMode, onView }) {
  const isActive = merchant.isActive !== false;
  const isMotorpool = merchant.type === 'motorpool';

  return (
    <div
      style={{
        background: isDarkMode ? 'rgba(30,35,71,0.6)' : theme.bg.tertiary,
        borderColor: isMotorpool ? 'rgba(139, 92, 246, 0.4)' : theme.border.primary
      }}
      className="p-5 rounded-xl border cursor-pointer hover:opacity-90 transition relative overflow-hidden"
      onClick={onView}
    >
      {/* Motorpool Badge */}
      {isMotorpool && (
        <div
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' }}
          className="absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-white text-xs font-bold flex items-center gap-1"
        >
          <Truck className="w-3 h-3" /> Shuttle
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div
          style={{
            background: isMotorpool ? 'rgba(139,92,246,0.15)' : 'rgba(255,212,28,0.15)',
            color: isMotorpool ? '#8B5CF6' : '#FFD41C'
          }}
          className="px-3 py-1 rounded-lg text-xs font-bold"
        >
          {merchant.merchantId || 'N/A'}
        </div>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: isActive ? '#10B981' : '#EF4444'
        }} />
      </div>

      <h4 style={{ color: theme.text.primary }} className="font-bold text-lg mb-2">
        {merchant.businessName || merchant.name || 'Unknown'}
      </h4>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span style={{ color: theme.text.secondary }} className="text-xs">Total Collections</span>
          <span style={{ color: '#3B82F6' }} className="font-bold text-sm">
            ₱{(merchant.totalCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: theme.text.secondary }} className="text-xs">Transactions</span>
          <span style={{ color: theme.text.primary }} className="font-bold text-sm">
            {(merchant.totalTransactions || 0).toLocaleString()}
          </span>
        </div>
      </div>

      <button
        style={{
          background: isMotorpool
            ? 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)'
            : theme.accent.primary,
          color: isMotorpool ? '#FFFFFF' : theme.accent.secondary
        }}
        className="w-full mt-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition"
      >
        View Details
      </button>
    </div>
  );
}

// Merchant Modal Component
function MerchantModal({ merchant, theme, isDarkMode, onClose }) {
  const [activeTab, setActiveTab] = useState('metrics');
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isMotorpool = merchant.type === 'motorpool';

  useEffect(() => {
    fetchMerchantDetails();
  }, [merchant.merchantId, currentPage]);

  const fetchMerchantDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/admin/treasury/merchants/${merchant.merchantId}/details?page=${currentPage}&limit=10`);
      if (data?.success) {
        setDetails(data.merchant);
        setMetrics(data.metrics);
        setTransactions(data.transactions || []);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      toast.error('Failed to load merchant details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabs = [
    { id: 'metrics', label: 'Metrics & Info', icon: TrendingUp },
    { id: 'transactions', label: 'Recent Transactions', icon: Clock }
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal Content - FIXED SIZE */}
      <div
        style={{
          background: isDarkMode ? '#1E2347' : '#FFFFFF',
          borderColor: theme.border.primary
        }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-5xl overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: isMotorpool
              ? 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)'
              : `linear-gradient(135deg, ${theme.accent.primary} 0%, ${isDarkMode ? '#B8860B' : '#2563EB'} 100%)`
          }}
          className="px-6 py-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div
              style={{ background: 'rgba(255,255,255,0.2)' }}
              className="w-14 h-14 rounded-full flex items-center justify-center"
            >
              {isMotorpool ? (
                <Truck className="w-7 h-7 text-white" />
              ) : (
                <Store className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {merchant.businessName || merchant.name}
              </h2>
              <p className="text-white/80 text-sm font-mono">
                {merchant.merchantId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }}
          className="px-6 py-3 border-b flex gap-2"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id
                    ? (isMotorpool ? '#8B5CF6' : theme.accent.primary)
                    : 'transparent',
                  color: activeTab === tab.id
                    ? (isMotorpool || !isDarkMode ? '#FFFFFF' : '#181D40')
                    : theme.text.secondary,
                  borderColor: activeTab === tab.id ? 'transparent' : theme.border.primary
                }}
                className="px-4 py-2 rounded-lg font-semibold text-sm border flex items-center gap-2 transition-all hover:opacity-80"
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content - FIXED HEIGHT */}
        <div className="p-6 overflow-y-auto" style={{ height: '500px' }}>
          {loading ? (
            <div style={{ color: theme.accent.primary }} className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
              Loading details...
            </div>
          ) : activeTab === 'metrics' ? (
            <MetricsTab
              merchant={details || merchant}
              metrics={metrics}
              theme={theme}
              isDarkMode={isDarkMode}
              isMotorpool={isMotorpool}
            />
          ) : (
            <TransactionsTab
              transactions={transactions}
              theme={theme}
              isDarkMode={isDarkMode}
              isMotorpool={isMotorpool}
              formatDate={formatDate}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// Metrics Tab Component
function MetricsTab({ merchant, metrics, theme, isDarkMode, isMotorpool }) {
  const accentColor = isMotorpool ? '#8B5CF6' : theme.accent.primary;

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div
          style={{
            background: isDarkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.1)',
            borderColor: 'rgba(16,185,129,0.3)'
          }}
          className="p-4 rounded-xl border"
        >
          <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">Today's Collections</p>
          <p className="text-2xl font-bold text-emerald-500">
            ₱{(metrics?.todayCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p style={{ color: theme.text.muted }} className="text-xs mt-1">
            {metrics?.todayTransactions || 0} transactions
          </p>
        </div>

        <div
          style={{
            background: isDarkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.1)',
            borderColor: 'rgba(59,130,246,0.3)'
          }}
          className="p-4 rounded-xl border"
        >
          <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">This Week</p>
          <p className="text-2xl font-bold text-blue-500">
            ₱{(metrics?.weekCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p style={{ color: theme.text.muted }} className="text-xs mt-1">
            {metrics?.weekTransactions || 0} transactions
          </p>
        </div>

        <div
          style={{
            background: isDarkMode ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.1)',
            borderColor: 'rgba(251,191,36,0.3)'
          }}
          className="p-4 rounded-xl border"
        >
          <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">This Month</p>
          <p className="text-2xl font-bold text-yellow-500">
            ₱{(metrics?.monthCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p style={{ color: theme.text.muted }} className="text-xs mt-1">
            {metrics?.monthTransactions || 0} transactions
          </p>
        </div>

        <div
          style={{
            background: isMotorpool ? 'rgba(139,92,246,0.1)' : (isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)'),
            borderColor: isMotorpool ? 'rgba(139,92,246,0.3)' : (isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)')
          }}
          className="p-4 rounded-xl border"
        >
          <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">All Time</p>
          <p className="text-2xl font-bold" style={{ color: accentColor }}>
            ₱{(metrics?.totalCollections || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
          <p style={{ color: theme.text.muted }} className="text-xs mt-1">
            {metrics?.totalTransactions || 0} transactions
          </p>
        </div>
      </div>

      {/* Merchant Info */}
      <div>
        <h4 style={{ color: theme.text.primary }} className="font-bold mb-3 flex items-center gap-2">
          {isMotorpool ? <Truck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
          {isMotorpool ? 'Motorpool Info' : 'Merchant Info'}
        </h4>
        <div
          style={{
            background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
            borderColor: theme.border.primary
          }}
          className="rounded-xl border p-4 space-y-3"
        >
          <div className="flex justify-between">
            <span style={{ color: theme.text.secondary }} className="text-sm">Status</span>
            <span
              style={{
                background: merchant.isActive !== false ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                color: merchant.isActive !== false ? '#10B981' : '#EF4444'
              }}
              className="px-2 py-0.5 rounded text-xs font-bold"
            >
              {merchant.isActive !== false ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: theme.text.secondary }} className="text-sm">Type</span>
            <span style={{ color: theme.text.primary }} className="text-sm font-semibold capitalize">
              {merchant.type || 'Merchant'}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: theme.text.secondary }} className="text-sm">Email</span>
            <span style={{ color: theme.text.primary }} className="text-sm">
              {merchant.email || 'N/A'}
            </span>
          </div>
          {!isMotorpool && (
            <>
              <div className="flex justify-between">
                <span style={{ color: theme.text.secondary }} className="text-sm">Contact Person</span>
                <span style={{ color: theme.text.primary }} className="text-sm">
                  {merchant.firstName && merchant.lastName
                    ? `${merchant.firstName} ${merchant.lastName}`
                    : 'N/A'}
                </span>
              </div>
              {merchant.licenseNumber && (
                <div className="flex justify-between">
                  <span style={{ color: theme.text.secondary }} className="text-sm">License #</span>
                  <span style={{ color: theme.text.primary }} className="text-sm font-mono">
                    {merchant.licenseNumber}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between">
            <span style={{ color: theme.text.secondary }} className="text-sm">Registered</span>
            <span style={{ color: theme.text.muted }} className="text-sm">
              {merchant.createdAt ? new Date(merchant.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Transactions Tab Component
function TransactionsTab({ transactions, theme, isDarkMode, isMotorpool, formatDate, currentPage, totalPages, onPageChange }) {
  if (transactions.length === 0) {
    return (
      <div style={{ color: theme.text.tertiary }} className="text-center py-10">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-semibold">No transactions yet</p>
        <p className="text-sm mt-1">Transactions will appear here once made</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div
        style={{
          background: isDarkMode ? 'rgba(15,18,39,0.3)' : '#FFFFFF',
          borderColor: theme.border.primary
        }}
        className="rounded-xl border overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead
              style={{
                background: isDarkMode ? 'rgba(15,18,39,0.8)' : '#F9FAFB',
                borderColor: theme.border.primary
              }}
            >
              <tr className="border-b">
                <th
                  style={{ color: theme.text.secondary }}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                >
                  User
                </th>
                <th
                  style={{ color: theme.text.secondary }}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                >
                  Description
                </th>
                <th
                  style={{ color: theme.text.secondary }}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                >
                  Date & Time
                </th>
                <th
                  style={{ color: theme.text.secondary }}
                  className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider"
                >
                  Amount
                </th>
                <th
                  style={{ color: theme.text.secondary }}
                  className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                >
                  Status
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {transactions.map((tx, index) => {
                const isRefund = tx.status === 'Refunded';
                const isCompleted = tx.status === 'Completed';
                
                return (
                  <tr
                    key={tx._id || index}
                    style={{
                      borderColor: theme.border.primary,
                      background: isDarkMode 
                        ? (index % 2 === 0 ? 'rgba(30,35,71,0.3)' : 'rgba(15,18,39,0.3)')
                        : (index % 2 === 0 ? '#FFFFFF' : '#F9FAFB')
                    }}
                    className="border-b hover:opacity-80 transition-opacity"
                  >
                    {/* User Column */}
                    <td className="px-4 py-3">
                      <p
                        style={{ color: theme.text.primary }}
                        className="font-semibold text-sm"
                      >
                        {tx.userName || 'Unknown User'}
                      </p>
                    </td>

                    {/* Description Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div
                          style={{
                            background: isRefund 
                              ? 'rgba(239,68,68,0.2)' 
                              : (isMotorpool ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)')
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        >
                          {isRefund ? (
                            <RefreshCw className="w-4 h-4 text-red-500" />
                          ) : isMotorpool ? (
                            <Truck className="w-4 h-4 text-violet-500" />
                          ) : (
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            style={{ color: isRefund ? '#EF4444' : theme.text.primary }}
                            className="text-sm font-medium break-words"
                          >
                            {tx.itemDescription || 'Payment'}
                          </p>
                          {tx.transactionId && (
                            <p
                              style={{ color: theme.text.muted }}
                              className="text-xs font-mono mt-1"
                            >
                              TXN: {tx.transactionId}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Date Column */}
                    <td className="px-4 py-3">
                      <div>
                        <p
                          style={{ color: theme.text.primary }}
                          className="text-sm font-semibold whitespace-nowrap"
                        >
                          {new Date(tx.timestamp || tx.createdAt).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p
                          style={{ color: theme.text.muted }}
                          className="text-xs whitespace-nowrap mt-0.5"
                        >
                          {new Date(tx.timestamp || tx.createdAt).toLocaleTimeString('en-PH', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </td>

                    {/* Amount Column */}
                    <td className="px-4 py-3 text-right">
                      <p
                        className={`font-bold text-base ${
                          isRefund ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {isRefund ? '-' : '+'}₱{(tx.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                    </td>

                    {/* Status Column */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span
                          style={{
                            background: isRefund 
                              ? 'rgba(239,68,68,0.2)' 
                              : isCompleted 
                                ? 'rgba(16,185,129,0.2)' 
                                : 'rgba(251,191,36,0.2)',
                            color: isRefund 
                              ? '#EF4444' 
                              : isCompleted 
                                ? '#10B981' 
                                : '#F59E0B'
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap"
                        >
                          {tx.status || 'Completed'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB',
              color: theme.text.primary,
              borderColor: theme.border.primary
            }}
            className="px-4 py-2 rounded-lg font-semibold text-sm border disabled:opacity-50 transition hover:opacity-80"
          >
            Previous
          </button>
          <span
            style={{
              color: theme.text.secondary,
              background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
              borderColor: theme.border.primary
            }}
            className="px-4 py-2 text-sm border rounded-lg flex items-center"
          >
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB',
              color: theme.text.primary,
              borderColor: theme.border.primary
            }}
            className="px-4 py-2 rounded-lg font-semibold text-sm border disabled:opacity-50 transition hover:opacity-80"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
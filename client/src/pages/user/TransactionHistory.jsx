// src/pages/user/TransactionHistory.jsx
// User's transaction history - matches Treasury admin style
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { Mail, Search, Filter, Calendar, X, CheckCircle, Eye } from 'lucide-react';

export default function TransactionHistory() {
  const { theme, isDarkMode } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const intervalRef = useRef(null);

  // Helper function to get transaction description
  const getTransactionDescription = (tx) => {
    const txType = tx.transactionType || tx.type;
    const txStatus = tx.status;

    // Handle REFUNDED transactions FIRST (before checking type)
    if (txStatus === 'Refunded') {
      // Check if it's a shuttle refund
      if (tx.shuttleId) {
        const plateNumber = tx.plateNumber || tx.shuttle?.plateNumber;
        return plateNumber
          ? `Refund: NU Shuttle Service (${plateNumber})`
          : 'Refund: NU Shuttle Service';
      }
      
      // Check if it's a merchant refund (was originally a debit/payment)
      if (tx.merchantName || tx.businessName) {
        const merchantInfo = tx.businessName || tx.merchantName || 'Merchant';
        return `Refund: ${merchantInfo}`;
      }
      
      // Otherwise it's a cash-in refund from Treasury
      return 'Refund: Treasury Office';
    }

    // Handle DEBIT transactions (payments) - non-refunded
    if (txType === 'debit') {
      // Check if it's a shuttle payment
      if (tx.shuttleId) {
        const plateNumber = tx.plateNumber || tx.shuttle?.plateNumber;
        return plateNumber
          ? `Payment to NU Shuttle Service (${plateNumber})`
          : 'Payment to NU Shuttle Service';
      }
      
      // Otherwise it's a merchant payment
      const merchantInfo = tx.businessName || tx.merchantName || tx.description || 'Merchant';
      return `Payment to ${merchantInfo}`;
    }

    // Handle CREDIT transactions (cash-in) - non-refunded
    if (txType === 'credit') {
      return 'Cash-In';
    }

    return tx.description || 'Transaction';
  };

  const fetchTransactions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const data = await api.get(`/user/transactions?${params}`);
      if (data?.transactions) {
        setTransactions(data.transactions);
        if (data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: data.pagination.total || 0,
            totalPages: data.pagination.totalPages || 1
          }));
        }
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load transactions');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    intervalRef.current = setInterval(() => fetchTransactions(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [typeFilter, pagination.page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleRequestHistory = async () => {
    setRequesting(true);
    try {
      // Send request to backend to email transaction history
      await api.post('/user/request-transaction-history', {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined
      });
      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestSuccess(false);
      }, 2000);
    } catch (error) {
      toast.error('Failed to request transaction history. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  // Filter transactions locally for search, type, and date range
  const filteredTransactions = transactions.filter(tx => {
    // Type filter
    if (typeFilter !== 'all') {
      const txType = tx.transactionType || tx.type;
      const isRefund = tx.status === 'Refunded';
      
      // Refunds should be treated as credit (cash-in) regardless of original type
      const effectiveType = isRefund ? 'credit' : txType;
      
      if (effectiveType !== typeFilter) return false;
    }
    
    // Date range filter
    if (startDate || endDate) {
      const txDate = new Date(tx.createdAt || tx.date);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (txDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (txDate > end) return false;
      }
    }
    
    // Search filter
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      tx.transactionId?.toLowerCase().includes(query) ||
      tx._id?.toLowerCase().includes(query) ||
      tx.description?.toLowerCase().includes(query) ||
      tx.merchant?.name?.toLowerCase().includes(query) ||
      tx.merchantName?.toLowerCase().includes(query) ||
      tx.businessName?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
        Loading transactions...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)' }} className="mb-6 border-b-2 pb-5">
        <div className="mb-5">
          <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
            <span>📜</span> Transaction History
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            Showing {filteredTransactions.length} of {pagination.total || transactions.length} transactions • Auto-refreshes every 30s
          </p>
        </div>

        {/* Filters Row - Matches Treasury admin style */}
        <div className="flex gap-3 items-end flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label style={{ color: theme.text.secondary }} className="block text-[11px] font-bold uppercase tracking-wide mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.text.muted }} />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                style={{ background: theme.bg.tertiary, color: theme.text.primary, borderColor: theme.border.primary }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="min-w-[140px]">
            <label style={{ color: theme.text.secondary }} className="block text-[11px] font-bold uppercase tracking-wide mb-2">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              style={{ background: theme.bg.tertiary, color: theme.text.primary, borderColor: theme.border.primary }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex gap-2 items-end">
            <div>
              <label style={{ color: theme.text.secondary }} className="hidden sm:block text-[11px] font-bold uppercase tracking-wide mb-2">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ background: theme.bg.tertiary, color: theme.text.primary, borderColor: theme.border.primary }}
                className="px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </div>
            <div>
              <label style={{ color: theme.text.secondary }} className="hidden sm:block text-[11px] font-bold uppercase tracking-wide mb-2">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ background: theme.bg.tertiary, color: theme.text.primary, borderColor: theme.border.primary }}
                className="px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
            </div>
          </div>

          {/* Request Transaction History Button */}
          <button
            onClick={() => setShowRequestModal(true)}
            style={{
              background: isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
              color: '#3B82F6',
              borderColor: 'rgba(59,130,246,0.3)'
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 font-semibold text-sm hover:opacity-80 transition whitespace-nowrap"
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Request History</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 overflow-y-auto">
        {filteredTransactions.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <p>No transactions found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden">
            <div className="max-h-[500px] lg:max-h-[70vh] overflow-y-auto">
              <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="sticky top-0 z-10 backdrop-blur-md" style={{ 
                  background: isDarkMode 
                    ? 'rgba(255,212,28,0.15)' 
                    : 'rgba(59,130,246,0.15)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)'
                }}>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left pl-4 sm:pl-8 md:pl-12 lg:pl-20 pr-2 sm:pr-4 py-3 sm:py-4 text-[11px] font-extrabold uppercase border-b-2 w-[25%]">Date</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left px-2 sm:p-4 py-3 sm:py-4 text-[11px] font-extrabold uppercase border-b-2 w-[25%]">Description</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left px-2 sm:p-4 py-3 sm:py-4 text-[11px] font-extrabold uppercase border-b-2 w-[25%]">Amount</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="hidden lg:table-cell text-left p-4 text-[11px] font-extrabold uppercase border-b-2 w-[25%]">Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, idx) => {
                  const txType = tx.transactionType || tx.type;
                  const description = getTransactionDescription(tx);
                  const isRefund = tx.status === 'Refunded';
                  return (
                    <tr
                      key={tx._id || tx.id || idx}
                      onClick={() => setSelectedTransaction(tx)}
                      className="hover:bg-white/5 transition cursor-pointer"
                      style={{ borderBottom: `1px solid ${theme.border.primary}` }}
                    >
                      <td style={{ color: theme.text.primary }} className="pl-4 sm:pl-8 md:pl-12 lg:pl-20 pr-2 sm:pr-4 py-3 sm:py-4 w-[15%]">
                        <div className="font-semibold text-xs sm:text-sm">{tx.date || new Date(tx.createdAt).toLocaleDateString()}</div>
                        <div style={{ color: theme.text.muted }} className="text-xs hidden lg:block">{tx.time || new Date(tx.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td style={{ color: theme.text.primary }} className="px-2 sm:p-4 py-3 sm:py-4 w-[35%]">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div style={{
                            background: isRefund ? 'rgba(59,130,246,0.2)' : (txType === 'credit' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)')
                          }} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0">
                            {isRefund ? '↩️' : (txType === 'credit' ? '💵' : tx.shuttleId ? '🚐' : '🛒')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs sm:text-sm truncate lg:whitespace-normal" title={description}>
                              <span className="lg:hidden">
                                {description.length > 20 ? `${description.substring(0, 20)}...` : description}
                              </span>
                              <span className="hidden lg:inline">
                                {description}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:p-4 py-3 sm:py-4 w-[20%]">
                        <span style={{ color: isRefund ? '#3B82F6' : (txType === 'credit' ? '#10B981' : '#EF4444') }} className="font-bold text-xs sm:text-base whitespace-nowrap">
                          {isRefund ? '+' : (txType === 'credit' ? '+' : '-')}₱{Math.abs(tx.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td style={{ color: theme.text.primary }} className="hidden lg:table-cell p-4 w-[25%]">
                        <code style={{ 
                          background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}>
                          {tx.transactionId || tx.id || 'N/A'}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ borderColor: theme.border.primary }} className="p-4 border-t flex items-center justify-between flex-wrap gap-3">
                <p style={{ color: theme.text.muted }} className="text-xs sm:text-sm">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    style={{
                      background: pagination.page === 1 ? 'rgba(100,100,100,0.2)' : theme.bg.tertiary,
                      color: pagination.page === 1 ? theme.text.muted : theme.accent.primary,
                      borderColor: pagination.page === 1 ? 'transparent' : theme.accent.primary
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm border-2 font-semibold disabled:cursor-not-allowed transition hover:opacity-80"
                  >
                    ← <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    style={{
                      background: pagination.page === pagination.totalPages ? 'rgba(100,100,100,0.2)' : theme.bg.tertiary,
                      color: pagination.page === pagination.totalPages ? theme.text.muted : theme.accent.primary,
                      borderColor: pagination.page === pagination.totalPages ? 'transparent' : theme.accent.primary
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm border-2 font-semibold disabled:cursor-not-allowed transition hover:opacity-80"
                  >
                    <span className="hidden sm:inline">Next</span><span className="sm:hidden">Next</span> →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal - Only shows on mobile */}
      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          theme={theme}
          isDarkMode={isDarkMode}
          getTransactionDescription={getTransactionDescription}
        />
      )}

      {/* Request Transaction History Modal */}
      {showRequestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => !requesting && setShowRequestModal(false)}
        >
          <div
            style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
            className="w-full max-w-md rounded-2xl border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {requestSuccess ? (
              <div className="p-8 text-center">
                <div style={{ background: 'rgba(16,185,129,0.2)' }} className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-500 mb-2">Request Sent!</h3>
                <p style={{ color: theme.text.secondary }}>
                  Your transaction history will be sent to your email shortly.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' }} className="p-5 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="w-6 h-6 text-blue-500" />
                      <div>
                        <h2 className="text-lg font-bold text-blue-500">Request Transaction History</h2>
                        <p style={{ color: theme.text.secondary }} className="text-sm">Get a formatted copy via email</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRequestModal(false)}
                      disabled={requesting}
                      style={{ color: theme.text.secondary }}
                      className="hover:opacity-70 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                  <p style={{ color: theme.text.secondary }} className="text-sm">
                    We'll send a formatted PDF of your transaction history to your registered email address.
                  </p>

                  <div style={{ background: theme.bg.tertiary, borderColor: theme.border.primary }} className="p-4 rounded-xl border">
                    <div className="flex items-center gap-3 mb-3">
                      <Calendar className="w-5 h-5" style={{ color: theme.accent.primary }} />
                      <span style={{ color: theme.text.primary }} className="font-semibold">Date Range (Optional)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={{ color: theme.text.secondary }} className="block text-xs font-bold uppercase mb-1">From</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{ background: theme.bg.secondary, color: theme.text.primary, borderColor: theme.border.primary }}
                          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label style={{ color: theme.text.secondary }} className="block text-xs font-bold uppercase mb-1">To</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{ background: theme.bg.secondary, color: theme.text.primary, borderColor: theme.border.primary }}
                          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <p style={{ color: theme.text.muted }} className="text-xs mt-2">
                      Leave empty to get all transactions
                    </p>
                  </div>

                  <div style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }} className="p-4 rounded-xl border">
                    <p style={{ color: theme.text.secondary }} className="text-sm">
                      <strong style={{ color: '#3B82F6' }}>Note:</strong> The email will be sent to your registered email address and may take a few minutes to arrive. Check your spam folder if you don't see it.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t" style={{ borderColor: theme.border.primary }}>
                  <button
                    onClick={() => setShowRequestModal(false)}
                    disabled={requesting}
                    style={{ background: theme.bg.tertiary, color: theme.text.primary, borderColor: theme.border.primary }}
                    className="flex-1 py-3 rounded-xl font-semibold border hover:opacity-80 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestHistory}
                    disabled={requesting}
                    className="flex-1 py-3 rounded-xl font-bold bg-blue-500 text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {requesting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send to Email
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Transaction Detail Modal Component - Only visible on mobile (lg:hidden)
function TransactionDetailModal({ transaction, onClose, theme, isDarkMode, getTransactionDescription }) {
  const txType = transaction.transactionType || transaction.type;
  const isRefund = transaction.status === 'Refunded';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, #1E2347 0%, #181D40 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
          boxShadow: isDarkMode
            ? '0 25px 50px rgba(0,0,0,0.5)'
            : '0 25px 50px rgba(0,0,0,0.15)'
        }}
        className="relative rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: isDarkMode
              ? `linear-gradient(135deg, ${isRefund ? 'rgba(59,130,246,0.2)' : (txType === 'credit' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)')} 0%, ${isRefund ? 'rgba(59,130,246,0.05)' : (txType === 'credit' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)')} 100%)`
              : `linear-gradient(135deg, ${isRefund ? 'rgba(59,130,246,0.15)' : (txType === 'credit' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)')} 0%, ${isRefund ? 'rgba(59,130,246,0.05)' : (txType === 'credit' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)')} 100%)`,
            borderBottom: `2px solid ${isRefund ? 'rgba(59,130,246,0.3)' : (txType === 'credit' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)')}`
          }}
          className="px-6 py-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                background: isRefund ? 'rgba(59,130,246,0.2)' : (txType === 'credit' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)')
              }}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            >
              {isRefund ? '↩️' : (txType === 'credit' ? '💵' : transaction.shuttleId ? '🚐' : '🛒')}
            </div>
            <div>
              <h2 style={{ color: isRefund ? '#3B82F6' : (txType === 'credit' ? '#10B981' : '#EF4444') }} className="text-xl font-bold">
                Transaction Details
              </h2>
              <p style={{ color: theme.text.secondary }} className="text-sm">
                {transaction.date || new Date(transaction.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: theme.text.secondary }}
            className="p-2 hover:opacity-70 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Amount - Highlighted */}
          <div
            style={{
              background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`
            }}
            className="rounded-xl p-5 mb-5 text-center"
          >
            <p style={{ color: theme.text.secondary }} className="text-xs uppercase tracking-wide mb-2 font-bold">
              Amount
            </p>
            <p
              style={{ color: isRefund ? '#3B82F6' : (txType === 'credit' ? '#10B981' : '#EF4444') }}
              className="text-4xl font-bold"
            >
              {isRefund ? '+' : (txType === 'credit' ? '+' : '-')}₱{Math.abs(transaction.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Details Grid */}
          <div className="space-y-4">
            {/* Description */}
            <div>
              <p style={{ color: theme.text.secondary }} className="text-xs uppercase tracking-wide mb-1 font-bold">
                Description
              </p>
              <p style={{ color: theme.text.primary }} className="font-semibold">
                {getTransactionDescription(transaction)}
              </p>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p style={{ color: theme.text.secondary }} className="text-xs uppercase tracking-wide mb-1 font-bold">
                  Date
                </p>
                <p style={{ color: theme.text.primary }} className="font-semibold">
                  {transaction.date || new Date(transaction.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p style={{ color: theme.text.secondary }} className="text-xs uppercase tracking-wide mb-1 font-bold">
                  Time
                </p>
                <p style={{ color: theme.text.primary }} className="font-semibold">
                  {transaction.time || new Date(transaction.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Transaction ID */}
            <div>
              <p style={{ color: theme.text.secondary }} className="text-xs uppercase tracking-wide mb-2 font-bold">
                Transaction ID
              </p>
              <code
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: theme.text.primary,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  display: 'block',
                  wordBreak: 'break-all'
                }}
              >
                {transaction.transactionId || transaction.id || 'N/A'}
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{ borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}
          className="px-6 py-4"
        >
          <button
            onClick={onClose}
            style={{
              background: isRefund ? '#3B82F6' : (txType === 'credit' ? '#10B981' : '#EF4444'),
              color: '#FFFFFF'
            }}
            className="w-full py-3 rounded-xl font-bold transition-all hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
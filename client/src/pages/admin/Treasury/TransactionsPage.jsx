// src/pages/admin/Treasury/TransactionsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Search, Download } from 'lucide-react';
import TransactionTable from '../../../components/TreasuryDashboard/TransactionTable';
import { exportToCSV } from '../../../utils/csvExport';

export default function TransactionsPage() {
  const { theme, isDarkMode } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const intervalRef = useRef(null);

  const ITEMS_PER_PAGE = 20;

  const fetchTransactions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams();
      params.append('limit', '1000'); // Fetch more for client-side pagination
      if (filterType) {
        if (filterType === 'refunded') {
          params.append('status', 'Refunded');
        } else {
          params.append('transactionType', filterType);
        }
      }
      if (searchQuery) params.append('search', searchQuery);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const data = await api.get(`/admin/treasury/transactions?${params}`);
      if (data?.transactions) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load transactions');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    intervalRef.current = setInterval(() => fetchTransactions(true), 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [filterType, searchQuery, startDate, endDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery, startDate, endDate]);

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => ({
      Date: tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : tx.date || '',
      Time: tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString() : tx.time || '',
      'ID Number': tx.idNumber || tx.schoolUId || '',
      Name: tx.userName || '',
      Type: tx.transactionType === 'credit' ? 'Cash-In' : 'Payment',
      Status: tx.status || 'Completed',  
      Amount: tx.amount,
      'Processed By': tx.transactionType === 'credit' ? (tx.adminName || tx.processedBy || 'Treasury') : '—',
      'Transaction ID': tx.transactionId || tx._id || ''
    }));
    exportToCSV(dataToExport, 'transactions');
  };

  // Filter transactions locally for search
  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.transactionId?.toLowerCase().includes(query) ||
      tx._id?.toLowerCase().includes(query) ||
      tx.idNumber?.toLowerCase().includes(query) ||
      tx.schoolUId?.toLowerCase().includes(query) ||
      tx.userName?.toLowerCase().includes(query) ||
      tx.businessName?.toLowerCase().includes(query) ||
      tx.adminName?.toLowerCase().includes(query) ||
      tx.processedBy?.toLowerCase().includes(query)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const baseColor = isDarkMode ? '255, 212, 28' : '59, 130, 246';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 border-b-2 pb-5" style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)' }}>
        <div className="mb-5">
          <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
            <span>📋</span> Transactions
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transactions • Auto-refreshes every 10s
          </p>
        </div>

        {/* Actions Bar - ManageUsers Style */}
        <div
          style={{
            background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
            borderColor: theme.accent.primary
          }}
          className="rounded-xl border-2 p-4"
        >
          <div className="flex flex-wrap gap-3 items-center justify-between">
            {/* Left: Search & Filters + Export Button (at the end) */}
            <div className="flex flex-wrap gap-3 items-center flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by ID, name, transaction ID..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50"
                />
              </div>

              {/* Type Filter - Selection Buttons */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
                {[
                  { value: '', label: 'All' },
                  { value: 'credit', label: 'Cash-In' },
                  { value: 'debit', label: 'Payment' },
                  { value: 'refunded', label: 'Refunded' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setFilterType(option.value); setCurrentPage(1); }}
                    style={{
                      background: filterType === option.value ? theme.accent.primary : 'transparent',
                      color: filterType === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Date Range Filters */}
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                  style={{ 
                    background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', 
                    color: theme.text.primary, 
                    borderColor: theme.border.primary 
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs focus:outline-none"
                />
                <span style={{ color: theme.text.tertiary }} className="text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                  style={{ 
                    background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', 
                    color: theme.text.primary, 
                    borderColor: theme.border.primary 
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs focus:outline-none"
                />
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExport}
                disabled={filteredTransactions.length === 0}
                style={{ 
                  background: filteredTransactions.length === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)', 
                  color: filteredTransactions.length === 0 ? 'rgba(16,185,129,0.5)' : '#10B981', 
                  borderColor: filteredTransactions.length === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.3)' 
                }}
                className="px-4 py-2 rounded-xl font-semibold text-sm border flex items-center gap-2 hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table with Fixed Height */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div style={{ color: theme.accent.primary }} className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
            Loading transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <p>No transactions found</p>
          </div>
        ) : (
          <>
            {/* Table and Pagination Container - No Gap */}
            <div 
              style={{ 
                background: theme.bg.card,
                border: `1px solid rgba(${baseColor}, 0.2)`,
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(59,130,246,0.1)',
                display: 'flex',
                flexDirection: 'column',
                height: totalPages > 1 ? '660px' : '600px' // Adjust height to include pagination
              }}
            >
              {/* Fixed Height Table Container */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <TransactionTable
                  transactions={paginatedTransactions}
                  showHeader={false}
                  fixedHeight={true}
                />
              </div>

              {/* Pagination Controls - Attached to Bottom */}
              {totalPages > 1 && (
                <div 
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    background: theme.bg.secondary,
                    borderTop: `1px solid rgba(${baseColor}, 0.2)`,
                  }}
                >
                  <div style={{ color: theme.text.secondary, fontSize: '13px' }}>
                    Page {currentPage} of {totalPages} ({filteredTransactions.length} total)
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      style={{
                        padding: '8px 20px',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: currentPage === 1 ? theme.text.tertiary : theme.text.secondary,
                        border: 'none',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.color = theme.accent.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.color = theme.text.secondary;
                        }
                      }}
                    >
                      ← Previous
                    </button>
                    
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '8px 20px',
                        borderRadius: '6px',
                        background: currentPage === totalPages ? 'transparent' : theme.accent.primary,
                        color: currentPage === totalPages ? theme.text.tertiary : '#000000',
                        border: 'none',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.opacity = '0.9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.opacity = '1';
                        }
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
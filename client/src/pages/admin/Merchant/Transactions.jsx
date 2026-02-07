// src/pages/admin/Merchant/Transactions.jsx
// Merchant transactions list - Theme-aware, uses api utility

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';

export default function TransactionsList() {
  const { theme, isDarkMode } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTransactions();
    loadMerchants();
    const interval = setInterval(loadTransactions, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadTransactions = async () => {
    try {
      const data = await api.get(`/merchant/transactions?filter=${filter}`);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMerchants = async () => {
    try {
      const data = await api.get('/merchant/merchants');
      setMerchants(data.merchants || []);
    } catch (error) {
      console.error('Error loading merchants:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Merchant', 'Student', 'Amount', 'Status'];
    const csvRows = [headers.join(',')];

    filteredTransactions.forEach(tx => {
      const row = [
        new Date(tx.timestamp).toLocaleString(),
        `"${tx.merchantName || 'N/A'}"`,
        `"${tx.studentName || 'N/A'}"`,
        tx.amount.toFixed(2),
        tx.status
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    api.post('/admin/log-tab-export', { tabName: 'Merchant Transactions', recordCount: filteredTransactions.length, fileName: `transactions_${new Date().toISOString().split('T')[0]}.csv` }).catch(() => {});
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesMerchant = merchantFilter === 'all' || tx.merchantName === merchantFilter;
    const matchesSearch = !searchQuery ||
      tx.merchantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.amount?.toString().includes(searchQuery);
    return matchesMerchant && matchesSearch;
  });

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-[60px]">
        Loading transactions...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 style={{ color: theme.text.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-2.5">
            <span>💳</span> All Transactions
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredTransactions.length === 0}
          className="py-3 px-6 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border-2 hover:opacity-80"
          style={{
            background: filteredTransactions.length === 0 ? 'rgba(255,255,255,0.05)' : '#10B981',
            color: filteredTransactions.length === 0 ? theme.text.tertiary : '#FFF',
            borderColor: 'rgba(16,185,129,0.3)',
            cursor: filteredTransactions.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          <span>📥</span> Export to CSV
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="🔍 Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: isDarkMode ? 'rgba(30,35,71,0.5)' : 'rgba(0,0,0,0.04)',
            borderColor: theme.border.primary,
            color: theme.text.primary
          }}
          className="w-full max-w-[400px] py-3 px-4 border-2 rounded-xl text-sm outline-none mb-4"
        />

        {/* Time Period Filters */}
        <div className="flex gap-3 mb-3 flex-wrap">
          {['all', 'today', 'week', 'month'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? theme.accent.primary : `${theme.accent.primary}15`,
                color: filter === f ? (isDarkMode ? '#181D40' : '#FFF') : theme.accent.primary,
                borderColor: theme.border.primary
              }}
              className="py-2.5 px-5 border-2 rounded-lg text-sm font-semibold cursor-pointer capitalize transition-all hover:opacity-80"
            >
              {f}
            </button>
          ))}
        </div>

        {/* Merchant Filter */}
        <div className="flex items-center gap-3">
          <label style={{ color: theme.accent.primary }} className="text-sm font-semibold">
            Filter by Merchant:
          </label>
          <select
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            style={{
              background: isDarkMode ? 'rgba(30,35,71,0.5)' : 'rgba(0,0,0,0.04)',
              borderColor: theme.border.primary,
              color: theme.text.primary
            }}
            className="py-2.5 px-4 border-2 rounded-lg text-sm font-semibold cursor-pointer outline-none min-w-[200px]"
          >
            <option value="all">All Merchants</option>
            {merchants.map((merchant, idx) => (
              <option key={merchant._id || idx} value={merchant.businessName}>
                {merchant.businessName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 overflow-y-auto">
        {filteredTransactions.length === 0 ? (
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary, color: theme.text.tertiary }}
            className="text-center p-16 rounded-2xl border-2">
            <div className="text-5xl mb-4">💳</div>
            <div>{searchQuery || merchantFilter !== 'all' ? 'No transactions match your filters' : 'No transactions found'}</div>
          </div>
        ) : (
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary }}
            className="rounded-2xl border-2 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: `${theme.accent.primary}15` }}>
                  <th style={{ color: theme.accent.primary }} className="p-4 text-left text-xs font-bold uppercase">Date</th>
                  <th style={{ color: theme.accent.primary }} className="p-4 text-left text-xs font-bold uppercase">Merchant</th>
                  <th style={{ color: theme.accent.primary }} className="p-4 text-left text-xs font-bold uppercase">Student</th>
                  <th style={{ color: theme.accent.primary }} className="p-4 text-left text-xs font-bold uppercase">Amount</th>
                  <th style={{ color: theme.accent.primary }} className="p-4 text-left text-xs font-bold uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, i) => (
                  <tr
                    key={tx._id || i}
                    style={{
                      borderBottom: i < filteredTransactions.length - 1
                        ? `1px solid ${theme.border.primary}`
                        : 'none'
                    }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <td style={{ color: theme.text.secondary }} className="p-4 text-sm">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td style={{ color: theme.text.primary }} className="p-4 text-sm">
                      {tx.merchantName || 'N/A'}
                    </td>
                    <td style={{ color: theme.text.primary }} className="p-4 text-sm">
                      {tx.studentName || 'N/A'}
                    </td>
                    <td className="p-4 text-sm font-semibold text-emerald-500">
                      ₱{tx.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-sm">
                      <span className="inline-block py-1 px-3 rounded-full text-[10px] font-bold uppercase" style={{
                        background: tx.status === 'Completed' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        color: tx.status === 'Completed' ? '#10B981' : '#EF4444'
                      }}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

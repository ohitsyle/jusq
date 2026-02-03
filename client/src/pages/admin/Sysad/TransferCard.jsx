// src/pages/admin/Sysad/TransferCard.jsx
// Transfer RFID card data from one card to another - Table-based design like ManageUsers

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { CreditCard, ArrowRight, Search, AlertTriangle, CheckCircle, Loader2, User, RefreshCw, Users } from 'lucide-react';

// Custom Notification Modal for TransferCard
function TransferNotificationModal({ isOpen, onClose, type, title, message }) {
  const { theme, isDarkMode } = useTheme();
  if (!isOpen) return null;

  const configs = {
    success: { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    error: { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    warning: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' }
  };

  const config = configs[type] || configs.success;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: config.color }}
        className="relative rounded-2xl shadow-2xl border-2 w-full max-w-sm overflow-hidden animate-modalSlide"
      >
        <div style={{ background: config.bg }} className="p-6 flex flex-col items-center text-center">
          <div style={{ background: config.bg, color: config.color }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Icon className="w-8 h-8" />
          </div>
          <h3 style={{ color: config.color }} className="text-xl font-bold mb-2">{title}</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm">{message}</p>
        </div>
        <div className="p-4">
          <button onClick={onClose} style={{ background: config.color }} className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90">
            OK
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalSlide { from { opacity: 0; transform: scale(0.9) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-modalSlide { animation: modalSlide 0.25s ease-out; }
      `}</style>
    </div>
  );
}

// Confirmation Modal for TransferCard
function TransferConfirmModal({ isOpen, onClose, onConfirm, oldCard, newCard, userName }) {
  const { theme, isDarkMode } = useTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden animate-modalSlide"
      >
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <div style={{ background: 'rgba(245,158,11,0.15)' }} className="w-16 h-16 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <h3 style={{ color: theme.text.primary }} className="text-xl font-bold text-center mb-2">Confirm Card Transfer</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm text-center mb-4">
            You are about to transfer all data from one card to another. This action cannot be undone.
          </p>

          <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="rounded-xl border p-4 space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">User</span>
              <span style={{ color: theme.text.primary }} className="font-semibold">{userName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">From Card</span>
              <span className="font-mono text-red-500 font-semibold">{oldCard}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">To Card</span>
              <span className="font-mono text-emerald-500 font-semibold">{newCard}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }} className="rounded-xl border p-3 mb-4">
            <p className="text-red-500 text-xs text-center">
              The old card will be permanently deactivated
            </p>
          </div>
        </div>

        <div className="p-4 flex gap-3 border-t" style={{ borderColor: theme.border.primary }}>
          <button
            onClick={onClose}
            style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
            className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-90 bg-amber-500 text-white"
          >
            Transfer
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalSlide { from { opacity: 0; transform: scale(0.9) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-modalSlide { animation: modalSlide 0.25s ease-out; }
      `}</style>
    </div>
  );
}

// Role Badge Component
function RoleBadge({ role, isDarkMode }) {
  const configs = {
    sysad: { color: '#FFD41C', bg: isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(255,212,28,0.1)', label: 'SysAd' },
    admin: { color: '#3B82F6', bg: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', label: 'Admin' },
    merchant: { color: '#10B981', bg: isDarkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)', label: 'Merchant' },
    user: { color: '#8B5CF6', bg: isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)', label: 'User' }
  };

  const config = configs[role] || configs.user;

  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        borderColor: `${config.color}30`
      }}
      className="px-3 py-1 rounded-full text-xs font-bold border"
    >
      {config.label}
    </span>
  );
}

// Status Badge Component
function StatusBadge({ isActive }) {
  return (
    <span
      style={{
        background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
        color: isActive ? '#10B981' : '#EF4444',
        borderColor: isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
      }}
      className="px-3 py-1 rounded-full text-xs font-bold border"
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function TransferCard() {
  const { theme, isDarkMode } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newCardId, setNewCardId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);

  // Modal states
  const [notification, setNotification] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [showConfirm, setShowConfirm] = useState(false);

  // Use theme accent color
  const accentColor = theme.accent.primary;

  const showNotification = (type, title, message) => {
    setNotification({ isOpen: true, type, title, message });
  };

  // Load users
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/sysad/users?page=1&limit=100');
      setUsers(data.users || []);
    } catch (error) {
      showNotification('error', 'Load Failed', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    (user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.schoolUId?.includes(searchTerm) ||
     user.adminId?.toString().includes(searchTerm))
  );

  const handleTransferClick = (user) => {
    if (!newCardId.trim()) {
      showNotification('warning', 'Input Required', 'Please enter the new card ID.');
      return;
    }
    setSelectedUser(user);
    setShowConfirm(true);
  };

  const handleTransfer = async () => {
    setShowConfirm(false);
    setTransferring(true);

    try {
      await api.post('/admin/sysad/transfer-card', {
        oldCardUid: selectedUser.cardUid,
        newCardUid: newCardId.trim()
      });

      setTransferComplete(true);
      showNotification('success', 'Transfer Complete', `Card data transferred successfully for ${selectedUser.firstName} ${selectedUser.lastName}`);
      // Reload users to get updated data
      await loadUsers();
    } catch (error) {
      showNotification('error', 'Transfer Failed', error.message || 'Failed to transfer card. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const handleReset = () => {
    setSelectedUser(null);
    setNewCardId('');
    setTransferComplete(false);
  };

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: accentColor }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <CreditCard className="w-7 h-7" /> Transfer Card
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Transfer user data from one RFID card to another
        </p>
      </div>

      {/* Transfer Complete Success */}
      {transferComplete && (
        <div
          style={{
            background: isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
            borderColor: 'rgba(16,185,129,0.25)'
          }}
          className="p-8 rounded-2xl border mb-6 text-center"
        >
          <div style={{ background: 'rgba(16,185,129,0.15)' }} className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 style={{ color: '#10B981' }} className="text-2xl font-bold mb-2">Transfer Complete</h3>
          <p style={{ color: theme.text.secondary }} className="mb-6 text-sm max-w-md mx-auto">
            All user data has been successfully transferred to the new card. The previous card has been deactivated.
          </p>
          <button
            onClick={handleReset}
            style={{ background: accentColor }}
            className="px-8 py-3 rounded-xl font-semibold text-white hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            New Transfer
          </button>
        </div>
      )}

      {/* Main Content */}
      {!transferComplete && (
        <>
          {/* New Card Input */}
          <div
            style={{ background: theme.bg.card, borderColor: theme.border.primary }}
            className="rounded-2xl border p-6 mb-6"
          >
            <h3 style={{ color: accentColor }} className="font-bold text-sm uppercase tracking-wide mb-4">New RFID Card</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newCardId}
                onChange={(e) => setNewCardId(e.target.value)}
                placeholder="Enter new RFID card ID"
                style={{
                  background: theme.bg.input,
                  borderColor: theme.border.primary,
                  color: theme.text.primary
                }}
                className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Users Table */}
          <div
            style={{ background: theme.bg.card, borderColor: theme.border.primary }}
            className="rounded-2xl border overflow-hidden"
          >
            {/* Table Header */}
            <div
              style={{
                background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)',
                borderColor: theme.border.primary
              }}
              className="px-6 py-4 border-b flex justify-between items-center"
            >
              <h3 style={{ color: accentColor }} className="font-bold text-sm uppercase tracking-wide">Users with RFID Cards</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: theme.text.muted }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search users..."
                    style={{
                      background: theme.bg.input,
                      borderColor: theme.border.primary,
                      color: theme.text.primary
                    }}
                    className="pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-64"
                  />
                </div>
                <button
                  onClick={loadUsers}
                  style={{ background: 'rgba(255,212,28,0.15)', color: accentColor }}
                  className="p-2 rounded-lg hover:opacity-80 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ color: theme.text.tertiary }} className="text-center py-20">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-semibold">No users found</p>
                  <p className="text-sm mt-2">Try adjusting your search</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)' }}>
                      <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">ID Number</th>
                      <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Name</th>
                      <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Email</th>
                      <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Role</th>
                      <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Status</th>
                      <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-center p-4 text-xs font-bold uppercase border-b-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr
                        key={user._id}
                        style={{
                          borderColor: theme.border.primary,
                          animationDelay: `${index * 30}ms`
                        }}
                        className="border-b hover:bg-white/5 transition-all duration-200"
                      >
                        <td style={{ color: theme.text.primary }} className="p-4 font-mono font-semibold">
                          {user.cardUid || user.schoolUId || user.adminId || 'N/A'}
                        </td>
                        <td style={{ color: theme.text.primary }} className="p-4 font-semibold">
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}
                        </td>
                        <td style={{ color: theme.text.secondary }} className="p-4">
                          {user.email || 'N/A'}
                        </td>
                        <td className="p-4">
                          <RoleBadge role={user.role} isDarkMode={isDarkMode} />
                        </td>
                        <td className="p-4">
                          <StatusBadge isActive={user.isActive} />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleTransferClick(user)}
                              disabled={!newCardId.trim() || transferring}
                              style={{
                                background: newCardId.trim() ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                                color: newCardId.trim() ? '#10B981' : theme.text.muted,
                                borderColor: newCardId.trim() ? 'rgba(16,185,129,0.3)' : 'rgba(107,114,128,0.3)'
                              }}
                              className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all text-xs font-semibold border disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {transferring ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ArrowRight className="w-3 h-3" />
                              )}
                              Transfer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Transfer Confirmation Modal */}
      <TransferConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleTransfer}
        oldCard={selectedUser?.cardUid}
        newCard={newCardId}
        userName={`${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}`.trim()}
      />

      {/* Notification Modal */}
      <TransferNotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
}

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

// Card Input Modal for TransferCard
function CardInputModal({ isOpen, onClose, onSubmit, selectedUser }) {
  const { theme, isDarkMode } = useTheme();
  const [cardId, setCardId] = useState('');
  const accentColor = theme.accent.primary;
  
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
            <div style={{ background: 'rgba(255,212,28,0.15)' }} className="w-16 h-16 rounded-full flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <h3 style={{ color: theme.text.primary }} className="text-xl font-bold text-center mb-2">Enter New RFID Card</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm text-center mb-4">
            Enter the RFID card ID for transferring {selectedUser?.firstName} {selectedUser?.lastName}
          </p>

          <div className="space-y-4">
            <div>
              <label style={{ color: theme.text.primary }} className="block text-sm font-medium mb-2">
                RFID Card ID
              </label>
              <input
                type="text"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                placeholder="e.g., A1B2C3D4E5"
                style={{
                  background: theme.bg.input,
                  borderColor: theme.border.primary,
                  color: theme.text.primary
                }}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                autoFocus
              />
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
              onClick={() => onSubmit(cardId)}
              disabled={!cardId.trim()}
              style={{
                background: cardId.trim() ? accentColor : 'rgba(107,114,128,0.15)',
                color: cardId.trim() ? '#FFFFFF' : theme.text.muted
              }}
              className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
        <style>{`
          @keyframes modalSlide { from { opacity: 0; transform: scale(0.9) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          .animate-modalSlide { animation: modalSlide 0.25s ease-out; }
        `}</style>
      </div>
    </div>
  );
}
function TransferConfirmModal({ isOpen, onClose, onConfirm, selectedUser, newCardId }) {
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
          <h3 style={{ color: theme.text.primary }} className="text-xl font-bold text-center mb-2">Transfer User Information</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm text-center mb-4">
            Are you sure you want to transfer this user's information to a new RFID card?
          </p>

          <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="rounded-xl border p-4 space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">User</span>
              <span style={{ color: theme.text.primary }} className="font-semibold">{`${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}`.trim()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">Email</span>
              <span style={{ color: theme.text.primary }} className="font-semibold">{selectedUser?.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">Role</span>
              <span style={{ color: theme.text.primary }} className="font-semibold">{selectedUser?.role || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: theme.text.secondary }} className="text-sm">New Card ID</span>
              <span className="font-mono text-emerald-500 font-semibold">{newCardId}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }} className="rounded-xl border p-3 mb-4">
            <p className="text-blue-500 text-xs text-center">
              This will create a new user account with the transferred information and send an OTP for activation
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
            Transfer User
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
  const [transferring, setTransferring] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);
  const [showCardInput, setShowCardInput] = useState(false);
  const [newCardId, setNewCardId] = useState('');

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
    setSelectedUser(user);
    setShowCardInput(true);
  };

  const handleCardInputSubmit = (cardId) => {
    if (!cardId.trim()) {
      showNotification('warning', 'Input Required', 'Please enter the new RFID card ID.');
      return;
    }
    setNewCardId(cardId.trim());
    setShowCardInput(false);
    setShowConfirm(true);
  };

  const handleTransfer = async () => {
    setShowConfirm(false);
    setTransferring(true);

    try {
      // Step 1: Create new user with transferred info but deactivated
      const newUserResponse = await api.post('/admin/sysad/transfer-user', {
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        role: selectedUser.role,
        schoolUId: selectedUser.schoolUId,
        cardUid: newCardId.trim(),
        isDeactivated: false,
        isActive: false,
        originalUserId: selectedUser._id // Keep reference to original user
      });

      // Step 2: Send OTP to user
      await api.post('/admin/auth/send-otp', {
        email: selectedUser.email,
        userId: newUserResponse.user._id
      });

      // Step 3: Show success and reset
      setTransferComplete(true);
      showNotification('success', 'Transfer Initiated', `User information transferred to new RFID card. OTP sent to ${selectedUser.email}`);
      
      // Reload users to get updated data
      await loadUsers();
    } catch (error) {
      showNotification('error', 'Transfer Failed', error.message || 'Failed to transfer user information. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const handleReset = () => {
    setSelectedUser(null);
    setNewCardId('');
    setTransferComplete(false);
    setShowCardInput(false);
  };

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: accentColor }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <CreditCard className="w-7 h-7" /> Transfer Card
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Transfer user information to a new RFID card with OTP activation
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
          <h3 style={{ color: '#10B981' }} className="text-2xl font-bold mb-2">Transfer Initiated</h3>
          <p style={{ color: theme.text.secondary }} className="mb-6 text-sm max-w-md mx-auto">
            User information has been transferred to the new RFID card. An activation OTP has been sent to the user's email address.
          </p>
          <div style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }} className="rounded-xl border p-4 mb-6">
            <p className="text-blue-500 text-sm">
              <strong>Next Steps:</strong><br />
              1. User will receive OTP via email<br />
              2. User activates account with OTP<br />
              3. New RFID card becomes active
            </p>
          </div>
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
          {/* Actions Bar */}
          <div
            style={{
              background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
              borderColor: theme.accent.primary
            }}
            className="rounded-xl border-2 p-4 mb-5"
          >
            <div className="flex flex-wrap gap-3 items-center justify-between">
              {/* Left: Search */}
              <div className="flex flex-wrap gap-3 items-center flex-1">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                  <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50"
                  />
                </div>

                {/* Role Filter - Selection Buttons */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'student', label: 'Students' },
                    { value: 'employee', label: 'Employees' },
                    { value: 'admin', label: 'Admins' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSearchTerm('')} // Reset search when filter changes
                      style={{
                        background: 'transparent',
                        color: theme.text.secondary
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Status Filter - Selection Buttons */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
                  {[
                    { value: 'all', label: 'All', color: null },
                    { value: 'active', label: 'Active', color: '#10B981' },
                    { value: 'inactive', label: 'Inactive', color: '#EF4444' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSearchTerm('')} // Reset search when filter changes
                      style={{
                        background: 'transparent',
                        color: theme.text.secondary
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Refresh Button */}
              <button
                onClick={loadUsers}
                style={{ background: 'rgba(255,212,28,0.15)', color: accentColor }}
                className="p-2 rounded-lg hover:opacity-80 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
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
              className="px-6 py-4 border-b"
            >
              <h3 style={{ color: accentColor }} className="font-bold text-sm uppercase tracking-wide">Users with RFID Cards</h3>
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
                              disabled={transferring}
                              style={{
                                background: 'rgba(16,185,129,0.15)',
                                color: '#10B981',
                                borderColor: 'rgba(16,185,129,0.3)'
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

      {/* Card Input Modal */}
      <CardInputModal
        isOpen={showCardInput}
        onClose={() => setShowCardInput(false)}
        onSubmit={handleCardInputSubmit}
        selectedUser={selectedUser}
      />

      {/* Transfer Confirmation Modal */}
      <TransferConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleTransfer}
        selectedUser={selectedUser}
        newCardId={newCardId}
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

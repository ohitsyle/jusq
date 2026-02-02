// src/pages/admin/Sysad/TransferCard.jsx
// Transfer RFID card data from one card to another - Professional redesign

import React, { useState } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { CreditCard, ArrowRight, Search, AlertTriangle, CheckCircle, Loader2, User, DollarSign, History, X, RefreshCw } from 'lucide-react';

// Custom Notification Modal for TransferCard
function TransferNotificationModal({ isOpen, onClose, type, title, message }) {
  const { theme, isDarkMode } = useTheme();
  if (!isOpen) return null;

  const configs = {
    success: { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    error: { icon: X, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
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

export default function TransferCard() {
  const { theme, isDarkMode } = useTheme();
  const [oldCardId, setOldCardId] = useState('');
  const [newCardId, setNewCardId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [searching, setSearching] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);

  // Modal states
  const [notification, setNotification] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [showConfirm, setShowConfirm] = useState(false);

  // Use theme accent color (gold in dark mode, blue in light mode) - matching Treasury style
  const accentColor = theme.accent.primary;

  const showNotification = (type, title, message) => {
    setNotification({ isOpen: true, type, title, message });
  };

  const handleSearchOldCard = async () => {
    if (!oldCardId.trim()) {
      showNotification('warning', 'Input Required', 'Please enter the old card ID to search.');
      return;
    }

    setSearching(true);
    setUserInfo(null);
    setTransferComplete(false);

    try {
      // Backend uses path param not query param: /card-lookup/:cardUid
      const data = await api.get(`/admin/sysad/card-lookup/${oldCardId.trim()}`);
      if (data?.user) {
        setUserInfo(data.user);
        showNotification('success', 'User Found', `Found user: ${data.user.firstName} ${data.user.lastName}`);
      } else {
        showNotification('error', 'Not Found', 'No user found with this card ID.');
      }
    } catch (error) {
      showNotification('error', 'Search Failed', error.message || 'Failed to find card. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleTransferClick = () => {
    if (!oldCardId.trim() || !newCardId.trim()) {
      showNotification('warning', 'Input Required', 'Please enter both old and new card IDs.');
      return;
    }

    if (oldCardId.trim() === newCardId.trim()) {
      showNotification('warning', 'Invalid Input', 'Old and new card IDs must be different.');
      return;
    }

    if (!userInfo) {
      showNotification('warning', 'User Required', 'Please search for a valid user first.');
      return;
    }

    setShowConfirm(true);
  };

  const handleTransfer = async () => {
    setShowConfirm(false);
    setTransferring(true);

    try {
      await api.post('/admin/sysad/transfer-card', {
        oldCardUid: oldCardId.trim(),
        newCardUid: newCardId.trim()
      });

      setTransferComplete(true);
    } catch (error) {
      showNotification('error', 'Transfer Failed', error.message || 'Failed to transfer card. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  const handleReset = () => {
    setOldCardId('');
    setNewCardId('');
    setUserInfo(null);
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
          Securely transfer user data from one RFID card to another
        </p>
      </div>

      {/* Warning Notice - More professional styling */}
      <div
        style={{
          background: isDarkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)',
          borderColor: 'rgba(245,158,11,0.25)'
        }}
        className="p-4 rounded-xl border mb-6 flex items-start gap-4"
      >
        <div style={{ background: 'rgba(245,158,11,0.15)' }} className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <p style={{ color: '#D97706' }} className="font-semibold text-sm">Security Notice</p>
          <p style={{ color: theme.text.secondary }} className="text-xs mt-1 leading-relaxed">
            This operation will transfer all account data including balance and transaction history.
            The source card will be permanently deactivated.
          </p>
        </div>
      </div>

      {/* Transfer Complete Success - Professional styling */}
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

      {/* Main Transfer Form - Professional Card-Based Design */}
      {!transferComplete && (
        <div
          style={{ background: theme.bg.card, borderColor: theme.border.primary }}
          className="rounded-2xl border overflow-hidden"
        >
          {/* Form Header */}
          <div
            style={{
              background: isDarkMode
                ? `linear-gradient(135deg, ${theme.accent.primary}20 0%, ${theme.accent.primary}08 100%)`
                : `linear-gradient(135deg, ${theme.accent.primary}15 0%, ${theme.accent.primary}05 100%)`,
              borderColor: `${theme.accent.primary}30`
            }}
            className="px-6 py-4 border-b"
          >
            <h3 style={{ color: accentColor }} className="font-bold text-sm uppercase tracking-wide">RFID Transfer Details</h3>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 items-start">
              {/* Old Card */}
              <div className="lg:col-span-3">
                <div
                  style={{
                    background: isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
                    borderColor: 'rgba(239,68,68,0.2)'
                  }}
                  className="p-5 rounded-xl border"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ background: 'rgba(239,68,68,0.15)' }} className="w-10 h-10 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h4 style={{ color: theme.text.primary }} className="font-bold text-sm">Source Card</h4>
                      <p style={{ color: theme.text.muted }} className="text-xs">Card to be deactivated</p>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">
                      RFID Tag
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={oldCardId}
                        onChange={(e) => setOldCardId(e.target.value.toUpperCase())}
                        placeholder="Enter RFID (e.g. 6F0EA8AD)..."
                        style={{
                          background: isDarkMode ? 'rgba(15,18,39,0.8)' : '#FFFFFF',
                          color: theme.text.primary,
                          borderColor: theme.border.primary
                        }}
                        className="flex-1 px-4 py-3 rounded-xl border text-sm focus:outline-none font-mono transition-all focus:ring-2 focus:ring-red-500/20"
                        disabled={searching || transferring}
                      />
                      <button
                        onClick={handleSearchOldCard}
                        disabled={searching || transferring || !oldCardId.trim()}
                        style={{ background: accentColor }}
                        className="px-4 py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 text-white"
                      >
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span className="hidden sm:inline">Find</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow Indicator */}
              <div className="lg:col-span-1 flex items-center justify-center py-4 lg:py-0 lg:h-full">
                <div
                  style={{
                    background: isDarkMode ? `${accentColor}15` : `${accentColor}10`,
                    borderColor: `${accentColor}30`
                  }}
                  className="w-14 h-14 rounded-xl border flex items-center justify-center rotate-90 lg:rotate-0"
                >
                  <ArrowRight style={{ color: accentColor }} className="w-6 h-6" />
                </div>
              </div>

              {/* New Card */}
              <div className="lg:col-span-3">
                <div
                  style={{
                    background: isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                    borderColor: userInfo ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)'
                  }}
                  className={`p-5 rounded-xl border transition-all ${!userInfo ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ background: 'rgba(16,185,129,0.15)' }} className="w-10 h-10 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 style={{ color: theme.text.primary }} className="font-bold text-sm">Destination Card</h4>
                      <p style={{ color: theme.text.muted }} className="text-xs">New card to receive data</p>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">
                      RFID Tag
                    </label>
                    <input
                      type="text"
                      value={newCardId}
                      onChange={(e) => setNewCardId(e.target.value.toUpperCase())}
                      placeholder={userInfo ? "Enter new RFID..." : "Search source RFID first..."}
                      style={{
                        background: isDarkMode ? 'rgba(15,18,39,0.8)' : '#FFFFFF',
                        color: theme.text.primary,
                        borderColor: theme.border.primary
                      }}
                      className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none font-mono transition-all focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed"
                      disabled={searching || transferring || !userInfo}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Info Preview - Professional styling */}
      {userInfo && !transferComplete && (
        <div
          style={{ background: theme.bg.card, borderColor: theme.border.primary }}
          className="mt-6 rounded-2xl border overflow-hidden"
        >
          {/* Section Header */}
          <div
            style={{
              background: isDarkMode
                ? `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}06 100%)`
                : `linear-gradient(135deg, ${accentColor}12 0%, ${accentColor}03 100%)`,
              borderColor: 'rgba(139,92,246,0.15)'
            }}
            className="px-6 py-4 border-b flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div style={{ background: 'rgba(139,92,246,0.15)' }} className="w-8 h-8 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4" style={{ color: accentColor }} />
              </div>
              <div>
                <h3 style={{ color: accentColor }} className="font-bold text-sm uppercase tracking-wide">Account Details</h3>
                <p style={{ color: theme.text.muted }} className="text-xs">Data to be transferred</p>
              </div>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }} className="px-3 py-1 rounded-full text-xs font-semibold">
              Verified
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* User Details */}
              <div
                style={{
                  background: isDarkMode ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.03)',
                  borderColor: 'rgba(139,92,246,0.15)'
                }}
                className="p-4 rounded-xl border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4" style={{ color: accentColor }} />
                  <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Account Holder</p>
                </div>
                <p style={{ color: theme.text.primary }} className="font-bold text-lg">
                  {`${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'N/A'}
                </p>
                <p style={{ color: theme.text.muted }} className="text-xs mt-1 truncate">
                  {userInfo.email || 'N/A'}
                </p>
              </div>

              {/* Balance */}
              <div
                style={{
                  background: isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                  borderColor: 'rgba(16,185,129,0.2)'
                }}
                className="p-4 rounded-xl border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Current Balance</p>
                </div>
                <p className="font-bold text-2xl text-emerald-500">
                  ₱{(userInfo.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Transaction Count */}
              <div
                style={{
                  background: isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
                  borderColor: 'rgba(59,130,246,0.2)'
                }}
                className="p-4 rounded-xl border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-blue-500" />
                  <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Total Transactions</p>
                </div>
                <p className="font-bold text-2xl text-blue-500">
                  {userInfo.transactionCount || 0}
                </p>
              </div>
            </div>

            {/* Transfer Button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={handleTransferClick}
                disabled={transferring || !newCardId.trim()}
                style={{ background: accentColor }}
                className="px-10 py-4 rounded-xl font-bold text-base text-white hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-3 shadow-lg"
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Transfer...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Transfer Card Data
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions - Professional styling */}
      {!userInfo && !transferComplete && (
        <div
          style={{ background: theme.bg.card, borderColor: theme.border.primary }}
          className="mt-6 rounded-2xl border overflow-hidden"
        >
          <div
            style={{
              background: isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
              borderColor: 'rgba(59,130,246,0.15)'
            }}
            className="px-6 py-4 border-b"
          >
            <h3 style={{ color: '#3B82F6' }} className="font-bold text-sm uppercase tracking-wide">Transfer Process</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                { step: 1, title: 'Enter Source Card', desc: 'Input the UID of the lost or damaged card' },
                { step: 2, title: 'Search & Verify', desc: 'Confirm the account holder information' },
                { step: 3, title: 'Enter New Card', desc: 'Input the replacement card UID' },
                { step: 4, title: 'Confirm Transfer', desc: 'Review and confirm the transfer details' },
                { step: 5, title: 'Complete', desc: 'Old card deactivated, new card active' }
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div
                    style={{
                      background: isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
                      color: accentColor
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-sm"
                  >
                    {item.step}
                  </div>
                  <p style={{ color: theme.text.primary }} className="font-semibold text-sm mb-1">{item.title}</p>
                  <p style={{ color: theme.text.muted }} className="text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <TransferNotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      {/* Confirmation Modal */}
      <TransferConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleTransfer}
        oldCard={oldCardId}
        newCard={newCardId}
        userName={userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : ''}
      />
    </div>
  );
}

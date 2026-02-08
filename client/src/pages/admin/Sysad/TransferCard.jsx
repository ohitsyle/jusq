// src/pages/admin/Sysad/TransferCard.jsx
// Transfer RFID card data from one card to another - Table-based design like ManageUsers

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { CreditCard, ArrowRight, Search, AlertTriangle, CheckCircle, Loader2, User, RefreshCw, Users, Download } from 'lucide-react';
import { convertToHexLittleEndian } from '../../../utils/rfidConverter';

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

// Multi-step Transfer Modal
function TransferModal({ isOpen, onClose, selectedUser }) {
  const { theme, isDarkMode } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [newRfid, setNewRfid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const accentColor = theme.accent.primary;

  const steps = [
    { id: 1, name: 'RFID', icon: CreditCard },
    { id: 2, name: 'Details', icon: User },
    { id: 3, name: 'Summary', icon: CheckCircle },
    { id: 4, name: 'Complete', icon: CheckCircle }
  ];

  const handleRfidSubmit = () => {
    if (newRfid.trim()) {
      // Auto-convert RFID to hex little-endian before proceeding
      setNewRfid(convertToHexLittleEndian(newRfid.trim()));
      setCurrentStep(2);
    }
  };

  const handleTransfer = async () => {
    setIsProcessing(true);
    try {
      const response = await api.post('/admin/sysad/transfer-card', {
        oldCardUid: selectedUser.rfidUId,
        newCardUid: convertToHexLittleEndian(newRfid.trim()),
        adminId: 'sysad'
      });
      
      setCurrentStep(4);
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="p-4 rounded-xl border flex items-start gap-3" style={{ background: 'rgba(255, 212, 28, 0.1)', borderColor: 'rgba(255, 212, 28, 0.3)' }}>
              <CreditCard className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
              <div>
                <p className="font-semibold" style={{ color: theme.text.primary }}>Scan New RFID Card</p>
                <p className="text-sm mt-1" style={{ color: theme.text.secondary }}>
                  Place the new RFID card on the scanner or type the RFID manually. Format will be automatically converted to Hex format (decimal → hex, hex → unchanged).
                </p>
              </div>
            </div>
            
            <div>
              <label className="font-semibold mb-2 block" style={{ color: theme.text.primary }}>New RFID Tag</label>
              <input
                placeholder="Scan or enter new RFID..."
                value={newRfid}
                onChange={(e) => setNewRfid(e.target.value)}
                onBlur={() => {
                  if (newRfid.trim()) setNewRfid(convertToHexLittleEndian(newRfid.trim()));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newRfid.trim()) {
                    setNewRfid(convertToHexLittleEndian(newRfid.trim()));
                    handleRfidSubmit();
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-yellow-400/50 font-mono text-lg tracking-wider"
                style={{
                  background: 'rgba(15, 18, 39, 0.5)',
                  color: theme.text.primary,
                  borderColor: 'rgba(255, 212, 28, 0.2)'
                }}
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(71, 85, 105, 0.5)', color: theme.text.primary }}
              >
                Cancel
              </button>
              <button
                onClick={handleRfidSubmit}
                disabled={!newRfid.trim()}
                className="flex-1 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: accentColor, color: '#1E1D40' }}
              >
                Continue →
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'rgba(15, 18, 39, 0.5)', borderColor: 'rgba(255, 212, 28, 0.2)' }}>
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5" style={{ color: accentColor }} />
                <div>
                  <p className="text-xs" style={{ color: theme.text.secondary }}>New RFID Tag</p>
                  <p className="font-mono font-semibold" style={{ color: theme.text.primary }}>
                    {convertToHexLittleEndian(newRfid)}
                  </p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold mb-1.5 block text-sm" style={{ color: theme.text.primary }}>First Name</label>
                <input
                  value={selectedUser?.firstName || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border"
                  style={{
                    background: 'rgba(15, 18, 39, 0.5)',
                    color: theme.text.primary,
                    borderColor: 'rgba(255, 212, 28, 0.2)'
                  }}
                />
              </div>
              <div>
                <label className="font-semibold mb-1.5 block text-sm" style={{ color: theme.text.primary }}>Middle Name</label>
                <input
                  value={selectedUser?.middleName || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border"
                  style={{
                    background: 'rgba(15, 18, 39, 0.5)',
                    color: theme.text.primary,
                    borderColor: 'rgba(255, 212, 28, 0.2)'
                  }}
                />
              </div>
              <div>
                <label className="font-semibold mb-1.5 block text-sm" style={{ color: theme.text.primary }}>Last Name</label>
                <input
                  value={selectedUser?.lastName || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border"
                  style={{
                    background: 'rgba(15, 18, 39, 0.5)',
                    color: theme.text.primary,
                    borderColor: 'rgba(255, 212, 28, 0.2)'
                  }}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold mb-1.5 block text-sm" style={{ color: theme.text.primary }}>User Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="py-2.5 rounded-xl border font-semibold capitalize"
                  style={{
                    background: selectedUser?.role === 'student' || selectedUser?.userType === 'student' ? accentColor : 'rgba(15, 18, 39, 0.5)',
                    color: selectedUser?.role === 'student' || selectedUser?.userType === 'student' ? '#1E1D40' : theme.text.primary,
                    borderColor: accentColor
                  }}
                >
                  🎓 Student
                </button>
                <button
                  type="button"
                  className="py-2.5 rounded-xl border font-semibold capitalize"
                  style={{
                    background: selectedUser?.role === 'employee' || selectedUser?.userType === 'employee' ? accentColor : 'rgba(15, 18, 39, 0.5)',
                    color: selectedUser?.role === 'employee' || selectedUser?.userType === 'employee' ? '#1E1D40' : theme.text.primary,
                    borderColor: accentColor
                  }}
                >
                  👔 Employee
                </button>
              </div>
              {/* Display admin roles if applicable */}
              {(selectedUser?.role === 'treasury' || selectedUser?.role === 'accounting' || selectedUser?.role === 'motorpool' || selectedUser?.role === 'sysad') && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="py-2.5 rounded-xl border font-semibold capitalize w-full"
                    style={{
                      background: accentColor,
                      color: '#1E1D40',
                      borderColor: accentColor
                    }}
                  >
                    👑 {selectedUser?.role || 'Admin'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold mb-1.5 block text-sm" style={{ color: theme.text.primary }}>School ID</label>
              <div className="relative">
                <input
                  value={selectedUser?.schoolUId || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border font-mono pl-10"
                  style={{
                    background: 'rgba(15, 18, 39, 0.5)',
                    color: theme.text.primary,
                    borderColor: 'rgba(255, 212, 28, 0.2)'
                  }}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold mb-1.5 block text-sm" style={{ color: theme.text.primary }}>Email Address</label>
              <div className="relative">
                <input
                  value={selectedUser?.email || ''}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl border font-mono pl-10"
                  style={{
                    background: 'rgba(15, 18, 39, 0.5)',
                    color: theme.text.primary,
                    borderColor: 'rgba(255, 212, 28, 0.2)'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(71, 85, 105, 0.5)', color: theme.text.primary }}
              >
                ← Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="flex-1 py-3 rounded-xl font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: accentColor, color: '#1E1D40' }}
              >
                Review →
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255, 212, 28, 0.15)' }}>
                <ArrowRight className="w-8 h-8" style={{ color: accentColor }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: theme.text.primary }}>Confirm RFID Transfer</h3>
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                Are you sure you want to transfer {selectedUser?.firstName} {selectedUser?.lastName}'s account to the new RFID card?
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border" style={{ background: 'rgba(15, 18, 39, 0.5)', borderColor: 'rgba(255, 212, 28, 0.2)' }}>
                <p className="text-xs" style={{ color: theme.text.secondary }}>Current RFID</p>
                <p className="font-mono font-semibold" style={{ color: theme.text.primary }}>{selectedUser?.rfidUId}</p>
              </div>
              <div className="flex justify-center">
                <ArrowRight className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div className="p-3 rounded-xl border" style={{ background: 'rgba(15, 18, 39, 0.5)', borderColor: 'rgba(255, 212, 28, 0.2)' }}>
                <p className="text-xs" style={{ color: theme.text.secondary }}>New RFID</p>
                <p className="font-mono font-semibold" style={{ color: theme.text.primary }}>{convertToHexLittleEndian(newRfid)}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(71, 85, 105, 0.5)', color: theme.text.primary }}
              >
                ← Back
              </button>
              <button
                onClick={handleTransfer}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-xl font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: accentColor, color: '#1E1D40' }}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Transfer'
                )}
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: theme.text.primary }}>Transfer Successful!</h3>
            <p className="text-sm mb-4" style={{ color: theme.text.secondary }}>
              {selectedUser?.firstName} {selectedUser?.lastName}'s account has been transferred to the new RFID card.
            </p>
            <div className="p-3 rounded-xl border mb-6" style={{ background: 'rgba(255, 212, 28, 0.1)', borderColor: 'rgba(255, 212, 28, 0.3)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: theme.text.primary }}>📧 Important Information</p>
              <p className="text-xs" style={{ color: theme.text.secondary }}>
                The account has been set to <strong>inactive</strong> and the old PIN has been cleared. 
                A new activation OTP has been sent to {selectedUser?.email} and set as the temporary PIN.
                The user will need to use this OTP to activate their account and set a new PIN.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold transition-all hover:opacity-90"
              style={{ background: accentColor, color: '#1E1D40' }}
            >
              Done
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-2xl overflow-hidden animate-fadeIn"
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ background: 'linear-gradient(135deg, rgba(255, 212, 28, 0.2) 0%, rgba(255, 212, 28, 0.1) 100%)', borderColor: 'rgba(255, 212, 28, 0.3)' }}>
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6" style={{ color: accentColor }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: accentColor }}>Transfer RFID Card</h2>
              <p className="text-sm" style={{ color: theme.text.secondary }}>Transfer user account to new RFID card</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:opacity-70 transition-colors disabled:opacity-50"
            style={{ color: theme.text.secondary }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        {currentStep < 4 && (
          <div className="flex items-center justify-center gap-3 py-4 px-6" style={{ background: 'rgba(15, 18, 39, 0.5)' }}>
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2" style={{ opacity: currentStep >= step.id ? 1 : 0.4 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 text-sm" style={{
                    background: currentStep >= step.id ? accentColor : 'transparent',
                    borderColor: accentColor,
                    color: currentStep >= step.id ? '#1E1D40' : theme.text.secondary
                  }}>
                    {currentStep > step.id ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="hidden sm:inline font-medium text-sm" style={{ color: currentStep >= step.id ? accentColor : theme.text.secondary }}>
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="w-8 h-0.5 rounded" style={{ background: currentStep > step.id ? accentColor : 'rgba(255, 212, 28, 0.2)' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.2s ease-out;
  }
`;
if (!document.head.querySelector('style[data-transfer-modal]')) {
  style.setAttribute('data-transfer-modal', 'true');
  document.head.appendChild(style);
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
    treasury: { color: '#10B981', bg: isDarkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)', label: 'Treasury' },
    accounting: { color: '#F59E0B', bg: isDarkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)', label: 'Accounting' },
    motorpool: { color: '#EF4444', bg: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', label: 'Motorpool' },
    merchant: { color: '#8B5CF6', bg: isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)', label: 'Merchant' },
    student: { color: '#3B82F6', bg: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', label: 'Student' },
    employee: { color: '#06B6D4', bg: isDarkMode ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.1)', label: 'Employee' },
    user: { color: '#6B7280', bg: isDarkMode ? 'rgba(107,114,128,0.15)' : 'rgba(107,114,128,0.1)', label: 'User' }
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
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedUser, setSelectedUser] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Modal states
  const [notification, setNotification] = useState({ isOpen: false, type: 'success', title: '', message: '' });

  // Use theme accent color
  const accentColor = theme.accent.primary;

  const showNotification = (type, title, message) => {
    setNotification({ isOpen: true, type, title, message });
  };

  // Load users
  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', 1);
      params.append('limit', 100);
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('sortBy', sortBy);
      
      const data = await api.get(`/admin/sysad/users?${params}`);
      // Filter out admins - they don't have RFID cards
      const filteredUsers = (data.users || []).filter(user => user._type !== 'admin');
      setUsers(filteredUsers);
    } catch (error) {
      showNotification('error', 'Load Failed', 'Failed to load users. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [searchTerm, roleFilter, statusFilter, sortBy]);

  const handleTransferClick = (user) => {
    setSelectedUser(user);
    setShowTransferModal(true);
  };

  const handleTransferModalClose = () => {
    setShowTransferModal(false);
    setCurrentStep(1);
    setNewRfid('');
    setSelectedUser(null);
    // Refresh users list after successful transfer
    loadUsers(true);
  };

  const handleReset = () => {
    setSelectedUser(null);
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
          Transfer user information to a new RFID card with OTP activation
        </p>
      </div>

      {/* Transfer Complete Success */}
      {transferComplete && (
        <div style={{ background: isDarkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.25)' }} className="p-8 rounded-2xl border mb-6 text-center">
          <div style={{ background: 'rgba(16,185,129,0.15)' }} className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 style={{ color: '#10B981' }} className="text-2xl font-bold mb-2">Transfer Completed</h3>
          <p style={{ color: theme.text.secondary }} className="mb-6 text-sm max-w-md mx-auto">
            RFID card has been successfully transferred. The user can now use the new RFID card for all system operations.
          </p>
          <div style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }} className="rounded-xl border p-4 mb-6">
            <p className="text-blue-500 text-sm">
              <strong>Transfer Details:</strong><br />
              Old RFID: {selectedUser?.rfidUId}<br />
              New RFID: {newCardId}<br />
              User: {selectedUser?.firstName} {selectedUser?.lastName}
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
                  <Search style={{ color: 'rgba(251, 251, 251, 0.5)' }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                      background: isDarkMode ? 'rgba(30, 35, 71, 0.8)' : '#F9FAFB', 
                      color: isDarkMode ? 'rgba(251, 251, 251, 0.95)' : theme.text.primary, 
                      borderColor: 'rgba(255, 212, 28, 0.2)' 
                    }}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50"
                  />
                </div>

                {/* Role Filter - Selection Buttons */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'student', label: 'Students' },
                    { value: 'employee', label: 'Employees' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setRoleFilter(option.value)}
                      style={{
                        background: roleFilter === option.value ? theme.accent.primary : 'transparent',
                        color: roleFilter === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : (isDarkMode ? 'rgba(251, 251, 251, 0.6)' : theme.text.secondary)
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
                      onClick={() => setStatusFilter(option.value)}
                      style={{
                        background: statusFilter === option.value
                          ? (option.color || theme.accent.primary)
                          : 'transparent',
                        color: statusFilter === option.value
                          ? (option.color ? '#FFFFFF' : (isDarkMode ? '#181D40' : '#FFFFFF'))
                          : (isDarkMode ? 'rgba(251, 251, 251, 0.6)' : theme.text.secondary)
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Sort Options */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
                  {[
                    { value: 'createdAt', label: 'Date' },
                    { value: 'name', label: 'Name' },
                    { value: 'role', label: 'Role' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      style={{
                        background: sortBy === option.value ? theme.accent.primary : 'transparent',
                        color: sortBy === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : (isDarkMode ? 'rgba(251, 251, 251, 0.6)' : theme.text.secondary)
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
            {/* Table Content */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                </div>
              ) : users.length === 0 ? (
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
                    {users.map((user, index) => (
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

      {/* Transfer Modal */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={handleTransferModalClose}
        selectedUser={selectedUser}
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

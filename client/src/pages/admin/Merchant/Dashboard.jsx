// src/pages/admin/Merchant/Dashboard.jsx
// Main dashboard - Matches Treasury/Sysad admin design pattern (buttons open modals directly)

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';

export default function Dashboard() {
  const { theme, isDarkMode } = useTheme();
  const [merchantStats, setMerchantStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  // Modal states
  const [showAddMerchantModal, setShowAddMerchantModal] = useState(false);
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);

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

      {/* Stats Grid - 3 cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
          icon="📱"
          label="PHONES REGISTERED"
          value={merchantStats?.phonesRegistered || 0}
          subtitle="devices"
          color="#A855F7"
          theme={theme}
        />
      </div>

      {/* Action Buttons Row - Opens modals directly like Treasury/Sysad */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Add Merchant Button - spans 2 columns */}
        <button
          onClick={() => setShowAddMerchantModal(true)}
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
            <h3 className="text-base font-bold text-amber-500 m-0">Add Merchant</h3>
            <p style={{ color: theme.text.secondary }} className="text-xs m-0 mt-1">
              Create a new merchant account
            </p>
          </div>
        </button>

        {/* Add Phone Button - spans 2 columns */}
        <button
          onClick={() => setShowAddPhoneModal(true)}
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
            <h3 style={{ color: theme.accent.primary }} className="text-base font-bold m-0">Add Phone</h3>
            <p style={{ color: theme.text.secondary }} className="text-xs m-0 mt-1">
              Register a new phone device
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
                <p className="text-xs mt-2">Click "Add Merchant" above to create your first merchant</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Merchant Modal */}
      {showAddMerchantModal && (
        <DashboardAddMerchantModal
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => setShowAddMerchantModal(false)}
          onSuccess={() => {
            setShowAddMerchantModal(false);
            loadMerchantStats();
          }}
        />
      )}

      {/* Add Phone Modal */}
      {showAddPhoneModal && (
        <DashboardAddPhoneModal
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => setShowAddPhoneModal(false)}
          onSuccess={() => {
            setShowAddPhoneModal(false);
            loadMerchantStats();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD ADD MERCHANT MODAL (inline, opens directly)
// ============================================================
function DashboardAddMerchantModal({ theme, isDarkMode, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    businessName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.businessName || formData.businessName.trim().length === 0) {
      setAlert({ type: 'error', message: 'Business name is required' });
      return;
    }
    if (!formData.firstName || formData.firstName.trim().length === 0) {
      setAlert({ type: 'error', message: 'First name is required' });
      return;
    }
    if (!formData.lastName || formData.lastName.trim().length === 0) {
      setAlert({ type: 'error', message: 'Last name is required' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email.trim())) {
      setAlert({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }
    if (!formData.password) {
      setAlert({ type: 'error', message: 'PIN is required for new merchants' });
      return;
    }
    if (!/^\d{6}$/.test(formData.password)) {
      setAlert({ type: 'error', message: 'PIN must be exactly 6 digits' });
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/merchant/merchants', formData);
      onSuccess();
    } catch (error) {
      console.error('Error saving merchant:', error);
      let errorMsg = 'Failed to save merchant';
      if (error.message?.includes('Email already exists') || error.error?.includes('Email already exists')) {
        errorMsg = 'Email already exists. Please use a different email.';
      } else {
        errorMsg = error.error || error.message || errorMsg;
      }
      setAlert({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center z-[9999]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)'
            : theme.bg.card,
          borderColor: theme.border.primary
        }}
        className="rounded-2xl border w-[90%] max-w-[600px] max-h-[90vh] overflow-auto shadow-2xl"
      >
        {/* Modal Header */}
        <div style={{ borderColor: theme.border.primary }} className="p-6 border-b flex justify-between items-center">
          <h3 style={{ color: theme.accent.primary }} className="text-xl font-bold m-0 flex items-center gap-2">
            <span>🏪</span> Add New Merchant
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-lg border-none"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Alert */}
          {alert && (
            <div className="py-3 px-5 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2" style={{
              background: alert.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `2px solid ${alert.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: alert.type === 'success' ? '#10B981' : '#EF4444'
            }}>
              <span>{alert.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{alert.message}</span>
            </div>
          )}

          <div className="grid gap-4">
            <ModalFormField
              label="Business Name"
              value={formData.businessName}
              onChange={(v) => setFormData({ ...formData, businessName: v })}
              placeholder="e.g., Canteen 1"
              required
              theme={theme}
              isDarkMode={isDarkMode}
            />
            <ModalFormField
              label="First Name"
              value={formData.firstName}
              onChange={(v) => setFormData({ ...formData, firstName: v })}
              placeholder="e.g., Juan"
              required
              theme={theme}
              isDarkMode={isDarkMode}
            />
            <ModalFormField
              label="Last Name"
              value={formData.lastName}
              onChange={(v) => setFormData({ ...formData, lastName: v })}
              placeholder="e.g., Dela Cruz"
              required
              theme={theme}
              isDarkMode={isDarkMode}
            />
            <ModalFormField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(v) => setFormData({ ...formData, email: v })}
              placeholder="merchant@nu-laguna.edu.ph"
              required
              theme={theme}
              isDarkMode={isDarkMode}
            />

            {/* PIN Field */}
            <div>
              <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase tracking-wide">
                6-Digit PIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setFormData({ ...formData, password: value });
                  }
                }}
                required
                maxLength="6"
                placeholder="123456"
                pattern="\d{6}"
                style={{
                  background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: theme.border.primary,
                  color: theme.text.primary
                }}
                className="w-full py-3 px-4 border-2 rounded-lg text-lg text-center font-bold tracking-[8px] outline-none box-border"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ borderColor: theme.border.primary }} className="flex gap-3 mt-6 pt-5 border-t justify-end">
            <button
              type="button"
              onClick={onClose}
              style={{
                background: isDarkMode ? 'rgba(251,251,251,0.1)' : 'rgba(0,0,0,0.05)',
                color: theme.text.secondary,
                borderColor: theme.border.primary
              }}
              className="py-3 px-6 border rounded-lg text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: isSubmitting ? '#999' : theme.accent.primary,
                color: isDarkMode ? '#181D40' : '#FFF',
                opacity: isSubmitting ? 0.6 : 1
              }}
              className="py-3 px-6 border-none rounded-lg text-sm font-bold cursor-pointer shadow-lg"
            >
              {isSubmitting ? 'Creating...' : 'Create Merchant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD ADD PHONE MODAL (inline, opens directly)
// ============================================================
function DashboardAddPhoneModal({ theme, isDarkMode, onClose, onSuccess }) {
  const [merchants, setMerchants] = useState([]);
  const [phones, setPhones] = useState([]);
  const [formData, setFormData] = useState({
    phoneId: '',
    phoneModel: '',
    phoneType: 'Android',
    assignedMerchantId: '',
    assignedBusinessName: '',
    status: 'available',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [merchantsData, phonesData] = await Promise.all([
        api.get('/merchant/merchants'),
        api.get('/merchant/phones')
      ]);
      setMerchants(Array.isArray(merchantsData?.merchants) ? merchantsData.merchants : (Array.isArray(merchantsData) ? merchantsData : []));
      setPhones(Array.isArray(phonesData) ? phonesData : []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getNextPhoneId = () => {
    if (phones.length === 0) return 'PHONE_001';
    let highestNum = 0;
    for (const phone of phones) {
      if (phone.phoneId) {
        const match = phone.phoneId.match(/PHONE_(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestNum) highestNum = num;
        }
      }
    }
    return `PHONE_${String(highestNum + 1).padStart(3, '0')}`;
  };

  const handleMerchantChange = (merchantId) => {
    if (!merchantId) {
      setFormData({
        ...formData,
        assignedMerchantId: '',
        assignedBusinessName: '',
        status: 'available',
        assignedMerchantDate: null
      });
    } else {
      const merchant = merchants.find(m => m.merchantId === merchantId);
      setFormData({
        ...formData,
        assignedMerchantId: merchantId,
        assignedBusinessName: merchant?.businessName || '',
        status: 'assigned',
        assignedMerchantDate: new Date()
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const submitData = { ...formData, phoneId: getNextPhoneId() };
      await api.post('/merchant/phones', submitData);
      onSuccess();
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || error.message || 'Failed to create phone' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center z-[9999]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)'
            : theme.bg.card,
          borderColor: theme.border.primary
        }}
        className="rounded-2xl border-2 max-w-[600px] w-[90%] max-h-[85vh] overflow-auto shadow-2xl"
      >
        {/* Modal Header */}
        <div style={{ borderColor: theme.border.primary }} className="p-6 border-b-2 flex justify-between items-center">
          <h3 style={{ color: theme.accent.primary }} className="text-xl font-bold m-0 flex items-center gap-2">
            <span>📱</span> Add New Phone
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-lg border-none"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Alert */}
          {alert && (
            <div className="py-3 px-5 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2" style={{
              background: alert.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `2px solid ${alert.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: alert.type === 'success' ? '#10B981' : '#EF4444'
            }}>
              <span>{alert.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{alert.message}</span>
            </div>
          )}

          <ModalFormField
            label="Phone ID"
            value={getNextPhoneId()}
            disabled
            hint="(Auto-generated)"
            theme={theme}
            isDarkMode={isDarkMode}
          />
          <ModalFormField
            label="Phone Model"
            value={formData.phoneModel}
            onChange={(v) => setFormData({ ...formData, phoneModel: v })}
            required
            placeholder="e.g., Samsung Galaxy A14"
            theme={theme}
            isDarkMode={isDarkMode}
          />

          <div className="mb-5">
            <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">
              Phone Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.phoneType}
              onChange={(e) => setFormData({ ...formData, phoneType: e.target.value })}
              required
              style={{
                background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: theme.border.primary,
                color: theme.text.primary
              }}
              className="w-full py-3 px-4 border-2 rounded-lg text-sm cursor-pointer box-border"
            >
              <option value="Android">Android</option>
              <option value="iOS">iOS</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="mb-5">
            <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">
              Assign to Merchant
            </label>
            <select
              value={formData.assignedMerchantId}
              onChange={(e) => handleMerchantChange(e.target.value)}
              style={{
                background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: theme.border.primary,
                color: theme.text.primary
              }}
              className="w-full py-3 px-4 border-2 rounded-lg text-sm cursor-pointer box-border"
            >
              <option value="">Unassigned</option>
              {merchants.map(merchant => (
                <option key={merchant.merchantId} value={merchant.merchantId}>
                  {merchant.businessName} ({merchant.merchantId})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Any additional notes about this device"
              style={{
                background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: theme.border.primary,
                color: theme.text.primary
              }}
              className="w-full py-3 px-4 border-2 rounded-lg text-sm box-border font-[inherit] resize-y"
            />
          </div>

          {/* Modal Footer */}
          <div style={{ borderColor: theme.border.primary }} className="flex gap-2.5 justify-end pt-5 border-t-2">
            <button
              type="button"
              onClick={onClose}
              style={{
                background: isDarkMode ? 'rgba(251,251,251,0.1)' : 'rgba(0,0,0,0.05)',
                color: theme.text.secondary,
                borderColor: theme.border.primary
              }}
              className="py-3 px-6 border rounded-lg text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: isSubmitting ? '#999' : theme.accent.primary,
                color: isDarkMode ? '#181D40' : '#FFF',
                opacity: isSubmitting ? 0.6 : 1
              }}
              className="py-3 px-6 border-none rounded-lg text-sm font-bold cursor-pointer shadow-lg"
            >
              {isSubmitting ? 'Creating...' : 'Create Phone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

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

// Modal Form Field Component
function ModalFormField({ label, type = 'text', value, onChange, placeholder, required, disabled, hint, theme, isDarkMode }) {
  return (
    <div className="mb-5">
      <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span style={{ color: theme.text.tertiary }} className="text-[11px] font-normal ml-1">{hint}</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={{
          background: disabled
            ? 'rgba(100,100,100,0.2)'
            : (isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)'),
          borderColor: theme.border.primary,
          color: disabled ? theme.text.tertiary : theme.text.primary,
          cursor: disabled ? 'not-allowed' : 'text'
        }}
        className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border"
      />
    </div>
  );
}

// src/pages/admin/Merchant/Merchants.jsx
// Merchant account management - Theme-aware, uses api utility

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';

export default function MerchantsList() {
  const { theme, isDarkMode } = useTheme();
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState(null);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, merchantId: null });
  const [formData, setFormData] = useState({
    businessName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const data = await api.get('/merchant/merchants');
      setMerchants(data.merchants || []);
    } catch (error) {
      console.error('Error loading merchants:', error);
      setAlert({ type: 'error', message: 'Failed to load merchants' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMerchant(null);
    setFormData({ businessName: '', firstName: '', lastName: '', email: '', password: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      businessName: merchant.businessName || '',
      firstName: merchant.firstName || '',
      lastName: merchant.lastName || '',
      email: merchant.email || '',
      password: ''
    });
    setIsModalOpen(true);
  };

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
    if (formData.password && !/^\d{6}$/.test(formData.password)) {
      setAlert({ type: 'error', message: 'PIN must be exactly 6 digits' });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingMerchant) {
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await api.put(`/merchant/merchants/${editingMerchant._id}`, updateData);
        setAlert({ type: 'success', message: 'Merchant updated successfully!' });
      } else {
        if (!formData.password) {
          setAlert({ type: 'error', message: 'PIN is required for new merchants' });
          setIsSubmitting(false);
          return;
        }
        await api.post('/merchant/merchants', formData);
        setAlert({ type: 'success', message: 'Merchant created successfully!' });
      }

      setIsModalOpen(false);
      loadMerchants();
      setTimeout(() => setAlert(null), 3000);
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

  const handleToggleActive = async (merchant) => {
    const newStatus = !merchant.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    try {
      await api.put(`/merchant/merchants/${merchant._id}`, { isActive: newStatus });
      setAlert({ type: 'success', message: `Merchant ${action}d successfully!` });
      loadMerchants();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error(`Error ${action}ing merchant:`, error);
      setAlert({ type: 'error', message: `Failed to ${action} merchant` });
    }
  };

  const handleDeleteClick = (merchantId) => {
    setConfirmDialog({ isOpen: true, merchantId });
  };

  const handleDeleteConfirm = async () => {
    const merchantId = confirmDialog.merchantId;
    setConfirmDialog({ isOpen: false, merchantId: null });

    try {
      await api.delete(`/merchant/merchants/${merchantId}`);
      setAlert({ type: 'success', message: 'Merchant deleted permanently!' });
      setIsModalOpen(false);
      loadMerchants();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Error deleting merchant:', error);
      setAlert({ type: 'error', message: 'Failed to delete merchant' });
    }
  };

  const filteredMerchants = merchants
    .filter(m =>
      m.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.merchantId?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
      return (a.businessName || '').localeCompare(b.businessName || '');
    });

  const totalPages = Math.ceil(filteredMerchants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredMerchants.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-[60px]">
        Loading merchants...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 style={{ color: theme.text.primary }} className="text-2xl font-bold m-0 mb-2">
            Merchant Accounts
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-sm m-0">
            {filteredMerchants.length} merchant{filteredMerchants.length !== 1 ? 's' : ''} registered (Page {currentPage} of {totalPages || 1})
          </p>
        </div>
        <button
          onClick={handleAdd}
          style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFF' }}
          className="py-3 px-6 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-2 shadow-lg border-none"
        >
          <span>➕</span>
          <span>Add Merchant</span>
        </button>
      </div>

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

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="🔍 Search merchants by name, contact, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: isDarkMode ? 'rgba(30,35,71,0.5)' : 'rgba(0,0,0,0.04)',
            borderColor: theme.border.primary,
            color: theme.text.primary
          }}
          className="w-full py-3 px-4 border-2 rounded-xl text-sm outline-none"
        />
      </div>

      {/* Merchant Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        {filteredMerchants.length > 0 ? (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
            {currentItems.map((merchant) => (
              <MerchantCard
                key={merchant._id}
                merchant={merchant}
                onEdit={handleEdit}
                onToggleActive={handleToggleActive}
                theme={theme}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        ) : (
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary, color: theme.text.tertiary }}
            className="rounded-2xl border-2 p-16 text-center">
            <div className="text-6xl mb-4">🏪</div>
            <p className="m-0 text-base">
              {searchQuery ? 'No merchants found matching your search' : 'No merchants yet. Add your first merchant!'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ borderColor: theme.border.primary }} className="flex justify-center items-center gap-3 mt-6 pt-6 border-t-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                background: currentPage === 1 ? `${theme.accent.primary}15` : `${theme.accent.primary}30`,
                borderColor: theme.border.primary,
                color: currentPage === 1 ? theme.text.tertiary : theme.accent.primary
              }}
              className="py-2 px-5 border-2 rounded-lg text-sm font-semibold transition-all"
              {...(currentPage === 1 ? { style: { ...{ cursor: 'not-allowed' } } } : { style: { cursor: 'pointer' } })}
            >
              ← Previous
            </button>
            <span style={{ color: theme.text.secondary }} className="text-sm font-semibold min-w-[120px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: currentPage === totalPages ? `${theme.accent.primary}15` : `${theme.accent.primary}30`,
                borderColor: theme.border.primary,
                color: currentPage === totalPages ? theme.text.tertiary : theme.accent.primary,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
              className="py-2 px-5 border-2 rounded-lg text-sm font-semibold transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
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
            className="rounded-2xl border p-8 w-[90%] max-w-[600px] max-h-[90vh] overflow-auto shadow-2xl"
          >
            <h3 style={{ color: theme.text.primary }} className="text-xl font-bold m-0 mb-6">
              {editingMerchant ? 'Edit Merchant' : 'Add New Merchant'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                {editingMerchant && editingMerchant.merchantId && (
                  <div>
                    <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase tracking-wide">
                      Merchant ID
                    </label>
                    <div style={{
                      background: `${theme.accent.primary}15`,
                      borderColor: theme.border.primary,
                      color: theme.accent.primary
                    }} className="py-3 px-4 border-2 rounded-lg text-sm font-bold">
                      {editingMerchant.merchantId}
                    </div>
                  </div>
                )}

                <FormField label="Business Name" value={formData.businessName} onChange={(v) => setFormData({ ...formData, businessName: v })} placeholder="e.g., Canteen 1" required theme={theme} />
                <FormField label="First Name" value={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} placeholder="e.g., Juan" required theme={theme} />
                <FormField label="Last Name" value={formData.lastName} onChange={(v) => setFormData({ ...formData, lastName: v })} placeholder="e.g., Dela Cruz" required theme={theme} />
                <FormField label="Email" type="email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder="merchant@nu-laguna.edu.ph" required theme={theme} />

                {/* PIN Field */}
                <div>
                  <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase tracking-wide">
                    {editingMerchant ? '6-Digit PIN (leave blank to keep current)' : '6-Digit PIN'} {!editingMerchant && <span className="text-red-500">*</span>}
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
                    required={!editingMerchant}
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

              <div className={`flex gap-3 mt-6 ${editingMerchant ? 'justify-between' : 'justify-end'}`}>
                {editingMerchant && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(editingMerchant._id)}
                    className="py-3 px-6 rounded-lg text-sm font-semibold cursor-pointer transition-all border-2 hover:opacity-80"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      borderColor: 'rgba(239,68,68,0.4)',
                      color: '#EF4444'
                    }}
                  >
                    🗑️ Delete Permanently
                  </button>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      background: `${theme.accent.primary}15`,
                      borderColor: theme.border.primary,
                      color: theme.accent.primary
                    }}
                    className="py-3 px-6 border-2 rounded-lg text-sm font-semibold cursor-pointer"
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
                    {isSubmitting ? 'Saving...' : (editingMerchant ? 'Update Merchant' : 'Create Merchant')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Merchant"
        message="Are you sure you want to permanently delete this merchant? This action cannot be undone."
        confirmText="Delete Merchant"
        cancelText="Cancel"
        confirmColor="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, merchantId: null })}
      />
    </div>
  );
}

function MerchantCard({ merchant, onEdit, onToggleActive, theme, isDarkMode }) {
  const isActive = merchant.isActive !== false;

  return (
    <div
      style={{
        background: theme.bg.card,
        borderColor: theme.border.primary,
        opacity: isActive ? 1 : 0.7
      }}
      className="rounded-2xl border-2 p-6 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Header with ID Badge */}
      <div className="flex justify-between items-start mb-4">
        <div style={{
          background: `${theme.accent.primary}20`,
          borderColor: theme.border.primary,
          color: theme.accent.primary
        }} className="py-1.5 px-3.5 border rounded-lg text-xs font-bold">
          {merchant.merchantId || 'N/A'}
        </div>
        <div className="w-3 h-3 rounded-full" style={{
          background: isActive ? '#10B981' : '#EF4444',
          boxShadow: `0 0 0 3px ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
        }} />
      </div>

      {/* Business Name */}
      <h3 style={{ color: theme.text.primary }} className="text-xl font-bold m-0 mb-2">
        {merchant.businessName}
      </h3>

      {/* Contact Info */}
      <div className="flex flex-col gap-2 mb-4">
        <div style={{ color: theme.text.secondary }} className="text-[13px] flex items-center gap-2">
          <span>👤</span>
          <span>{merchant.firstName} {merchant.lastName}</span>
        </div>
        <div style={{ color: theme.text.secondary }} className="text-[13px] flex items-center gap-2">
          <span>📧</span>
          <span>{merchant.email}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ borderColor: theme.border.primary }} className="flex gap-2 pt-4 border-t">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(merchant); }}
          className="flex-1 py-2.5 px-4 rounded-lg text-[13px] font-semibold cursor-pointer transition-all border hover:opacity-80"
          style={{
            background: 'rgba(59,130,246,0.2)',
            borderColor: 'rgba(59,130,246,0.4)',
            color: '#3B82F6'
          }}
        >
          ✏️ Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActive(merchant); }}
          className="flex-1 py-2.5 px-4 rounded-lg text-[13px] font-semibold cursor-pointer transition-all border hover:opacity-80"
          style={{
            background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            borderColor: isActive ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)',
            color: isActive ? '#EF4444' : '#10B981'
          }}
        >
          {isActive ? '🔴 Deactivate' : '✅ Activate'}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, type = 'text', value, onChange, placeholder, required, theme }) {
  return (
    <div>
      <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          background: 'rgba(251,251,251,0.05)',
          borderColor: theme.border.primary,
          color: theme.text.primary
        }}
        className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border"
      />
    </div>
  );
}

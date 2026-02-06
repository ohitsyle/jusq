// src/pages/admin/Merchant/Phones.jsx
// Phone inventory management - Theme-aware, uses api utility

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import SearchBar from '../../../components/shared/SearchBar';
import ExportButton from '../../../components/shared/ExportButton';
import { exportToCSV, prepareDataForExport } from '../../../utils/csvExport';

export default function MerchantPhonesList() {
  const { theme, isDarkMode } = useTheme();
  const [phones, setPhones] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState(null);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [formData, setFormData] = useState({
    phoneId: '',
    phoneModel: '',
    phoneType: 'Android',
    assignedMerchantId: '',
    assignedBusinessName: '',
    status: 'available',
    notes: ''
  });

  const loadPhones = async () => {
    try {
      const data = await api.get('/merchant/phones');
      setPhones(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading phones:', error);
      setLoading(false);
    }
  };

  const loadMerchants = async () => {
    try {
      const data = await api.get('/merchant/merchants');
      setMerchants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading merchants:', error);
    }
  };

  useEffect(() => {
    loadPhones();
    loadMerchants();
    const interval = setInterval(loadPhones, 5000);
    return () => clearInterval(interval);
  }, []);

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
    try {
      if (editingPhone) {
        await api.put(`/merchant/phones/${editingPhone._id}`, formData);
        setAlert({ type: 'success', message: 'Phone updated successfully!' });
      } else {
        await api.post('/merchant/phones', formData);
        setAlert({ type: 'success', message: 'Phone created successfully!' });
      }
      setShowModal(false);
      setEditingPhone(null);
      resetForm();
      loadPhones();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to save phone' });
    }
  };

  const handleEdit = (phone) => {
    setEditingPhone(phone);
    setFormData({
      phoneId: phone.phoneId,
      phoneModel: phone.phoneModel,
      phoneType: phone.phoneType,
      assignedMerchantId: phone.assignedMerchantId || '',
      assignedBusinessName: phone.assignedBusinessName || '',
      status: phone.status,
      notes: phone.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this phone?')) return;
    try {
      await api.delete(`/merchant/phones/${id}`);
      setAlert({ type: 'success', message: 'Phone deleted successfully!' });
      loadPhones();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to delete phone' });
    }
  };

  const handleMerchantAssignment = async (phone, newMerchantId) => {
    try {
      const merchant = merchants.find(m => m.merchantId === newMerchantId);
      const updatedPhone = {
        ...phone,
        assignedMerchantId: newMerchantId || null,
        assignedBusinessName: merchant?.businessName || null,
        assignedMerchantDate: newMerchantId ? new Date() : null,
        status: newMerchantId ? 'assigned' : 'available'
      };
      await api.put(`/merchant/phones/${phone._id}`, updatedPhone);
      setAlert({ type: 'success', message: 'Merchant assignment updated!' });
      loadPhones();
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to update assignment' });
    }
  };

  const resetForm = () => {
    setFormData({
      phoneId: '',
      phoneModel: '',
      phoneType: 'Android',
      assignedMerchantId: '',
      assignedBusinessName: '',
      status: 'available',
      notes: ''
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'available': return { bg: 'rgba(34,197,94,0.2)', color: '#22C55E' };
      case 'assigned': return { bg: 'rgba(59,130,246,0.2)', color: '#3B82F6' };
      case 'maintenance': return { bg: 'rgba(251,191,36,0.2)', color: '#FBBF24' };
      case 'retired': return { bg: 'rgba(239,68,68,0.2)', color: '#EF4444' };
      default: return { bg: 'rgba(107,114,128,0.2)', color: '#6B7280' };
    }
  };

  const handleExport = () => {
    const dataToExport = prepareDataForExport(filteredPhones);
    exportToCSV(dataToExport, 'merchant-phones');
  };

  const filteredPhones = phones.filter(phone => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      phone.phoneId?.toLowerCase().includes(searchLower) ||
      phone.phoneModel?.toLowerCase().includes(searchLower) ||
      phone.phoneType?.toLowerCase().includes(searchLower) ||
      phone.assignedBusinessName?.toLowerCase().includes(searchLower) ||
      phone.assignedMerchantId?.toLowerCase().includes(searchLower) ||
      phone.status?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredPhones.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredPhones.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-[60px]">
        Loading phones...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Alert */}
      {alert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '16px 24px',
          borderRadius: '8px',
          background: alert.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
          color: alert.type === 'success' ? '#22C55E' : '#EF4444',
          border: `2px solid ${alert.type === 'success' ? '#22C55E' : '#EF4444'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10000
        }}>
          {alert.message}
        </div>
      )}

      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-7 border-b-2 pb-5">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-2.5">
              <span>📱</span> Merchant Phone Inventory
            </h2>
            <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
              {searchQuery
                ? `Showing: ${filteredPhones.length} of ${phones.length} (Page ${currentPage} of ${totalPages || 1})`
                : `Total devices: ${phones.length} • Available: ${phones.filter(p => p.status === 'available').length} • Assigned: ${phones.filter(p => p.status === 'assigned').length} (Page ${currentPage} of ${totalPages || 1})`}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingPhone(null); setShowModal(true); }}
            style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFF' }}
            className="py-3 px-6 rounded-lg text-sm font-bold cursor-pointer border-none shadow-lg transition-all"
          >
            + Add Phone
          </button>
        </div>
        <div className="flex gap-3 items-center">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by phone ID, model, serial, or merchant..."
          />
          <ExportButton onClick={handleExport} disabled={filteredPhones.length === 0} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto pr-2">
        {phones.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-[60px]">
            <div className="text-5xl mb-4">📱</div>
            <div>No phones found</div>
          </div>
        ) : filteredPhones.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-[60px]">
            <div className="text-5xl mb-4">🔍</div>
            <div className="mb-3">No phones match your search</div>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: `${theme.accent.primary}20`,
                borderColor: theme.border.primary,
                color: theme.accent.primary
              }}
              className="py-2 px-4 border-2 rounded-lg text-[13px] font-semibold cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div style={{ borderColor: theme.border.primary }} className="overflow-x-auto rounded-xl border">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr style={{ background: `${theme.accent.primary}15` }}>
                  {['Phone ID', 'Device', 'Type', 'Assigned Merchant', 'Status', ''].map((header, i) => (
                    <th
                      key={header || 'actions'}
                      style={{ color: theme.accent.primary, borderColor: theme.border.primary, textAlign: i === 5 ? 'right' : 'left' }}
                      className="p-4 text-[11px] font-extrabold uppercase border-b-2"
                    >
                      {header || 'Actions'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentItems.map((phone) => {
                  const statusStyle = getStatusColor(phone.status);
                  return (
                    <tr key={phone._id} style={{ borderBottom: `1px solid ${theme.border.primary}` }}>
                      <td style={{ color: theme.text.primary }} className="p-4">
                        <strong>{phone.phoneId}</strong>
                      </td>
                      <td style={{ color: theme.text.primary }} className="p-4">{phone.phoneModel}</td>
                      <td style={{ color: theme.text.primary }} className="p-4">{phone.phoneType}</td>
                      <td className="p-4">
                        <select
                          value={phone.assignedMerchantId || ''}
                          onChange={(e) => handleMerchantAssignment(phone, e.target.value)}
                          style={{
                            background: `${theme.accent.primary}15`,
                            color: theme.accent.primary,
                            borderColor: theme.border.primary
                          }}
                          className="py-2 px-3 border rounded-md text-xs font-semibold cursor-pointer min-w-[200px]"
                        >
                          <option value="">Unassigned</option>
                          {merchants.map(merchant => (
                            <option key={merchant.merchantId} value={merchant.merchantId}>
                              {merchant.businessName} ({merchant.merchantId})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <span className="py-1.5 px-3 rounded-md text-[11px] font-bold uppercase inline-block" style={{
                          background: statusStyle.bg,
                          color: statusStyle.color
                        }}>
                          {phone.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleEdit(phone)}
                          className="py-1.5 px-3 rounded-md text-xs font-semibold cursor-pointer mr-2 border hover:opacity-80 transition-all"
                          style={{ background: 'rgba(59,130,246,0.2)', color: '#3B82F6', borderColor: 'rgba(59,130,246,0.3)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(phone._id)}
                          className="py-1.5 px-3 rounded-md text-xs font-semibold cursor-pointer border hover:opacity-80 transition-all"
                          style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                color: currentPage === 1 ? theme.text.tertiary : theme.accent.primary,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
              className="py-2.5 px-5 border-2 rounded-lg text-sm font-semibold transition-all"
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
              className="py-2.5 px-5 border-2 rounded-lg text-sm font-semibold transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
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
            className="rounded-2xl max-w-[600px] w-[90%] max-h-[85vh] overflow-auto border-2 shadow-2xl"
          >
            {/* Modal Header */}
            <div style={{ borderColor: theme.border.primary }} className="p-6 border-b-2 flex justify-between items-center">
              <h2 style={{ color: theme.accent.primary }} className="text-[22px] font-bold m-0">
                {editingPhone ? 'Edit Phone' : 'Add New Phone'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-lg border-none"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}
              >×</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6">
              <ModalField label="Phone ID" disabled value={editingPhone ? formData.phoneId : getNextPhoneId()} theme={theme} isDarkMode={isDarkMode} hint={!editingPhone ? '(Auto-generated)' : undefined} />
              <ModalField label="Phone Model *" value={formData.phoneModel} onChange={(v) => setFormData({...formData, phoneModel: v})} required placeholder="e.g., Samsung Galaxy A14" theme={theme} isDarkMode={isDarkMode} />

              <div className="mb-5">
                <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">Phone Type *</label>
                <select
                  value={formData.phoneType}
                  onChange={(e) => setFormData({...formData, phoneType: e.target.value})}
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
                <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">Assign to Merchant</label>
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
                <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
                  onClick={() => setShowModal(false)}
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
                  style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFF' }}
                  className="py-3 px-6 border-none rounded-lg text-sm font-bold cursor-pointer shadow-lg"
                >
                  {editingPhone ? 'Update Phone' : 'Create Phone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalField({ label, value, onChange, disabled, required, placeholder, hint, theme, isDarkMode }) {
  return (
    <div className="mb-5">
      <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase">
        {label} {hint && <span style={{ color: theme.text.tertiary }} className="text-[11px] font-normal">{hint}</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        style={{
          background: disabled
            ? 'rgba(100,100,100,0.2)'
            : (isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)'),
          borderColor: theme.border.primary,
          color: disabled ? theme.text.tertiary : theme.text.primary,
          cursor: disabled ? 'not-allowed' : 'text'
        }}
        className="w-full py-3 px-4 border-2 rounded-lg text-sm box-border outline-none"
      />
    </div>
  );
}

// src/admin/components/Drivers/DriversList.jsx
import { toast } from 'react-toastify';
import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, BadgeAlert, KeyRound } from 'lucide-react';
import api from '../../../utils/api';
import SearchBar from '../../../components/shared/SearchBar';
import ExportButton from '../../../components/shared/ExportButton';
import { exportToCSV, prepareDataForExport, downloadServerExport } from '../../../utils/csvExport';
import { useTheme } from '../../../context/ThemeContext';
import { ThemedDateInput, ThemedSelect } from '../../../components/shared/ThemedControls';
import { confirmDialog } from '../../../components/shared/ConfirmDialogHost';
import ModalShell from '../../../components/shared/ModalShell';

// License expiry status: expired -> red, within 30 days -> amber, else plain date
const licenseState = (driver) => {
  if (!driver.licenseExpiry) return null;
  const exp = new Date(driver.licenseExpiry);
  if (isNaN(exp)) return null;
  const days = Math.ceil((exp - Date.now()) / 86400000);
  const dateLabel = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (days < 0) return { badge: 'EXPIRED', color: '#EF4444', dateLabel, alert: true };
  if (days <= 30) return { badge: `${days}d left`, color: '#F59E0B', dateLabel, alert: true };
  return { badge: null, color: null, dateLabel, alert: false };
};

// PH mobile numbers: the form holds the 10 digits after +63 ("9171234567");
// the server stores "+639171234567". Typing 09… or pasting +63… both work.
const toLocalDigits = (value) => {
  let d = String(value || '').replace(/\D/g, '');
  if (d.startsWith('63') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};
const formatLocal = (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
const formatPhone = (e164) => (e164 ? `+63 ${formatLocal(toLocalDigits(e164))}` : '');
const generatePin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

export default function DriversList() {
  const { theme, isDarkMode } = useTheme();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const alert = null; // legacy banner never renders — alerts route to the global pop-up
  const setAlert = (a) => { if (a && a.message) (a.type === 'error' ? toast.error : a.type === 'warning' ? toast.warn : a.type === 'info' ? toast.info : toast.success)(a.message); };
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [formData, setFormData] = useState({
    driverId: '',
    firstName: '',
    lastName: '',
    middleInitial: '',
    phoneNumber: '',
    password: '',
    shuttleId: '',
    licenseNumber: '',
    licenseExpiry: ''
  });

  const loadDrivers = async () => {
    try {
      const data = await api.get('/admin/drivers');
      setDrivers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading drivers:', error);
      setAlert({ type: 'error', message: 'Failed to load drivers' });
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
    const interval = setInterval(() => { if (!document.hidden) loadDrivers(); }, 20000);
    return () => clearInterval(interval);
  }, []);

  const getNextDriverId = () => {
  if (drivers.length === 0) return 'DRV001';
  
  let highestNum = 0;
  for (const driver of drivers) {
    if (driver.driverId) {
      const match = driver.driverId.match(/DRV(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > highestNum) highestNum = num;
      }
    }
  }
  
  return `DRV${String(highestNum + 1).padStart(3, '0')}`;
};

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({
      driverId: getNextDriverId(),
      firstName: '',
      lastName: '',
      middleInitial: '',
      phoneNumber: '',
      password: '',
      shuttleId: '',
      licenseNumber: '',
      licenseExpiry: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setFormData({
      driverId: driver.driverId,
      firstName: driver.firstName,
      lastName: driver.lastName,
      middleInitial: driver.middleInitial || '',
      phoneNumber: toLocalDigits(driver.phoneNumber),
      password: '', // Don't show PIN
      shuttleId: driver.shuttleId || '',
      licenseNumber: driver.licenseNumber || '',
      licenseExpiry: driver.licenseExpiry ? driver.licenseExpiry.split('T')[0] : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate first name
    if (!formData.firstName || formData.firstName.trim().length === 0) {
      setAlert({ type: 'error', message: 'First name is required' });
      return;
    }

    // Validate last name
    if (!formData.lastName || formData.lastName.trim().length === 0) {
      setAlert({ type: 'error', message: 'Last name is required' });
      return;
    }

    // Validate PH mobile number (+63 9XX XXX XXXX)
    if (!/^9\d{9}$/.test(formData.phoneNumber)) {
      setAlert({ type: 'error', message: 'Enter a valid mobile number: +63 9XX XXX XXXX' });
      return;
    }

    // Validate PIN format
    if (formData.password && !/^\d{6}$/.test(formData.password)) {
      setAlert({ type: 'error', message: 'PIN must be exactly 6 digits' });
      return;
    }

    // Validate license number (required for new drivers)
    if (!editingDriver && (!formData.licenseNumber || formData.licenseNumber.trim().length === 0)) {
      setAlert({ type: 'error', message: 'License number is required' });
      return;
    }

    // Validate license expiry (required for new drivers)
    if (!editingDriver && (!formData.licenseExpiry || formData.licenseExpiry.trim().length === 0)) {
      setAlert({ type: 'error', message: 'License expiry date is required' });
      return;
    }

    // Check if license is expired
    if (formData.licenseExpiry) {
      const expiryDate = new Date(formData.licenseExpiry);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDate < today) {
        setAlert({ type: 'error', message: 'License expiry date cannot be in the past' });
        return;
      }
    }

    setIsSubmitting(true);
    const payload = { ...formData, phoneNumber: `+63${formData.phoneNumber}` };
    try {
      if (editingDriver) {
        // UPDATE
        if (!payload.password) delete payload.password; // Don't update if blank

        await api.put(`/admin/drivers/${editingDriver._id}`, payload);
        setAlert({ type: 'success', message: payload.password
          ? `Driver updated. New PIN: ${payload.password} (give it to the driver)`
          : 'Driver updated successfully!' });
      } else {
        // CREATE
        if (!formData.password) {
          setAlert({ type: 'error', message: 'PIN is required for new drivers' });
          setIsSubmitting(false);
          return;
        }
        await api.post('/admin/drivers', payload);
        setAlert({ type: 'success', message: `Driver ${payload.driverId} created. PIN: ${payload.password} (give it to the driver)` });
      }

      setIsModalOpen(false);
      loadDrivers();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Error saving driver:', error);
      // api rejects with the server's JSON body ({ error }), e.g. a duplicate mobile number
      let errorMsg = error?.error || 'Failed to save driver';
      if (error?.message?.includes('Network')) {
        errorMsg = 'Network error. Please check your connection.';
      }
      setAlert({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (driver) => {
    if (!(await confirmDialog(`Delete driver ${driver.fullName}? This cannot be undone.`, { title: 'Delete Driver', confirmText: 'Delete', type: 'danger' }))) {
      return;
    }
    
    try {
      await api.delete(`/admin/drivers/${driver._id}`);
      setAlert({ type: 'success', message: 'Driver deleted successfully!' });
      loadDrivers();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Error deleting driver:', error);
      setAlert({ type: 'error', message: 'Failed to delete driver' });
    }
  };

  const handleStatusChange = async (driver, newStatus) => {
    try {
      await api.put(`/admin/drivers/${driver._id}`, { isActive: newStatus === 'active' });
      setAlert({ type: 'success', message: 'Status updated!' });
      loadDrivers();
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Error updating status:', error);
      setAlert({ type: 'error', message: 'Failed to update status' });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // For PIN field, only allow numbers and max 6 digits
    if (name === 'password') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else if (name === 'phoneNumber') {
      setFormData(prev => ({ ...prev, phoneNumber: toLocalDigits(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleExport = () => downloadServerExport('drivers', 'Drivers');

  // Filter drivers based on search query
  const filteredDrivers = drivers.filter(driver => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    const fullName = `${driver.firstName} ${driver.lastName}`.toLowerCase();
    const searchDigits = searchQuery.replace(/\D/g, '').replace(/^0/, '');

    return (
      driver.driverId?.toLowerCase().includes(searchLower) ||
      driver.firstName?.toLowerCase().includes(searchLower) ||
      driver.lastName?.toLowerCase().includes(searchLower) ||
      fullName.includes(searchLower) ||
      (searchDigits.length >= 3 && driver.phoneNumber?.includes(searchDigits)) ||
      driver.shuttleId?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredDrivers.slice(startIndex, endIndex);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (loading) {
    return <div className="text-center py-[60px]" style={{ color: theme.accent.primary }}>Loading drivers...</div>;
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
          zIndex: 10000,
          animation: 'fadeIn 0.3s ease'
        }}>
          {alert.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-[30px] pb-5" style={{ borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]" style={{ color: theme.accent.primary }}>
              <Users className="w-5 h-5" /> Driver Management
            </h2>
            <p className="text-[13px] m-0" style={{ color: theme.text.secondary }}>
              {filteredDrivers.length > 0
                ? `Showing ${startIndex + 1}-${Math.min(endIndex, filteredDrivers.length)} of ${filteredDrivers.length} • Page ${currentPage} of ${totalPages}`
                : `Total: ${drivers.length} drivers`
              }
            </p>
          </div>
          <button onClick={openAddModal} style={{
            padding: '12px 24px',
            background: theme.accent.primary,
            color: theme.accent.secondary,
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: isDarkMode ? '0 4px 12px rgba(255,212,28,0.4)' : '0 4px 12px rgba(59,130,246,0.4)',
            transition: 'all 0.3s'
          }}>
            + Add Driver
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <DriverMetric icon={Users} label="Total Drivers" value={drivers.length} color="#3B82F6" theme={theme} />
          <DriverMetric icon={UserCheck} label="Active" value={drivers.filter((d) => d.isActive).length} color="#10B981" theme={theme} />
          <DriverMetric icon={UserX} label="Inactive" value={drivers.filter((d) => !d.isActive).length} color="#EF4444" theme={theme} />
          <DriverMetric icon={BadgeAlert} label="License Alerts" value={drivers.filter((d) => licenseState(d)?.alert).length} color="#F59E0B" theme={theme} />
        </div>

        {/* Search and Export Row */}
        <div className="rounded-xl border-2 p-4" style={{ background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card, borderColor: theme.accent.primary }}>
          <div className="flex gap-3 items-center flex-wrap">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, ID, mobile number, or shuttle..."
            />
            <ExportButton onClick={handleExport} disabled={filteredDrivers.length === 0} />
          </div>
        </div>
      </div>

      {/* Table - Scrollable Area */}
      <div className="flex-1 overflow-y-auto pr-2">
      {filteredDrivers.length === 0 ? (
        <div className="text-center py-[60px]" style={{ color: theme.text.tertiary }}>
          <div className="text-5xl mb-4">📋</div>
          <div>{searchQuery ? 'No drivers match your search' : 'No drivers found'}</div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: isDarkMode ? 'rgba(255, 212, 28, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                border: `2px solid ${isDarkMode ? 'rgba(255, 212, 28, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                borderRadius: '8px',
                color: theme.accent.primary,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr style={{ background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)' }}>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>Driver ID</th>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>Name</th>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>Mobile Number</th>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>Shuttle</th>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>License Expiry</th>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>Status</th>
                <th className="text-left p-4 text-[11px] font-extrabold uppercase" style={{ color: theme.accent.primary, borderBottom: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((driver) => (
                <tr key={driver._id} style={{ borderBottom: `1px solid ${theme.border.primary}` }}>
                  <td style={{ padding: '16px', color: theme.text.primary }}>
                    <strong>{driver.driverId}</strong>
                  </td>
                  <td style={{ padding: '16px', color: theme.text.primary }}>
                    {driver.fullName || `${driver.firstName} ${driver.lastName}`}
                  </td>
                  <td style={{ padding: '16px', color: theme.text.primary, whiteSpace: 'nowrap' }}>
                    {formatPhone(driver.phoneNumber) || <span style={{ color: theme.text.tertiary }}>Not set</span>}
                  </td>
                  <td style={{ padding: '16px', color: theme.text.primary }}>
                    {driver.shuttleId || 'None'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {(() => {
                      const lic = licenseState(driver);
                      if (!lic) return <span style={{ color: theme.text.tertiary }}>—</span>;
                      return (
                        <span className="inline-flex items-center gap-2">
                          <span style={{ color: lic.alert ? lic.color : theme.text.primary }}>{lic.dateLabel}</span>
                          {lic.badge && (
                            <span style={{ background: `${lic.color}22`, color: lic.color, border: `1px solid ${lic.color}44` }}
                              className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase whitespace-nowrap">
                              {lic.badge}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <ThemedSelect
                      value={driver.isActive ? 'active' : 'inactive'}
                      onChange={(e) => handleStatusChange(driver, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        border: 'none',
                        cursor: 'pointer',
                        background: driver.isActive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        color: driver.isActive ? '#22C55E' : '#EF4444',
                      }}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </ThemedSelect>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button onClick={() => openEditModal(driver)} style={{
                      padding: '6px 12px',
                      background: 'rgba(59,130,246,0.2)',
                      color: '#3B82F6',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(driver)} style={{
                      padding: '6px 12px',
                      background: 'rgba(239,68,68,0.2)',
                      color: '#EF4444',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 16px',
                  background: currentPage === 1 ? (isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)') : (isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)'),
                  border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  borderRadius: '8px',
                  color: currentPage === 1 ? theme.text.tertiary : theme.accent.primary,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Previous
              </button>
              <span style={{ color: theme.text.secondary, fontSize: '13px', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 16px',
                  background: currentPage === totalPages ? (isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)') : (isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)'),
                  border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  borderRadius: '8px',
                  color: currentPage === totalPages ? theme.text.tertiary : theme.accent.primary,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* ANIMATED MODAL */}
      {isModalOpen && (
        <ModalShell
          title={editingDriver ? 'Edit Driver' : 'Add New Driver'}
          icon={Users}
          onClose={() => setIsModalOpen(false)}
          maxWidth="max-w-[600px]"
          bodyClassName="max-h-[75vh] overflow-y-auto"
        >
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>
                  Driver ID {!editingDriver && <span style={{ fontSize: '11px', color: theme.text.tertiary, fontWeight: 400 }}>(Auto-generated)</span>}
                </label>
                <input type="text" name="driverId" value={formData.driverId} disabled style={{
                  width: '100%',
                  padding: '12px',
                  border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)'}`,
                  borderRadius: '8px',
                  background: 'rgba(100,100,100,0.2)',
                  color: theme.text.tertiary,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed'
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                    color: theme.text.primary,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>Last Name *</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                    color: theme.text.primary,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>M.I.</label>
                  <input type="text" name="middleInitial" value={formData.middleInitial} onChange={handleInputChange} maxLength="1" style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                    color: theme.text.primary,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    textTransform: 'uppercase'
                  }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>Mobile Number *</label>
                {/* +63 is fixed; the admin types only the 10 digits after it */}
                <div style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  border: `2px solid ${phoneFocused ? theme.accent.primary : (isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)')}`,
                  borderRadius: '8px',
                  background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                  overflow: 'hidden'
                }}>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: theme.text.primary,
                    background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.08)',
                    borderRight: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    userSelect: 'none'
                  }}>
                    +63
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    name="phoneNumber"
                    value={formatLocal(formData.phoneNumber)}
                    onChange={handleInputChange}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    placeholder="917 123 4567"
                    required
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '12px',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: theme.text.primary,
                      fontSize: '14px',
                      letterSpacing: '0.5px'
                    }}
                  />
                </div>
                <p style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '8px', marginBottom: 0 }}>
                  The driver signs in to the NUCash app with this number
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>
                  6-Digit PIN {editingDriver && <span style={{ fontSize: '11px', color: theme.text.tertiary, fontWeight: 400 }}>(leave blank to keep current)</span>}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingDriver}
                  maxLength="6"
                  placeholder="123456"
                  pattern="\d{6}"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                    color: theme.text.primary,
                    fontSize: '18px',
                    boxSizing: 'border-box',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontWeight: 700
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, password: generatePin() }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 18px',
                    background: isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.12)',
                    color: theme.accent.primary,
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.4)' : 'rgba(59,130,246,0.4)'}`,
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <KeyRound className="w-4 h-4" /> Generate
                </button>
                </div>
                <p style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '8px', marginBottom: 0 }}>
                  {editingDriver
                    ? 'Generate a new PIN only if the driver needs a reset, then give it to them'
                    : 'Generate a PIN (or type 6 digits) and give it to the driver — they sign in with their mobile number and this PIN'}
                </p>
              </div>

              {/* License Information */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>
                  Driver's License Number <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., N12-34-567890"
                  required={!editingDriver}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                    color: theme.text.primary,
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: theme.accent.primary, textTransform: 'uppercase' }}>
                  License Expiry Date <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <ThemedDateInput
                  className="w-full"
                  name="licenseExpiry"
                  value={formData.licenseExpiry}
                  onChange={handleInputChange}
                  required={!editingDriver}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                    borderRadius: '8px',
                    background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.04)',
                    color: theme.text.primary,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    colorScheme: 'dark'
                  }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: `2px solid ${isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{
                  padding: '12px 24px',
                  background: (isDarkMode ? 'rgba(251,251,251,0.1)' : 'rgba(0,0,0,0.06)'),
                  color: theme.text.secondary,
                  border: (isDarkMode ? '1px solid rgba(251,251,251,0.2)' : '1px solid rgba(0,0,0,0.12)'),
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{
                  padding: '12px 24px',
                  background: isSubmitting ? '#CCCCCC' : theme.accent.primary,
                  color: theme.accent.secondary,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: isSubmitting ? 'none' : (isDarkMode ? '0 4px 12px rgba(255,212,28,0.4)' : '0 4px 12px rgba(59,130,246,0.4)'),
                  opacity: isSubmitting ? 0.6 : 1
                }}>
                  {isSubmitting ? 'Saving...' : (editingDriver ? 'Update Driver' : 'Create Driver')}
                </button>
              </div>
            </form>
        </ModalShell>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
// Metric card matching the Manage Users summary row
function DriverMetric({ icon: Icon, label, value, color, theme }) {
  return (
    <div style={{ background: theme.bg.card, borderColor: `${color}25` }} className="p-4 rounded-xl border flex items-center gap-3">
      <div style={{ background: `${color}20`, color }} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p style={{ color: theme.text.secondary }} className="text-[11px] font-bold uppercase m-0">{label}</p>
        <p style={{ color }} className="text-lg font-bold m-0">{value}</p>
      </div>
    </div>
  );
}

// src/pages/admin/Sysad/AddUserModal.jsx
// Shared "Add New User" modal used by both the Sysad Dashboard and Manage
// Users pages (single source of truth — the two copies previously drifted,
// e.g. Marketing missing from one). Creates students/employees (User) or
// admin accounts (Admin) via POST /admin/sysad/users with live RFID/email/
// school-ID availability checks.
import React, { useState, useEffect, useRef } from 'react';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Plus, X, Check, Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { convertToHexLittleEndian } from '../../../utils/rfidConverter';

const normalizeRfidHex = convertToHexLittleEndian;

// Format school ID for display based on role
// student: ####-###### (10 digits)
// employee/admin: ##-###### (8 digits)
const formatSchoolIdDisplay = (value, role) => {
  const cleaned = value.replace(/\D/g, '');
  if (role === 'employee' || role === 'admin') {
    if (cleaned.length <= 2) return cleaned;
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 8)}`;
  }
  // student (default)
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 10)}`;
};

const cleanSchoolId = (value) => value.replace(/\D/g, '');

const getSchoolIdMaxLength = (role) => (role === 'employee' || role === 'admin') ? 9 : 11;

export const ADMIN_TYPES = [
  { value: 'sysad', label: 'System Admin', color: '#8B5CF6' },
  { value: 'treasury', label: 'Treasury', color: '#10B981' },
  { value: 'accounting', label: 'Accounting', color: '#A855F7' },
  { value: 'motorpool', label: 'Motorpool', color: '#F59E0B' },
  { value: 'merchant', label: 'Merchant', color: '#EC4899' },
  { value: 'marketing', label: 'Marketing', color: '#06B6D4' }
];

export default function AddUserModal({ theme, isDarkMode, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    rfidUId: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    schoolUId: '',
    role: 'student',
    adminRole: '' // For admin users
  });
  const [submitting, setSubmitting] = useState(false);
  const [checkingRfid, setCheckingRfid] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingSchoolId, setCheckingSchoolId] = useState(false);
  const [rfidStatus, setRfidStatus] = useState(null); // 'available', 'taken', null
  const [emailStatus, setEmailStatus] = useState(null);
  const [schoolIdStatus, setSchoolIdStatus] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const rfidInputRef = useRef(null);

  useEffect(() => {
    if (rfidInputRef.current) {
      setTimeout(() => rfidInputRef.current?.focus(), 100);
    }
  }, []);

  // Debounce timer refs
  const rfidTimer = useRef(null);
  const emailTimer = useRef(null);
  const schoolIdTimer = useRef(null);

  const handleRfidChange = async (e) => {
    const value = e.target.value.toUpperCase();
    setFormData({ ...formData, rfidUId: value });
    setRfidStatus(null);
    setValidationError(null);

    if (!value.trim()) return;

    // Debounce the check
    if (rfidTimer.current) clearTimeout(rfidTimer.current);
    rfidTimer.current = setTimeout(async () => {
      const normalizedRfid = normalizeRfidHex(value.trim());
      if (normalizedRfid.length >= 8) {
        setCheckingRfid(true);
        try {
          const response = await api.get(`/admin/sysad/users/check-rfid?rfidUId=${normalizedRfid}`);
          setRfidStatus(response.available === true ? 'available' : 'taken');
        } catch (error) {
          console.error('RFID check error:', error);
          setRfidStatus(null);
        } finally {
          setCheckingRfid(false);
        }
      }
    }, 300);
  };

  const handleEmailChange = async (e) => {
    const value = e.target.value;
    setFormData({ ...formData, email: value });
    setEmailStatus(null);
    setValidationError(null);

    if (!value.trim()) return;

    // Debounce the check
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(async () => {
      if (value.includes('@')) {
        setCheckingEmail(true);
        try {
          const response = await api.get(`/admin/sysad/users/check-email?email=${encodeURIComponent(value.trim())}`);
          setEmailStatus(response.available === true ? 'available' : 'taken');
        } catch (error) {
          console.error('Email check error:', error);
          setEmailStatus(null);
        } finally {
          setCheckingEmail(false);
        }
      }
    }, 300);
  };

  const handleSchoolIdChange = async (e) => {
    const formatted = formatSchoolIdDisplay(e.target.value, formData.role);
    setFormData({ ...formData, schoolUId: formatted });
    setSchoolIdStatus(null);
    setValidationError(null);

    const rawDigits = cleanSchoolId(formatted);
    if (!rawDigits.trim()) return;

    // Debounce the check
    if (schoolIdTimer.current) clearTimeout(schoolIdTimer.current);
    schoolIdTimer.current = setTimeout(async () => {
      if (rawDigits.length >= 6) {
        setCheckingSchoolId(true);
        try {
          const response = await api.get(`/admin/sysad/users/check-schoolid?schoolUId=${encodeURIComponent(rawDigits)}`);
          setSchoolIdStatus(response.available === true ? 'available' : 'taken');
        } catch (error) {
          console.error('School ID check error:', error);
          setSchoolIdStatus(null);
        } finally {
          setCheckingSchoolId(false);
        }
      }
    }, 300);
  };

  const handleRoleChange = (newRole) => {
    const reformatted = formatSchoolIdDisplay(cleanSchoolId(formData.schoolUId), newRole);
    setFormData({ ...formData, role: newRole, adminRole: '', schoolUId: reformatted });
    setSchoolIdStatus(null);
  };

  // Generate random 6-digit PIN
  const generatePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    const isAdminRole = formData.role === 'admin';

    // Validate RFID (only required for non-admin users)
    if (!isAdminRole) {
      if (!formData.rfidUId.trim()) {
        setValidationError('RFID is required for student/employee accounts');
        return;
      }
      if (rfidStatus === 'taken') {
        setValidationError('This RFID is already registered to another user');
        return;
      }
    }

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.schoolUId) {
      setValidationError('Please fill in all required fields');
      return;
    }

    // Validate email status
    if (emailStatus === 'taken') {
      setValidationError('This email is already registered');
      return;
    }

    // Validate school ID status
    if (schoolIdStatus === 'taken') {
      setValidationError('This School ID is already registered');
      return;
    }

    // Validate admin role if role is admin
    if (isAdminRole && !formData.adminRole) {
      setValidationError('Please select an admin type');
      return;
    }

    setSubmitting(true);
    try {
      // Generate a random 6-digit PIN for the user
      const temporaryPin = generatePin();

      const payload = {
        ...formData,
        rfidUId: isAdminRole ? undefined : normalizeRfidHex(formData.rfidUId.trim()),
        schoolUId: cleanSchoolId(formData.schoolUId), // strip formatting dashes
        pin: temporaryPin,
        // If it's an admin user, use the adminRole as the actual role
        role: isAdminRole ? formData.adminRole : formData.role
      };
      delete payload.adminRole;

      const response = await api.post('/admin/sysad/users', payload);

      // Show success notification with email status
      const accountType = isAdminRole ? 'Admin' : 'User';
      if (response.emailSent) {
        toast.success(`${accountType} created! Temporary PIN sent to ${formData.email}`);
      } else {
        toast.warning(`${accountType} created but email failed. Temporary PIN: ${temporaryPin}`);
      }

      onSuccess();
    } catch (error) {
      setValidationError(error.response?.data?.message || error.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(255,212,28,0.3) 0%, rgba(255,212,28,0.1) 100%)' : 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 100%)' }} className="px-6 py-5 flex items-center justify-between">
          <h3 style={{ color: theme.accent.primary }} className="text-xl font-bold flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add New User
          </h3>
          <button onClick={onClose} style={{ color: theme.text.secondary }} className="hover:opacity-70"><X className="w-6 h-6" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Validation Error Display */}
          {validationError && (
            <div style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }} className="p-3 rounded-xl border flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-500 text-sm">{validationError}</p>
            </div>
          )}

          {/* Role Selection - FIRST before everything else */}
          <div>
            <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">User Role *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'student', label: 'Student', icon: '🎓' },
                { value: 'employee', label: 'Employee', icon: '👔' },
                { value: 'admin', label: 'Admin', icon: '🛡️' }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRoleChange(option.value)}
                  style={{
                    background: formData.role === option.value
                      ? theme.accent.primary
                      : isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                    color: formData.role === option.value
                      ? (isDarkMode ? '#181D40' : '#FFFFFF')
                      : theme.text.primary,
                    borderColor: formData.role === option.value ? theme.accent.primary : theme.border.primary
                  }}
                  className="py-3 rounded-xl border font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <span>{option.icon}</span> {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin Type Selection - Shows when role is 'admin' */}
          {formData.role === 'admin' && (
            <div>
              <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">
                Admin Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ADMIN_TYPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, adminRole: option.value })}
                    style={{
                      background: formData.adminRole === option.value
                        ? option.color
                        : isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                      color: formData.adminRole === option.value
                        ? '#FFFFFF'
                        : theme.text.primary,
                      borderColor: formData.adminRole === option.value ? option.color : theme.border.primary
                    }}
                    className="py-2.5 rounded-xl border font-semibold text-xs transition-all hover:opacity-90"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RFID Field - Only show for non-admin users */}
          {formData.role !== 'admin' && (
          <div>
            <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">
              RFID Tag <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CreditCard style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" />
              <input
                ref={rfidInputRef}
                type="text"
                value={formData.rfidUId}
                onChange={handleRfidChange}
                onBlur={() => {
                  if (formData.rfidUId.trim()) {
                    const converted = normalizeRfidHex(formData.rfidUId.trim());
                    setFormData(prev => ({ ...prev, rfidUId: converted }));
                  }
                }}
                placeholder="Scan or enter RFID..."
                style={{
                  background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                  color: theme.text.primary,
                  borderColor: rfidStatus === 'taken' ? '#EF4444' : rfidStatus === 'available' ? '#10B981' : theme.border.primary
                }}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none font-mono"
              />
              {checkingRfid && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
              )}
              {rfidStatus === 'available' && !checkingRfid && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
              {rfidStatus === 'taken' && !checkingRfid && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
              )}
            </div>
            {rfidStatus === 'taken' && (
              <p className="text-red-500 text-xs mt-1">This RFID is already registered to another user</p>
            )}
            {rfidStatus === 'available' && (
              <p className="text-green-500 text-xs mt-1">RFID is available</p>
            )}
            {formData.rfidUId && !rfidStatus && (
              <p style={{ color: theme.text.tertiary }} className="text-xs mt-1">
                Will be stored as: <span className="font-mono">{normalizeRfidHex(formData.rfidUId)}</span>
              </p>
            )}
          </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Middle Name</label>
              <input
                type="text"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Last Name *</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              required
            />
          </div>
          <div>
            <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Email *</label>
            <div className="relative">
              <input
                type="email"
                value={formData.email}
                onChange={handleEmailChange}
                style={{
                  background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                  color: theme.text.primary,
                  borderColor: emailStatus === 'taken' ? '#EF4444' : emailStatus === 'available' ? '#10B981' : theme.border.primary
                }}
                className="w-full px-4 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none"
                required
              />
              {checkingEmail && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
              )}
              {emailStatus === 'available' && !checkingEmail && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
              {emailStatus === 'taken' && !checkingEmail && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
              )}
            </div>
            {emailStatus === 'taken' && (
              <p className="text-red-500 text-xs mt-1">This email is already registered</p>
            )}
            {emailStatus === 'available' && (
              <p className="text-green-500 text-xs mt-1">Email is available</p>
            )}
          </div>
          <div>
            <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">
              {formData.role === 'student' ? 'School ID' : 'Employee/Admin ID'} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.schoolUId}
                onChange={handleSchoolIdChange}
                placeholder={formData.role === 'student' ? '2024-123456' : '24-123456'}
                maxLength={getSchoolIdMaxLength(formData.role)}
                style={{
                  background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                  color: theme.text.primary,
                  borderColor: schoolIdStatus === 'taken' ? '#EF4444' : schoolIdStatus === 'available' ? '#10B981' : theme.border.primary
                }}
                className="w-full px-4 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none transition-all font-mono"
                required
              />
              {checkingSchoolId && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
              )}
              {schoolIdStatus === 'available' && !checkingSchoolId && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
              {schoolIdStatus === 'taken' && !checkingSchoolId && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
              )}
            </div>
            {schoolIdStatus === 'taken' && (
              <p className="text-red-500 text-xs mt-1">This ID is already registered</p>
            )}
            {schoolIdStatus === 'available' && (
              <p className="text-green-500 text-xs mt-1">ID is available</p>
            )}
            <p style={{ color: theme.text.tertiary }} className="text-xs mt-1">
              {formData.role === 'student'
                ? 'Format: ####-###### (stored as 10 digits)'
                : 'Format: ##-###### (stored as 8 digits)'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
              className="flex-1 py-3 rounded-xl font-semibold transition hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || rfidStatus === 'taken'}
              style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFFFFF' }}
              className="flex-1 py-3 rounded-xl font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

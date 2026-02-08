// src/pages/admin/Sysad/Dashboard.jsx
// System Admin Home with comprehensive system overview

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Users, UserCheck, UserX, Shield, GraduationCap, Briefcase, Clock, Plus, CreditCard, Search, Check, Loader2, AlertCircle, X, ArrowRight, CheckCircle } from 'lucide-react';

export default function SysadDashboard() {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    admins: 0,
    students: 0,
    employees: 0,
    recentLogins: []
  });
  const intervalRef = useRef(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const fetchMetrics = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.get('/admin/sysad/dashboard');
      if (data) {
        // Handle both wrapped and unwrapped response
        const metricsData = {
          totalUsers: data.userMetrics?.total || data.totalUsers || 0,
          activeUsers: data.userMetrics?.active || data.activeUsers || 0,
          inactiveUsers: data.userMetrics?.inactive || data.inactiveUsers || 0,
          admins: data.userMetrics?.admins || data.admins || 0,
          students: data.userMetrics?.students || data.students || 0,
          employees: data.userMetrics?.employees || data.employees || 0,
          recentLogins: data.recentActivity || data.recentLogins || []
        };
        setMetrics(metricsData);
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load dashboard metrics');
      console.error('Dashboard error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    intervalRef.current = setInterval(() => fetchMetrics(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>🏠</span> Home
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Comprehensive overview of the NUCash system • Auto-updates every 30 seconds
        </p>
      </div>

      {/* User Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Total Users"
          value={metrics.totalUsers?.toLocaleString() || '0'}
          color="#3B82F6"
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <StatCard
          icon={<UserCheck className="w-6 h-6" />}
          label="Active Users"
          value={metrics.activeUsers?.toLocaleString() || '0'}
          color="#10B981"
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <StatCard
          icon={<UserX className="w-6 h-6" />}
          label="Inactive Users"
          value={metrics.inactiveUsers?.toLocaleString() || '0'}
          color="#EF4444"
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <StatCard
          icon={<Shield className="w-6 h-6" />}
          label="Admins"
          value={metrics.admins?.toLocaleString() || '0'}
          color="#8B5CF6"
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <StatCard
          icon={<GraduationCap className="w-6 h-6" />}
          label="Students"
          value={metrics.students?.toLocaleString() || '0'}
          color="#F59E0B"
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <StatCard
          icon={<Briefcase className="w-6 h-6" />}
          label="Employees"
          value={metrics.employees?.toLocaleString() || '0'}
          color="#06B6D4"
          theme={theme}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setShowAddUserModal(true)}
          style={{
            background: isDarkMode ? 'linear-gradient(135deg, rgba(255,212,28,0.15) 0%, rgba(255,212,28,0.05) 100%)' : 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
            borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'
          }}
          className="p-5 rounded-2xl border flex items-center gap-4 hover:scale-[1.01] hover:shadow-lg transition-all cursor-pointer text-left"
        >
          <div
            style={{ background: isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)' }}
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl"
          >
            👤
          </div>
          <div>
            <p style={{ color: theme.accent.primary }} className="font-bold text-base m-0">Add User</p>
            <p style={{ color: theme.text.secondary }} className="text-xs m-0 mt-1">Create a new student, employee, or admin account</p>
          </div>
        </button>

        <button
          onClick={() => setShowTransferModal(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
            borderColor: 'rgba(16,185,129,0.3)'
          }}
          className="p-5 rounded-2xl border flex items-center gap-4 hover:scale-[1.01] hover:shadow-lg transition-all cursor-pointer text-left"
        >
          <div
            style={{ background: 'rgba(16,185,129,0.2)' }}
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-2xl"
          >
            💳
          </div>
          <div>
            <p className="font-bold text-base text-emerald-500 m-0">Transfer Card</p>
            <p style={{ color: theme.text.secondary }} className="text-xs m-0 mt-1">Transfer user data to a new RFID card</p>
          </div>
        </button>
      </div>

      {/* Recent Admin Activity */}
      

      {/* Add User Modal */}
      {showAddUserModal && (
        <DashboardAddUserModal
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => { setShowAddUserModal(false); fetchMetrics(true); toast.success('User created successfully!'); }}
        />
      )}

      {/* Transfer Card Modal */}
      {showTransferModal && (
        <DashboardTransferModal
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => { setShowTransferModal(false); fetchMetrics(true); }}
        />
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD ADD USER MODAL (inline, opens directly)
// ============================================================
function DashboardAddUserModal({ theme, isDarkMode, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    rfidUId: '', firstName: '', middleName: '', lastName: '',
    email: '', schoolUId: '', role: 'student', adminRole: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [rfidStatus, setRfidStatus] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [schoolIdStatus, setSchoolIdStatus] = useState(null);
  const [checkingRfid, setCheckingRfid] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingSchoolId, setCheckingSchoolId] = useState(false);
  const rfidTimer = useRef(null);
  const emailTimer = useRef(null);
  const schoolIdTimer = useRef(null);

  const normalizeRfidHex = (input) => {
    if (!input) return '';
    let cleaned = input.replace(/[\s:-]/g, '').toUpperCase();
    if (/^[0-9A-F]{8}$/.test(cleaned)) return cleaned;
    if (/^[0-9A-F]+$/.test(cleaned)) {
      if (cleaned.length % 2 !== 0) cleaned = '0' + cleaned;
      const bytes = cleaned.match(/.{2}/g) || [];
      return bytes.reverse().join('');
    }
    if (/^\d+$/.test(cleaned)) {
      const decimal = BigInt(cleaned);
      let hex = decimal.toString(16).toUpperCase();
      if (hex.length % 2 !== 0) hex = '0' + hex;
      while (hex.length < 8) hex = '0' + hex;
      const bytes = hex.match(/.{2}/g) || [];
      return bytes.reverse().join('');
    }
    return cleaned;
  };

  const handleRfidChange = (e) => {
    const value = e.target.value.toUpperCase();
    setFormData({ ...formData, rfidUId: value });
    setRfidStatus(null);
    if (!value.trim()) return;
    if (rfidTimer.current) clearTimeout(rfidTimer.current);
    rfidTimer.current = setTimeout(async () => {
      const normalized = normalizeRfidHex(value.trim());
      if (normalized.length >= 8) {
        setCheckingRfid(true);
        try {
          const res = await api.get(`/admin/sysad/users/check-rfid?rfidUId=${normalized}`);
          setRfidStatus(res.available ? 'available' : 'taken');
        } catch { setRfidStatus(null); }
        finally { setCheckingRfid(false); }
      }
    }, 300);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, email: value });
    setEmailStatus(null);
    if (!value.trim()) return;
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(async () => {
      if (value.includes('@')) {
        setCheckingEmail(true);
        try {
          const res = await api.get(`/admin/sysad/users/check-email?email=${encodeURIComponent(value.trim())}`);
          setEmailStatus(res.available ? 'available' : 'taken');
        } catch { setEmailStatus(null); }
        finally { setCheckingEmail(false); }
      }
    }, 300);
  };

  const handleSchoolIdChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, schoolUId: value });
    setSchoolIdStatus(null);
    if (!value.trim()) return;
    if (schoolIdTimer.current) clearTimeout(schoolIdTimer.current);
    schoolIdTimer.current = setTimeout(async () => {
      if (value.length >= 6) {
        setCheckingSchoolId(true);
        try {
          const res = await api.get(`/admin/sysad/users/check-schoolid?schoolUId=${encodeURIComponent(value.trim())}`);
          setSchoolIdStatus(res.available ? 'available' : 'taken');
        } catch { setSchoolIdStatus(null); }
        finally { setCheckingSchoolId(false); }
      }
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);
    const isAdmin = formData.role === 'admin';
    if (!isAdmin && !formData.rfidUId.trim()) { setValidationError('RFID is required for student/employee'); return; }
    if (!isAdmin && rfidStatus === 'taken') { setValidationError('RFID already registered'); return; }
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.schoolUId) { setValidationError('Fill in all required fields'); return; }
    if (emailStatus === 'taken') { setValidationError('Email already registered'); return; }
    if (schoolIdStatus === 'taken') { setValidationError('School ID already registered'); return; }
    if (isAdmin && !formData.adminRole) { setValidationError('Select an admin type'); return; }

    setSubmitting(true);
    try {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const payload = {
        ...formData,
        rfidUId: isAdmin ? undefined : normalizeRfidHex(formData.rfidUId.trim()),
        pin,
        role: isAdmin ? formData.adminRole : formData.role
      };
      delete payload.adminRole;
      await api.post('/admin/sysad/users', payload);
      onSuccess();
    } catch (error) {
      setValidationError(error.response?.data?.message || error.message || 'Failed to create user');
    } finally { setSubmitting(false); }
  };

  const fieldStyle = { background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
           className="relative rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(255,212,28,0.3) 0%, rgba(255,212,28,0.1) 100%)' : 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 100%)' }} className="px-6 py-5 flex items-center justify-between">
          <h3 style={{ color: theme.accent.primary }} className="text-xl font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> Add New User</h3>
          <button onClick={onClose} style={{ color: theme.text.secondary }} className="hover:opacity-70"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {validationError && (
            <div style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }} className="p-3 rounded-xl border flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><p className="text-red-500 text-sm">{validationError}</p>
            </div>
          )}
          {formData.role !== 'admin' && (
            <div>
              <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">RFID Tag <span className="text-red-500">*</span></label>
              <div className="relative">
                <CreditCard style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" />
                <input type="text" value={formData.rfidUId} onChange={handleRfidChange} placeholder="Scan or enter RFID..."
                  style={{ ...fieldStyle, borderColor: rfidStatus === 'taken' ? '#EF4444' : rfidStatus === 'available' ? '#10B981' : theme.border.primary }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none font-mono" />
                {checkingRfid && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
                {rfidStatus === 'available' && !checkingRfid && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />}
                {rfidStatus === 'taken' && !checkingRfid && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">First Name *</label>
              <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} style={fieldStyle} className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" required /></div>
            <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Middle Name</label>
              <input type="text" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} style={fieldStyle} className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" /></div>
          </div>
          <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Last Name *</label>
            <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} style={fieldStyle} className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" required /></div>
          <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Email *</label>
            <div className="relative">
              <input type="email" value={formData.email} onChange={handleEmailChange}
                style={{ ...fieldStyle, borderColor: emailStatus === 'taken' ? '#EF4444' : emailStatus === 'available' ? '#10B981' : theme.border.primary }}
                className="w-full px-4 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none" required />
              {checkingEmail && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
              {emailStatus === 'available' && !checkingEmail && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />}
              {emailStatus === 'taken' && !checkingEmail && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />}
            </div></div>
          <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">School ID *</label>
            <div className="relative">
              <input type="text" value={formData.schoolUId} onChange={handleSchoolIdChange}
                style={{ ...fieldStyle, borderColor: schoolIdStatus === 'taken' ? '#EF4444' : schoolIdStatus === 'available' ? '#10B981' : theme.border.primary }}
                className="w-full px-4 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none" required />
              {checkingSchoolId && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
              {schoolIdStatus === 'available' && !checkingSchoolId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />}
              {schoolIdStatus === 'taken' && !checkingSchoolId && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />}
            </div></div>
          <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">User Role *</label>
            <div className="grid grid-cols-3 gap-2">
              {[{value:'student',label:'Student',icon:'🎓'},{value:'employee',label:'Employee',icon:'👔'},{value:'admin',label:'Admin',icon:'🛡️'}].map(o => (
                <button key={o.value} type="button" onClick={() => setFormData({...formData, role: o.value, adminRole: ''})}
                  style={{ background: formData.role === o.value ? theme.accent.primary : isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                    color: formData.role === o.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.primary,
                    borderColor: formData.role === o.value ? theme.accent.primary : theme.border.primary }}
                  className="py-3 rounded-xl border font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2">
                  <span>{o.icon}</span> {o.label}
                </button>
              ))}
            </div></div>
          {formData.role === 'admin' && (
            <div><label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">Admin Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[{value:'sysad',label:'System Admin',color:'#8B5CF6'},{value:'treasury',label:'Treasury',color:'#10B981'},{value:'accounting',label:'Accounting',color:'#A855F7'},{value:'motorpool',label:'Motorpool',color:'#F59E0B'},{value:'merchant',label:'Merchant',color:'#EC4899'}].map(o => (
                  <button key={o.value} type="button" onClick={() => setFormData({...formData, adminRole: o.value})}
                    style={{ background: formData.adminRole === o.value ? o.color : isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                      color: formData.adminRole === o.value ? '#FFFFFF' : theme.text.primary,
                      borderColor: formData.adminRole === o.value ? o.color : theme.border.primary }}
                    className="py-2.5 rounded-xl border font-semibold text-xs transition-all hover:opacity-90">{o.label}</button>
                ))}
              </div></div>
          )}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
              className="flex-1 py-3 rounded-xl font-semibold transition hover:opacity-80">Cancel</button>
            <button type="submit" disabled={submitting || rfidStatus === 'taken'}
              style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFFFFF' }}
              className="flex-1 py-3 rounded-xl font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD TRANSFER CARD MODAL (inline, opens directly)
// ============================================================
function DashboardTransferModal({ theme, isDarkMode, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [step, setStep] = useState('search'); // 'search', 'rfid', 'confirm', 'done'
  const [newRfid, setNewRfid] = useState('');
  const [processing, setProcessing] = useState(false);

  const convertToHex = (rfid) => {
    if (!rfid) return '';
    const upper = rfid.toUpperCase();
    if (/^[0-9A-F]+$/.test(upper)) return upper;
    const dec = parseInt(upper, 10);
    if (!isNaN(dec)) return dec.toString(16).toUpperCase();
    return upper;
  };

  useEffect(() => {
    loadUsers();
  }, [searchTerm]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: 1, limit: 50 });
      if (searchTerm) params.append('search', searchTerm);
      const data = await api.get(`/admin/sysad/users?${params}`);
      setUsers((data.users || []).filter(u => u._type !== 'admin'));
    } catch { setUsers([]); }
    finally { setLoading(false); }
  };

  const handleTransfer = async () => {
    setProcessing(true);
    try {
      await api.post('/admin/sysad/transfer-card', {
        oldCardUid: selectedUser.rfidUId,
        newCardUid: convertToHex(newRfid.trim()),
        adminId: 'sysad'
      });
      setStep('done');
    } catch {
      toast.error('Transfer failed. Please try again.');
    } finally { setProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
           className="relative rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.1) 100%)' }} className="px-6 py-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-emerald-500 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Transfer RFID Card</h3>
          <button onClick={onClose} style={{ color: theme.text.secondary }} className="hover:opacity-70"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {step === 'search' && (
            <div className="space-y-4">
              <div className="relative">
                <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                <input type="text" placeholder="Search user by name, ID, email..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none" />
              </div>
              {loading ? (
                <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></div>
              ) : users.length === 0 ? (
                <div style={{ color: theme.text.tertiary }} className="text-center py-10"><Users className="w-10 h-10 mx-auto mb-2 opacity-50" /><p>No users found</p></div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {users.map(user => (
                    <button key={user._id} onClick={() => { setSelectedUser(user); setStep('rfid'); }}
                      style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }}
                      className="w-full p-3 rounded-xl border flex items-center justify-between hover:border-emerald-500 transition-all text-left">
                      <div>
                        <p style={{ color: theme.text.primary }} className="font-semibold">{user.firstName} {user.lastName}</p>
                        <p style={{ color: theme.text.secondary }} className="text-xs">{user.schoolUId || user.email} • RFID: {user.rfidUId || 'None'}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'rfid' && (
            <div className="space-y-5">
              <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="p-4 rounded-xl border">
                <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-1">Selected User</p>
                <p style={{ color: theme.text.primary }} className="font-bold">{selectedUser?.firstName} {selectedUser?.lastName}</p>
                <p style={{ color: theme.text.muted }} className="text-xs">Current RFID: {selectedUser?.rfidUId || 'N/A'}</p>
              </div>
              <div>
                <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">New RFID Tag</label>
                <input type="text" value={newRfid} onChange={e => setNewRfid(e.target.value.toUpperCase())} placeholder="Scan or enter new RFID..."
                  style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: 'rgba(16,185,129,0.3)' }}
                  className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none font-mono text-lg" autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStep('search'); setNewRfid(''); }} style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
                  className="flex-1 py-3 rounded-xl font-semibold">← Back</button>
                <button onClick={() => setStep('confirm')} disabled={!newRfid.trim()}
                  className="flex-1 py-3 rounded-xl font-bold bg-emerald-500 text-white disabled:opacity-50">Continue →</button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-5 text-center">
              <div style={{ background: 'rgba(16,185,129,0.15)' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <ArrowRight className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 style={{ color: theme.text.primary }} className="text-xl font-bold">Confirm Transfer</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm">Transfer {selectedUser?.firstName} {selectedUser?.lastName}'s account?</p>
              <div className="space-y-3 text-left">
                <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="p-3 rounded-xl border">
                  <p style={{ color: theme.text.secondary }} className="text-xs">Current RFID</p>
                  <p style={{ color: theme.text.primary }} className="font-mono font-semibold">{selectedUser?.rfidUId}</p>
                </div>
                <div className="flex justify-center"><ArrowRight className="w-5 h-5 text-emerald-500" /></div>
                <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: 'rgba(16,185,129,0.3)' }} className="p-3 rounded-xl border">
                  <p style={{ color: theme.text.secondary }} className="text-xs">New RFID</p>
                  <p className="font-mono font-semibold text-emerald-500">{convertToHex(newRfid)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('rfid')} style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
                  className="flex-1 py-3 rounded-xl font-semibold">← Back</button>
                <button onClick={handleTransfer} disabled={processing}
                  className="flex-1 py-3 rounded-xl font-bold bg-emerald-500 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                  {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div style={{ background: 'rgba(16,185,129,0.15)' }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 style={{ color: theme.text.primary }} className="text-xl font-bold mb-2">Transfer Successful!</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm mb-6">A new OTP has been sent to {selectedUser?.email} for activation.</p>
              <button onClick={onClose} className="px-8 py-3 rounded-xl font-bold bg-emerald-500 text-white hover:opacity-90">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color, theme, isDarkMode, large }) {
  return (
    <div
      style={{
        background: theme.bg.card,
        borderColor: `${color}30`
      }}
      className={`p-4 rounded-xl border flex items-center gap-4 ${large ? 'col-span-1' : ''}`}
    >
      <div
        style={{ background: `${color}20` }}
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase truncate">
          {label}
        </p>
        <p style={{ color }} className={`font-bold truncate ${large ? 'text-xl' : 'text-lg'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

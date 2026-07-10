// src/pages/admin/Sysad/Dashboard.jsx
// System Admin Home with comprehensive system overview

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Users, UserCheck, UserX, Shield, GraduationCap, Briefcase, Clock, Plus, CreditCard, Search, Check, Loader2, AlertCircle, X, ArrowRight, CheckCircle, ClipboardList, Home, Server, Wrench, FileDown, CalendarClock } from 'lucide-react';
import { convertToHexLittleEndian } from '../../../utils/rfidConverter';
import AddUserModal from './AddUserModal';

const fmtUptime = (s) => {
  if (!s && s !== 0) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function SysadDashboard() {
  const { theme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState(null);
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
        if (data.systemStatus) setSystemStatus(data.systemStatus);
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
          <Home className="w-5 h-5" /> Home
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Comprehensive overview of the NUCash system • Auto-updates every 30 seconds
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pr-2">

      {/* System status strip */}
      {systemStatus && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatusTile
            icon={<Server className="w-5 h-5" />}
            label="Server"
            value={systemStatus.dbConnected ? 'Online' : 'DB Offline'}
            detail={`up ${fmtUptime(systemStatus.uptimeSeconds)}`}
            ok={systemStatus.dbConnected}
            theme={theme}
          />
          <StatusTile
            icon={<Wrench className="w-5 h-5" />}
            label="Maintenance Mode"
            value={systemStatus.maintenance?.enabled ? 'ON' : 'Off'}
            detail={systemStatus.maintenance?.enabled ? 'End-users are blocked' : 'All systems go'}
            ok={!systemStatus.maintenance?.enabled}
            warn={systemStatus.maintenance?.enabled}
            onClick={() => navigate('/admin/sysad/config')}
            theme={theme}
          />
          <StatusTile
            icon={<FileDown className="w-5 h-5" />}
            label="Auto-Export"
            value={systemStatus.autoExportEnabled ? 'Enabled' : 'Disabled'}
            detail={systemStatus.lastAutoExport
              ? `Last: ${new Date(systemStatus.lastAutoExport.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'No runs yet'}
            ok={systemStatus.autoExportEnabled}
            onClick={() => navigate('/admin/sysad/config')}
            theme={theme}
          />
          <StatusTile
            icon={<CalendarClock className="w-5 h-5" />}
            label="Deactivation Scheduler"
            value={systemStatus.deactivationScheduler?.enabled ? 'Scheduled' : 'Off'}
            detail={systemStatus.deactivationScheduler?.enabled
              ? `${systemStatus.deactivationScheduler.date || ''} ${systemStatus.deactivationScheduler.time || ''}`.trim() || 'Pending'
              : 'No schedule set'}
            ok={!systemStatus.deactivationScheduler?.enabled}
            warn={systemStatus.deactivationScheduler?.enabled}
            onClick={() => navigate('/admin/sysad/config')}
            theme={theme}
          />
        </div>
      )}

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
          color="#6366F1"
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <StatCard
          icon={<Briefcase className="w-6 h-6" />}
          label="Employees"
          value={metrics.employees?.toLocaleString() || '0'}
          color="#F59E0B"
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

      {/* Recent Admin Logs */}
      <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden mb-6">
        <div style={{ borderColor: theme.border.primary }} className="p-5 border-b flex justify-between items-center">
          <div>
            <h3 style={{ color: theme.accent.primary }} className="m-0 mb-1 text-lg font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Recent Admin Logs
            </h3>
            <p style={{ color: theme.text.secondary }} className="m-0 text-xs">
              Latest admin activity across the system
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/sysad/logs')}
            style={{ background: `${theme.accent.primary}15`, borderColor: `${theme.accent.primary}40`, color: theme.accent.primary }}
            className="px-4 py-2 rounded-xl border text-xs font-bold hover:opacity-80 transition"
          >
            View all →
          </button>
        </div>
        {metrics.recentLogins && metrics.recentLogins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr style={{ background: isDarkMode ? `${theme.accent.primary}15` : `${theme.accent.primary}10` }}>
                  <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b">Event</th>
                  <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b">Details</th>
                  <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b">Admin</th>
                  <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b">Time</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentLogins.slice(0, 10).map((log, i) => {
                  const action = log.action || '';
                  const badgeColor =
                    action.includes('login') ? { bg: 'rgba(16,185,129,0.2)', text: '#10B981' } :
                    action.includes('logout') ? { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' } :
                    action.includes('created') || action.includes('registration') ? { bg: 'rgba(59,130,246,0.2)', text: '#3B82F6' } :
                    action.includes('deleted') || action.includes('deactivat') ? { bg: 'rgba(239,68,68,0.2)', text: '#EF4444' } :
                    action.includes('updated') || action.includes('status_changed') || action.includes('transferred') ? { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B' } :
                    action.includes('resolved') || action.includes('cash_in') ? { bg: 'rgba(16,185,129,0.15)', text: '#10B981' } :
                    action.includes('config') || action.includes('maintenance') || action.includes('export') ? { bg: 'rgba(139,92,246,0.2)', text: '#8B5CF6' } :
                    action.includes('concern') ? { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' } :
                    { bg: `${theme.accent.primary}20`, text: theme.accent.primary };
                  return (
                  <tr key={log.id || i} onClick={() => navigate('/admin/sysad/logs')} style={{ borderBottom: `1px solid ${theme.border.primary}` }} className="hover:bg-white/5 transition cursor-pointer">
                    <td className="p-4">
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: badgeColor.bg,
                        color: badgeColor.text
                      }}>
                        {action.replace(/_/g, ' ') || 'event'}
                      </span>
                    </td>
                    <td style={{ color: theme.text.primary }} className="p-4 max-w-[280px] truncate text-xs">
                      {log.details || '—'}
                    </td>
                    <td style={{ color: theme.text.secondary }} className="p-4 text-xs font-semibold">
                      {log.admin || 'System'}
                    </td>
                    <td style={{ color: theme.text.muted }} className="p-4 text-xs">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: theme.text.tertiary }} className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No recent admin activity</p>
          </div>
        )}
      </div>

      </div>{/* end scrollable content */}

      {/* Add User Modal (shared with Manage Users; it toasts its own success incl. PIN email status) */}
      {showAddUserModal && (
        <AddUserModal
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => { setShowAddUserModal(false); fetchMetrics(true); }}
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

  const convertToHex = convertToHexLittleEndian;

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

// Status tile — one cell of the system-status strip
function StatusTile({ icon, label, value, detail, ok, warn, onClick, theme }) {
  const color = warn ? '#F59E0B' : ok ? '#10B981' : '#EF4444';
  return (
    <div
      onClick={onClick}
      style={{ background: theme.bg.card, borderColor: `${color}45` }}
      className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.01]' : ''}`}
    >
      <div style={{ background: `${color}20`, color }} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p style={{ color: theme.text.secondary }} className="text-[10px] font-bold uppercase tracking-wide truncate m-0">{label}</p>
        <p style={{ color }} className="font-black text-base m-0 leading-tight">{value}</p>
        <p style={{ color: theme.text.tertiary }} className="text-[11px] m-0 truncate">{detail}</p>
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

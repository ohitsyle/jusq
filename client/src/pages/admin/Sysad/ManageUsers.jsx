// src/pages/admin/Sysad/ManageUsers.jsx
// Manage Users page for System Admin - Updated with RFID field, selection buttons, and custom modals

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { Search, Download, Plus, Edit, Trash2, Users, UserCheck, UserX, Shield, GraduationCap, Briefcase, X, Check, Loader2, CreditCard, AlertCircle, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { exportToCSV } from '../../../utils/csvExport';
import { convertToHexLittleEndian } from '../../../utils/rfidConverter';

// Custom Notification Modal Component
function NotificationModal({ isOpen, onClose, type = 'success', title, message }) {
  const { theme, isDarkMode } = useTheme();

  if (!isOpen) return null;

  const configs = {
    success: { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    error: { icon: XCircle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    warning: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    info: { icon: Info, color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' }
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
          <button
            onClick={onClose}
            style={{ background: config.color, color: '#FFFFFF' }}
            className="w-full py-3 rounded-xl font-semibold transition-all hover:opacity-90"
          >
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

// Confirmation Modal Component
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' }) {
  const { theme, isDarkMode } = useTheme();

  if (!isOpen) return null;

  const configs = {
    danger: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: AlertTriangle },
    warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: AlertTriangle },
    info: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Info }
  };

  const config = configs[type] || configs.warning;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-sm overflow-hidden animate-modalSlide"
      >
        <div className="p-6 flex flex-col items-center text-center">
          <div style={{ background: config.bg, color: config.color }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Icon className="w-8 h-8" />
          </div>
          <h3 style={{ color: theme.text.primary }} className="text-xl font-bold mb-2">{title}</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm">{message}</p>
        </div>
        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
            className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{ background: config.color, color: '#FFFFFF' }}
            className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-90"
          >
            {confirmText}
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

export default function ManageUsers() {
  const { theme, isDarkMode } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    deactivated: 0,
    admins: 0,
    employees: 0,
    students: 0
  });
  const intervalRef = useRef(null);
  const usersPerPage = 20;

  // Notification modal state
  const [notification, setNotification] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'warning' });

  const showNotification = (type, title, message) => {
    setNotification({ isOpen: true, type, title, message });
  };

  const showConfirm = (title, message, onConfirm, type = 'warning') => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, type });
  };

  const fetchUsers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams({
        page: currentPage,
        limit: usersPerPage,
        sortBy
      });
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      // Fetch users and metrics in parallel
      const [usersData, metricsData] = await Promise.all([
        api.get(`/admin/sysad/users?${params}`),
        api.get('/admin/sysad/users/metrics')
      ]);

      if (usersData) {
        setUsers(usersData.users || []);
        setTotalPages(usersData.pagination?.pages || 1);
        setTotalUsers(usersData.pagination?.total || 0);
      }

      if (metricsData?.metrics) {
        setMetrics(metricsData.metrics);
      }
    } catch (error) {
      if (!silent) showNotification('error', 'Load Failed', 'Failed to load users. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, roleFilter, statusFilter, sortBy]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchUsers(true), 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleExportCSV = () => {
    const exportData = users.map(user => ({
      'ID Number': user.schoolUId || user.adminId || 'N/A',
      'RFID': user.rfidUId || 'N/A',
      'Name': `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      'Email': user.email || 'N/A',
      'Role': user.role || 'user',
      'Status': user.isActive ? 'Active' : 'Inactive',
      'Deactivated': user.isDeactivated ? 'Yes' : 'No',
      'Balance': user.balance || 0,
      'Created': new Date(user.createdAt).toLocaleDateString()
    }));
    exportToCSV(exportData, `users-export-${sortBy}`);
    api.post('/admin/log-tab-export', { tabName: 'Manage Users', recordCount: users.length, fileName: `users-export-${sortBy}.csv` }).catch(() => {});
    showNotification('success', 'Export Complete', 'Users have been exported to CSV successfully.');
  };

  const handleDeleteUser = async (userId) => {
    showConfirm(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await api.delete(`/admin/sysad/users/${userId}`);
          showNotification('success', 'User Deleted', 'The user has been deleted successfully.');
          fetchUsers(true);
        } catch (error) {
          showNotification('error', 'Delete Failed', 'Failed to delete user. Please try again.');
        }
      },
      'danger'
    );
  };

  const handleToggleStatus = async (userId, isDeactivated) => {
    try {
      // Backend uses toggle-status endpoint to toggle isDeactivated
      await api.patch(`/admin/sysad/users/${userId}/toggle-status`);
      showNotification('success', 'Status Updated', `User has been ${isDeactivated ? 'undeactivated' : 'deactivated'} successfully.`);
      fetchUsers(true);
    } catch (error) {
      showNotification('error', 'Update Failed', 'Failed to update user status. Please try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Global Styles for animations */}
      <style>{`
        @keyframes tableRowFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-tableRowFade { animation: tableRowFade 0.3s ease-out both; }
      `}</style>

      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>👥</span> Manage Users
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          View, add, edit, and manage all system users
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        <MetricCard icon={<Users className="w-5 h-5" />} label="Total Users" value={metrics.total} color="#3B82F6" theme={theme} />
        <MetricCard icon={<UserCheck className="w-5 h-5" />} label="Active" value={metrics.active} color="#10B981" theme={theme} />
        <MetricCard icon={<UserX className="w-5 h-5" />} label="Inactive" value={metrics.inactive} color="#EF4444" theme={theme} />
        <MetricCard icon={<UserX className="w-5 h-5" />} label="Deactivated" value={metrics.deactivated} color="#F97316" theme={theme} />
        <MetricCard icon={<Shield className="w-5 h-5" />} label="Admins" value={metrics.admins} color={isDarkMode ? '#FFD41C' : '#3B82F6'} theme={theme} />
        <MetricCard icon={<Briefcase className="w-5 h-5" />} label="Employees" value={metrics.employees} color="#F59E0B" theme={theme} />
        <MetricCard icon={<GraduationCap className="w-5 h-5" />} label="Students" value={metrics.students} color="#06B6D4" theme={theme} />
      </div>

      {/* Actions Bar */}
      <div
        style={{
          background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
          borderColor: theme.accent.primary
        }}
        className="rounded-xl border-2 p-4 mb-5"
      >
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Left: Search & Filters + Export Button (at the end) */}
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, ID, email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                  onClick={() => { setRoleFilter(option.value); setCurrentPage(1); }}
                  style={{
                    background: roleFilter === option.value ? theme.accent.primary : 'transparent',
                    color: roleFilter === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
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
                { value: 'inactive', label: 'Inactive', color: '#EF4444' },
                { value: 'deactivated', label: 'Deactivated', color: '#F97316' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => { setStatusFilter(option.value); setCurrentPage(1); }}
                  style={{
                    background: statusFilter === option.value
                      ? (option.color || theme.accent.primary)
                      : 'transparent',
                    color: statusFilter === option.value
                      ? (option.color ? '#FFFFFF' : (isDarkMode ? '#181D40' : '#FFFFFF'))
                      : theme.text.secondary
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Sort - Selection Buttons */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
              {[
                { value: 'createdAt', label: 'Date' },
                { value: 'lastName', label: 'Name' },
                { value: 'role', label: 'Role' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => { setSortBy(option.value); setCurrentPage(1); }}
                  style={{
                    background: sortBy === option.value ? theme.accent.primary : 'transparent',
                    color: sortBy === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Export CSV Button - Now at the END of left section */}
            <button
              onClick={handleExportCSV}
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', borderColor: 'rgba(16,185,129,0.3)' }}
              className="px-4 py-2 rounded-xl font-semibold text-sm border flex items-center gap-2 hover:opacity-80 transition-all"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Right: Add User Button */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFFFFF' }}
              className="px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="mb-4 flex justify-between items-center">
        <p style={{ color: theme.text.secondary }} className="text-sm">
          Showing <span style={{ color: theme.accent.primary }} className="font-bold">{users.length}</span> of {totalUsers} users
        </p>
      </div>

      {/* Users Table */}
      <div className="flex-1">
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden">
          {loading ? (
            <div style={{ color: theme.accent.primary }} className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div style={{ color: theme.text.tertiary }} className="text-center py-20">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">No users found</p>
              <p className="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)' }}>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">ID Number</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Name</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Email</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Role</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-xs font-bold uppercase border-b-2">Deactivated</th>
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
                      className="border-b hover:bg-white/5 transition-all duration-200 animate-tableRowFade"
                    >
                      <td style={{ color: theme.text.primary }} className="p-4 font-mono font-semibold">
                        {user.schoolUId || user.adminId || 'N/A'}
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
                        <DeactivatedBadge isDeactivated={user.isDeactivated} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setSelectedUser(user); setShowEditModal(true); }}
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', borderColor: 'rgba(59,130,246,0.3)' }}
                            className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all text-xs font-semibold border"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user._id, user.isDeactivated)}
                            style={{
                              background: user.isDeactivated ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                              color: user.isDeactivated ? '#10B981' : '#EF4444',
                              borderColor: user.isDeactivated ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
                            }}
                            className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all text-xs font-semibold border"
                          >
                            {user.isDeactivated ? 'Undeactivate' : 'Deactivate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}
                            className="px-3 py-1.5 rounded-lg hover:opacity-80 transition-all text-xs font-semibold border"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{ background: theme.bg.card, borderColor: theme.border.primary }}
            className="mt-4 flex justify-between items-center p-4 rounded-xl border"
          >
            <p style={{ color: theme.text.secondary }} className="text-sm">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : (isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.15)'),
                  color: currentPage === 1 ? theme.text.muted : theme.accent.primary,
                  borderColor: theme.border.primary
                }}
                className="px-4 py-2 rounded-lg font-semibold text-sm border disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{
                  background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : (isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.15)'),
                  color: currentPage === totalPages ? theme.text.muted : theme.accent.primary,
                  borderColor: theme.border.primary
                }}
                className="px-4 py-2 rounded-lg font-semibold text-sm border disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          theme={theme}
          isDarkMode={isDarkMode}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchUsers(true); showNotification('success', 'User Created', 'New user has been created successfully.'); }}
          showNotification={showNotification}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          theme={theme}
          isDarkMode={isDarkMode}
          user={selectedUser}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSuccess={() => { setShowEditModal(false); setSelectedUser(null); fetchUsers(true); showNotification('success', 'User Updated', 'User information has been updated successfully.'); }}
        />
      )}

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

// Metric Card Component - Enhanced with smooth hover effects
function MetricCard({ icon, label, value, color, theme }) {
  return (
    <div
      style={{ background: theme.bg.card, borderColor: `${color}25` }}
      className="p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-default"
    >
      <div
        style={{ background: `${color}15`, color }}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300"
      >
        {icon}
      </div>
      <div>
        <p style={{ color: theme.text.secondary }} className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
        <p style={{ color }} className="text-xl font-bold">{value?.toLocaleString() || 0}</p>
      </div>
    </div>
  );
}

// Role Badge Component - Enhanced styling
function RoleBadge({ role, isDarkMode }) {
  const config = {
    admin: { bg: isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.15)', color: isDarkMode ? '#FFD41C' : '#3B82F6', label: 'Admin' },
    sysad: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6', label: 'System Admin' },
    treasury: { bg: 'rgba(16,185,129,0.15)', color: '#10B981', label: 'Treasury' },
    accounting: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7', label: 'Accounting' },
    motorpool: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Motorpool' },
    merchant: { bg: 'rgba(236,72,153,0.15)', color: '#EC4899', label: 'Merchant' },
    student: { bg: 'rgba(6,182,212,0.15)', color: '#06B6D4', label: 'Student' },
    employee: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Employee' },
    user: { bg: 'rgba(107,114,128,0.15)', color: '#6B7280', label: 'User' }
  };
  const { bg, color, label } = config[role] || config.user;
  return (
    <span
      style={{ background: bg, color, borderColor: `${color}30` }}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
    >
      {label}
    </span>
  );
}

// Deactivated Badge Component - Shows Yes/No for isDeactivated
function DeactivatedBadge({ isDeactivated }) {
  return (
    <span
      style={{
        background: isDeactivated ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.12)',
        color: isDeactivated ? '#F97316' : '#10B981',
        borderColor: isDeactivated ? 'rgba(249,115,22,0.25)' : 'rgba(16,185,129,0.25)'
      }}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold border inline-flex items-center gap-1"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isDeactivated ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
      {isDeactivated ? 'Yes' : 'No'}
    </span>
  );
}

// RFID Hex conversion utility
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

// Add User Modal - Updated with selection buttons and custom notifications
function AddUserModal({ theme, isDarkMode, onClose, onSuccess, showNotification }) {
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
        showNotification?.('success', `${accountType} created! Temporary PIN sent to ${formData.email}`);
      } else {
        showNotification?.('warning', `${accountType} created but email failed. Temporary PIN: ${temporaryPin}`);
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
                {[
                  { value: 'sysad', label: 'System Admin', color: '#8B5CF6' },
                  { value: 'treasury', label: 'Treasury', color: '#10B981' },
                  { value: 'accounting', label: 'Accounting', color: '#A855F7' },
                  { value: 'motorpool', label: 'Motorpool', color: '#F59E0B' },
                  { value: 'merchant', label: 'Merchant', color: '#EC4899' }
                ].map((option) => (
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
        @keyframes tableRowFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-tableRowFade { animation: tableRowFade 0.3s ease-out both; }
      `}</style>
    </div>
  );
}

// Edit User Modal
function EditUserModal({ theme, isDarkMode, user, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    middleName: user.middleName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    schoolUId: user.schoolUId || '',
    isActive: user.isActive !== false
  });
  const [submitting, setSubmitting] = useState(false);

  const [validationError, setValidationError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.firstName || !formData.lastName || !formData.email) {
      setValidationError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Backend uses PUT not PATCH for user updates
      await api.put(`/admin/sysad/users/${user._id}`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        studentId: formData.schoolUId,
        status: formData.isActive ? 'active' : 'inactive'
      });
      onSuccess();
    } catch (error) {
      setValidationError(error.message || 'Failed to update user');
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
        <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 100%)' }} className="px-6 py-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-blue-500 flex items-center gap-2">
            <Edit className="w-5 h-5" /> Edit User
          </h3>
          <button onClick={onClose} style={{ color: theme.text.secondary }} className="hover:opacity-70"><X className="w-6 h-6" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Validation Error Display */}
          {validationError && (
            <div style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }} className="p-3 rounded-xl border flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-500 text-sm">{validationError}</p>
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
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              required
            />
          </div>
          <div>
            <label style={{ color: theme.text.secondary }} className="block text-xs font-semibold uppercase mb-2">School ID</label>
            <input
              type="text"
              value={formData.schoolUId}
              onChange={(e) => setFormData({ ...formData, schoolUId: e.target.value })}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
            />
          </div>

          {/* Status Toggle */}
          <div
            style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }}
            className="p-4 rounded-xl border flex items-center justify-between"
          >
            <div>
              <p style={{ color: theme.text.primary }} className="font-semibold">Account Status</p>
              <p style={{ color: theme.text.secondary }} className="text-xs">
                {formData.isActive ? 'User can access the system' : 'User cannot access the system'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              style={{
                background: formData.isActive ? '#10B981' : '#EF4444'
              }}
              className="px-4 py-2 rounded-lg text-white font-semibold text-sm transition"
            >
              {formData.isActive ? 'Active' : 'Inactive'}
            </button>
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
              disabled={submitting}
              style={{ background: '#3B82F6', color: '#FFFFFF' }}
              className="flex-1 py-3 rounded-xl font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Saving...' : 'Save Changes'}
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

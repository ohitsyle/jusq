// src/admin/components/Logs/LogsList.jsx
// Enhanced with pagination, detail view, and department-based filtering
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { Search, Download } from 'lucide-react';
import { exportToCSV, prepareDataForExport } from '../../../utils/csvExport';
import LogDetailModal from '../../../components/modals/LogDetailModal';

export default function LogsList() {
  const { theme, isDarkMode } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('timestamp'); // 'timestamp', 'type', 'user'
  const logsPerPage = 20;
  const [adminData] = useState(() => {
    const data = localStorage.getItem('adminData');
    return data ? JSON.parse(data) : null;
  });

  const loadLogs = async () => {
    try {
      // Pass the admin's department to filter logs server-side
      const department = adminData?.role || 'sysad';
      const data = await api.get(`/admin/event-logs?department=${department}`);
      setLogs(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading logs:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    // Prepare data without location and severity
    const exportData = filteredLogs.map(log => ({
      Timestamp: new Date(log.timestamp).toLocaleString(),
      Action: log.title || log.eventType || 'N/A',
      User: log.adminName || log.driverName || log.userId || 'System',
      'ID Number': log.adminId || log.driverId || log.userId || '-',
      Description: log.description || log.message || '-',
      Status: log.status || 'success'
    }));
    exportToCSV(exportData, `${adminData?.role || 'system'}-logs`);
  };

  // Filter logs based on admin department
  const filterByDepartment = (log) => {
    const role = adminData?.role;

    // System admin sees everything
    if (role === 'sysad') return true;

    // Motorpool admin sees:
    // - who/when/what (all motorpool admin activities)
    // - login/logout of every motorpool admin
    // - crud of every tab and by which motorpool admin
    // - which motorpool admin updates/adds note, resolves a concern by which user
    // - when driver logs in/out of mobileapp
    // - when driver choose shuttle and route
    // - when driver start trip, end trip, and goes back to routes page (changes routes and refunds)
    // - which motorpool admin changed auto export configs for department
    // - display if a certain motorpool admin did a manual export
    if (role === 'motorpool') {
      const isMotorpoolAdminAuth = (log.eventType === 'login' || log.eventType === 'logout') &&
        log.metadata?.adminRole === 'motorpool';

      const isMotorpoolCRUD = (log.eventType === 'crud_create' || log.eventType === 'crud_update' || log.eventType === 'crud_delete') &&
        log.metadata?.adminRole === 'motorpool';

      const isMotorpoolNotes = (log.eventType === 'note_added' || log.eventType === 'note_updated' || log.eventType === 'concern_resolved') &&
        log.metadata?.adminRole === 'motorpool';

      const isMotorpoolDriverActivity = 
        log.eventType === 'driver_login' ||
        log.eventType === 'driver_logout' ||
        log.eventType === 'trip_start' ||
        log.eventType === 'trip_end' ||
        log.eventType === 'route_change' ||
        log.eventType === 'refund';

      const isMotorpoolExport = 
        (log.eventType === 'export_manual' || log.eventType === 'export_auto') &&
        log.metadata?.adminRole === 'motorpool';

      const isMotorpoolConfig =
        (log.eventType === 'config_updated' && log.metadata?.adminRole === 'motorpool') ||
        log.department === 'motorpool';

      const isMotorpoolRelated =
        log.driverId ||
        log.shuttleId ||
        log.routeId ||
        log.tripId ||
        log.targetEntity === 'driver' ||
        log.targetEntity === 'shuttle' ||
        log.targetEntity === 'route' ||
        log.targetEntity === 'trip' ||
        log.targetEntity === 'phone';

      return isMotorpoolAdminAuth || isMotorpoolCRUD || isMotorpoolNotes || 
             isMotorpoolDriverActivity || isMotorpoolExport || isMotorpoolConfig || isMotorpoolRelated;
    }

    // Merchant admin sees:
    // - who/when/what (all merchant admin activities)
    // - login/logout of every merchant admin
    // - crud of every tab and by which merchant admin
    // - which merchant admin updates/adds note, resolves a concern by which user
    // - when a merchant logs on/off mobile app
    // - which merchant admin changed auto export configs for department
    // - display if a certain merchant admin did a manual export
    if (role === 'merchant') {
      const isMerchantAdminAuth = (log.eventType === 'login' || log.eventType === 'logout') &&
        log.metadata?.adminRole === 'merchant';

      const isMerchantCRUD = (log.eventType === 'crud_create' || log.eventType === 'crud_update' || log.eventType === 'crud_delete') &&
        log.metadata?.adminRole === 'merchant';

      const isMerchantNotes = (log.eventType === 'note_added' || log.eventType === 'note_updated' || log.eventType === 'concern_resolved') &&
        log.metadata?.adminRole === 'merchant';

      const isMerchantActivity = 
        log.eventType === 'merchant_login' ||
        log.eventType === 'merchant_logout';

      const isMerchantExport = 
        (log.eventType === 'export_manual' || log.eventType === 'export_auto') &&
        log.metadata?.adminRole === 'merchant';

      const isMerchantConfig =
        (log.eventType === 'config_updated' && log.metadata?.adminRole === 'merchant') ||
        log.department === 'merchant';

      const isMerchantRelated = log.targetEntity === 'merchant';

      return isMerchantAdminAuth || isMerchantCRUD || isMerchantNotes || 
             isMerchantActivity || isMerchantExport || isMerchantConfig || isMerchantRelated;
    }

    // Treasury admin sees:
    // - who/when/what (all treasury admin activities)
    // - login/logout of every treasury admin
    // - crud of every tab and by which treasury admin
    // - which treasury admin updates/adds note, resolves a concern by which user
    // - cashed in which user by which treasury admin
    // - which treasury admin changed auto export configs for department
    // - display if a certain treasury admin did a manual export
    if (role === 'treasury') {
      const isTreasuryAdminAuth = (log.eventType === 'login' || log.eventType === 'logout') &&
        log.metadata?.adminRole === 'treasury';

      const isTreasuryCRUD = (log.eventType === 'crud_create' || log.eventType === 'crud_update' || log.eventType === 'crud_delete') &&
        log.metadata?.adminRole === 'treasury';

      const isTreasuryNotes = (log.eventType === 'note_added' || log.eventType === 'note_updated' || log.eventType === 'concern_resolved') &&
        log.metadata?.adminRole === 'treasury';

      const isTreasuryCashIn = log.eventType === 'cash_in' && log.metadata?.adminRole === 'treasury';

      const isTreasuryExport = 
        (log.eventType === 'export_manual' || log.eventType === 'export_auto') &&
        log.metadata?.adminRole === 'treasury';

      const isTreasuryConfig =
        (log.eventType === 'config_updated' && log.metadata?.adminRole === 'treasury') ||
        log.department === 'treasury';

      const isTreasuryRelated = 
        log.targetEntity === 'user' ||
        log.targetEntity === 'transaction' ||
        log.eventType === 'registration';

      return isTreasuryAdminAuth || isTreasuryCRUD || isTreasuryNotes || 
             isTreasuryCashIn || isTreasuryExport || isTreasuryConfig || isTreasuryRelated;
    }

    // Accounting admin sees:
    // - who/when/what (all accounting admin activities)
    // - login/logout of every accounting admin
    // - crud of every tab and by which accounting admin
    // - which accounting admin updates/adds note, resolves a concern by which user
    // - cashed in which user by which accounting admin
    // - which accounting admin changed auto export configs for department
    // - display if a certain accounting admin did a manual export
    // SAME ACCESS AS TREASURY
    if (role === 'accounting') {
      const isAccountingAdminAuth = (log.eventType === 'login' || log.eventType === 'logout') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingCRUD = (log.eventType === 'crud_create' || log.eventType === 'crud_update' || log.eventType === 'crud_delete') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingNotes = (log.eventType === 'note_added' || log.eventType === 'note_updated' || log.eventType === 'concern_resolved') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingCashIn = log.eventType === 'cash_in' && log.metadata?.adminRole === 'accounting';

      const isAccountingExport = 
        (log.eventType === 'export_manual' || log.eventType === 'export_auto') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingConfig =
        (log.eventType === 'config_updated' && log.metadata?.adminRole === 'accounting') ||
        log.department === 'accounting';

      const isAccountingRelated = 
        log.targetEntity === 'user' ||
        log.targetEntity === 'transaction' ||
        log.eventType === 'registration';

      return isAccountingAdminAuth || isAccountingCRUD || isAccountingNotes || 
             isAccountingCashIn || isAccountingExport || isAccountingConfig || isAccountingRelated;
    }

    return false;
  };

  const filteredLogs = logs.filter(log => {
    // First filter by department
    if (!filterByDepartment(log)) return false;

    // Then apply user filters
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
        log.eventType?.toLowerCase().includes(searchLower) ||
        log.type?.toLowerCase().includes(searchLower) ||
        log.title?.toLowerCase().includes(searchLower) ||
        log.description?.toLowerCase().includes(searchLower) ||
        log.message?.toLowerCase().includes(searchLower) ||
        log.adminName?.toLowerCase().includes(searchLower) ||
        log.adminId?.toLowerCase().includes(searchLower) ||
        new Date(log.timestamp).toLocaleString().toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }

    if (typeFilter) {
      const eventType = log.eventType || log.type;
      
      // Handle grouped filters
      if (typeFilter === 'access_control') {
        // Match login and logout events
        const accessControlTypes = ['login', 'logout'];
        if (!accessControlTypes.includes(eventType)) return false;
      } else if (typeFilter === 'admin_action') {
        // Match CRUD operations, notes, and concern resolution
        const adminActionTypes = ['crud_create', 'crud_update', 'crud_delete', 'note_added', 'note_updated', 'concern_resolved'];
        if (!adminActionTypes.includes(eventType)) return false;
      } else if (typeFilter === 'driver_activities') {
        // Match driver login and logout
        const driverActivityTypes = ['driver_login', 'driver_logout'];
        if (!driverActivityTypes.includes(eventType)) return false;
      } else if (typeFilter === 'merchant_activities') {
        // Match merchant login and logout
        const merchantActivityTypes = ['merchant_login', 'merchant_logout'];
        if (!merchantActivityTypes.includes(eventType)) return false;
      } else if (typeFilter === 'trip_operations') {
        // Match trip-related operations
        const tripOperationTypes = ['trip_start', 'trip_end', 'route_change', 'refund'];
        if (!tripOperationTypes.includes(eventType)) return false;
      } else if (typeFilter === 'data_management') {
        // Match export and config operations
        const dataManagementTypes = ['export_manual', 'export_auto', 'config_updated'];
        if (!dataManagementTypes.includes(eventType)) return false;
      } else if (typeFilter === 'system_operations') {
        // Match system-level operations
        const systemOperationTypes = ['maintenance_mode', 'student_deactivation', 'user_action', 'system', 'security', 'error'];
        if (!systemOperationTypes.includes(eventType)) return false;
      } else {
        // Match exact event type (for individual filters like cash_in, registration)
        if (eventType !== typeFilter) return false;
      }
    }
    if (statusFilter && log.status !== statusFilter) return false;

    if (startDate || endDate) {
      const logDate = new Date(log.timestamp);
      if (startDate && logDate < new Date(startDate)) return false;
      if (endDate && logDate > new Date(endDate + 'T23:59:59')) return false;
    }

    return true;
  });

  // Sort logs based on sortBy selection
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (sortBy === 'timestamp') {
      return new Date(b.timestamp) - new Date(a.timestamp);
    } else if (sortBy === 'type') {
      return (a.eventType || a.type || '').localeCompare(b.eventType || b.type || '');
    } else if (sortBy === 'user') {
      return (a.adminName || a.driverName || '').localeCompare(b.adminName || b.driverName || '');
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedLogs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentLogs = sortedLogs.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter, startDate, endDate]);

  // Get type options based on department
  const getTypeOptions = () => {
    const role = adminData?.role;

    if (role === 'motorpool') {
      return [
        { value: 'access_control', label: 'Access Control' },
        { value: 'admin_action', label: 'Admin Actions' },
        { value: 'driver_activities', label: 'Driver Activities' },
        { value: 'trip_operations', label: 'Trip Operations' },
        { value: 'data_management', label: 'Data Management' }
      ];
    }

    if (role === 'treasury') {
      return [
        { value: 'access_control', label: 'Access Control' },
        { value: 'admin_action', label: 'Admin Actions' },
        { value: 'cash_in', label: 'Cash In' },
        { value: 'registration', label: 'Registration' },
        { value: 'data_management', label: 'Data Management' }
      ];
    }

    if (role === 'merchant') {
      return [
        { value: 'access_control', label: 'Access Control' },
        { value: 'admin_action', label: 'Admin Actions' },
        { value: 'merchant_activities', label: 'Merchant Activities' },
        { value: 'data_management', label: 'Data Management' }
      ];
    }

    if (role === 'accounting') {
      return [
        { value: 'access_control', label: 'Access Control' },
        { value: 'admin_action', label: 'Admin Actions' },
        { value: 'cash_in', label: 'Cash In' },
        { value: 'registration', label: 'Registration' },
        { value: 'data_management', label: 'Data Management' }
      ];
    }

    // System admin (sysad) - sees everything
    return [
      { value: 'access_control', label: 'Access Control' },
      { value: 'admin_action', label: 'Admin Actions' },
      { value: 'driver_activities', label: 'Driver Activities' },
      { value: 'merchant_activities', label: 'Merchant Activities' },
      { value: 'trip_operations', label: 'Trip Operations' },
      { value: 'cash_in', label: 'Cash In' },
      { value: 'registration', label: 'Registration' },
      { value: 'data_management', label: 'Data Management' },
      { value: 'system_operations', label: 'System Operations' }
    ];
  };

  const getStatusBadge = (status) => {
    if (status === 'success' || !status) {
      return { bg: 'rgba(34,197,94,0.2)', color: '#22C55E', label: 'Success' };
    }
    if (status === 'failed' || status === 'error') {
      return { bg: 'rgba(239,68,68,0.2)', color: '#EF4444', label: 'Failed' };
    }
    return { bg: 'rgba(251,191,36,0.2)', color: '#FBBF24', label: status };
  };

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
        Loading logs...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>📋</span> Activity Logs
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Showing {filteredLogs.length} logs • Page {currentPage} of {Math.max(1, totalPages)}
        </p>
      </div>

      {/* Actions Bar - New UI Style */}
      <div
        style={{
          background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
          borderColor: theme.accent.primary
        }}
        className="rounded-xl border-2 p-4 mb-5"
      >
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', 
                color: theme.text.primary, 
                borderColor: theme.border.primary 
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50"
            />
          </div>

          {/* Type Filter - Button Group */}
          <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
            <button
              onClick={() => setTypeFilter('')}
              style={{
                background: typeFilter === '' ? theme.accent.primary : 'transparent',
                color: typeFilter === '' ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            >
              All
            </button>
            {getTypeOptions().map((option) => (
              <button
                key={option.value}
                onClick={() => setTypeFilter(option.value)}
                style={{
                  background: typeFilter === option.value ? theme.accent.primary : 'transparent',
                  color: typeFilter === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 whitespace-nowrap"
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Status Filter - Button Group */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
            <button
              onClick={() => setStatusFilter('')}
              style={{
                background: statusFilter === '' ? theme.accent.primary : 'transparent',
                color: statusFilter === '' ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('success')}
              style={{
                background: statusFilter === 'success' ? theme.accent.primary : 'transparent',
                color: statusFilter === 'success' ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            >
              Success
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              style={{
                background: statusFilter === 'failed' ? theme.accent.primary : 'transparent',
                color: statusFilter === 'failed' ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            >
              Failed
            </button>
          </div>

          {/* Sort Buttons - Only show for sysad */}
          {adminData?.role === 'sysad' && (
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
              {[
                { value: 'timestamp', label: 'Date' },
                { value: 'type', label: 'Type' },
                { value: 'user', label: 'User' }
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
          )}

          {/* Date Range Filters */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ 
                background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', 
                color: theme.text.primary, 
                borderColor: theme.border.primary 
              }}
              className="px-3 py-1.5 rounded-xl border text-xs focus:outline-none"
            />
            <span style={{ color: theme.text.tertiary }} className="text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ 
                background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', 
                color: theme.text.primary, 
                borderColor: theme.border.primary 
              }}
              className="px-3 py-1.5 rounded-xl border text-xs focus:outline-none"
            />
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExport}
            disabled={sortedLogs.length === 0}
            style={{ 
              background: sortedLogs.length === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)', 
              color: sortedLogs.length === 0 ? 'rgba(16,185,129,0.5)' : '#10B981', 
              borderColor: sortedLogs.length === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.3)' 
            }}
            className="px-4 py-2 rounded-xl font-semibold text-sm border flex items-center gap-2 hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 overflow-y-auto">
        {sortedLogs.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-semibold">No logs found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div
              style={{ background: theme.bg.card, borderColor: theme.border.primary }}
              className="overflow-x-auto rounded-xl border mb-5"
            >
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr style={{ background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)' }}>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Timestamp</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Action</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">User</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">ID Number</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Description</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Status</th>
                    <th style={{ color: theme.accent.primary, borderColor: theme.border.primary }} className="text-center p-4 text-[11px] font-extrabold uppercase border-b-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogs.map((log, index) => {
                    const actor = log.adminName || log.driverName || 'System';
                    const actorId = log.adminId || log.driverId || log.userId || '-';
                    const statusBadge = getStatusBadge(log.status);

                    return (
                      <tr
                        key={log._id || index}
                        style={{ borderColor: theme.border.primary }}
                        className="border-b hover:bg-white/5 transition"
                      >
                        <td style={{ color: theme.text.secondary }} className="p-4 text-xs">
                          <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                          <div style={{ color: theme.text.muted }} className="text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="p-4">
                          <div style={{ color: theme.text.primary }} className="font-semibold mb-1">
                            {log.title || 'N/A'}
                          </div>
                          <span
                            style={{
                              background: log.eventType === 'login' ? 'rgba(34,197,94,0.2)' :
                                log.eventType === 'logout' ? 'rgba(239,68,68,0.2)' :
                                  'rgba(59,130,246,0.2)',
                              color: log.eventType === 'login' ? '#22C55E' :
                                log.eventType === 'logout' ? '#EF4444' :
                                  '#3B82F6'
                            }}
                            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          >
                            {log.eventType || log.type || 'action'}
                          </span>
                        </td>
                        <td style={{ color: theme.text.primary }} className="p-4 font-semibold">
                          {actor}
                        </td>
                        <td style={{ color: theme.text.secondary }} className="p-4 font-mono text-xs">
                          {actorId}
                        </td>
                        <td style={{ color: theme.text.secondary }} className="p-4 max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {log.description || log.message || '-'}
                        </td>
                        <td className="p-4">
                          <span
                            style={{ background: statusBadge.bg, color: statusBadge.color }}
                            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase"
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedLog(log)}
                            style={{
                              background: isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.15)',
                              borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)',
                              color: theme.accent.primary
                            }}
                            className="px-3.5 py-1.5 border-2 rounded-lg text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{ background: theme.bg.card, borderColor: theme.border.primary }}
                className="flex justify-between items-center p-4 rounded-xl border"
              >
                <div style={{ color: theme.text.secondary }} className="text-sm">
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedLogs.length)} of {sortedLogs.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={{
                      background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : (isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.15)'),
                      borderColor: theme.border.primary,
                      color: currentPage === 1 ? theme.text.muted : theme.accent.primary
                    }}
                    className="px-4 py-2 border-2 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : (isDarkMode ? 'rgba(255,212,28,0.15)' : 'rgba(59,130,246,0.15)'),
                      borderColor: theme.border.primary,
                      color: currentPage === totalPages ? theme.text.muted : theme.accent.primary
                    }}
                    className="px-4 py-2 border-2 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
// src/admin/components/Logs/LogsList.jsx
// Enhanced with pagination, detail view, and department-based filtering
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import SearchBar from '../../../components/shared/SearchBar';
import ExportButton from '../../../components/shared/ExportButton';
import StatusFilter from '../../../components/shared/StatusFilter';
import DateRangeFilter from '../../../components/shared/DateRangeFilter';
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
    // - which accounting admin changed auto export configs for department
    // - display if a certain accounting admin did a manual export
    if (role === 'accounting') {
      const isAccountingAdminAuth = (log.eventType === 'login' || log.eventType === 'logout') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingCRUD = (log.eventType === 'crud_create' || log.eventType === 'crud_update' || log.eventType === 'crud_delete') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingExport = 
        (log.eventType === 'export_manual' || log.eventType === 'export_auto') &&
        log.metadata?.adminRole === 'accounting';

      const isAccountingConfig =
        (log.eventType === 'config_updated' && log.metadata?.adminRole === 'accounting') ||
        log.department === 'accounting';

      return isAccountingAdminAuth || isAccountingCRUD || isAccountingExport || isAccountingConfig;
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

    if (typeFilter && (log.eventType || log.type) !== typeFilter) return false;
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
        { value: 'login', label: 'Admin Login' },
        { value: 'logout', label: 'Admin Logout' },
        { value: 'crud_create', label: 'Create Record' },
        { value: 'crud_update', label: 'Update Record' },
        { value: 'crud_delete', label: 'Delete Record' },
        { value: 'note_added', label: 'Note Added' },
        { value: 'note_updated', label: 'Note Updated' },
        { value: 'concern_resolved', label: 'Concern Resolved' },
        { value: 'driver_login', label: 'Driver Login' },
        { value: 'driver_logout', label: 'Driver Logout' },
        { value: 'trip_start', label: 'Trip Start' },
        { value: 'trip_end', label: 'Trip End' },
        { value: 'route_change', label: 'Route Change' },
        { value: 'refund', label: 'Refund' },
        { value: 'export_manual', label: 'Manual Export' },
        { value: 'export_auto', label: 'Auto Export' },
        { value: 'config_updated', label: 'Config Updated' }
      ];
    }

    if (role === 'treasury') {
      return [
        { value: 'login', label: 'Admin Login' },
        { value: 'logout', label: 'Admin Logout' },
        { value: 'crud_create', label: 'Create Record' },
        { value: 'crud_update', label: 'Update Record' },
        { value: 'crud_delete', label: 'Delete Record' },
        { value: 'note_added', label: 'Note Added' },
        { value: 'note_updated', label: 'Note Updated' },
        { value: 'concern_resolved', label: 'Concern Resolved' },
        { value: 'cash_in', label: 'Cash In' },
        { value: 'registration', label: 'Registration' },
        { value: 'export_manual', label: 'Manual Export' },
        { value: 'export_auto', label: 'Auto Export' },
        { value: 'config_updated', label: 'Config Updated' }
      ];
    }

    if (role === 'merchant') {
      return [
        { value: 'login', label: 'Admin Login' },
        { value: 'logout', label: 'Admin Logout' },
        { value: 'crud_create', label: 'Create Record' },
        { value: 'crud_update', label: 'Update Record' },
        { value: 'crud_delete', label: 'Delete Record' },
        { value: 'note_added', label: 'Note Added' },
        { value: 'note_updated', label: 'Note Updated' },
        { value: 'concern_resolved', label: 'Concern Resolved' },
        { value: 'merchant_login', label: 'Merchant Login' },
        { value: 'merchant_logout', label: 'Merchant Logout' },
        { value: 'export_manual', label: 'Manual Export' },
        { value: 'export_auto', label: 'Auto Export' },
        { value: 'config_updated', label: 'Config Updated' }
      ];
    }

    if (role === 'accounting') {
      return [
        { value: 'login', label: 'Admin Login' },
        { value: 'logout', label: 'Admin Logout' },
        { value: 'crud_create', label: 'Create Record' },
        { value: 'crud_update', label: 'Update Record' },
        { value: 'crud_delete', label: 'Delete Record' },
        { value: 'export_manual', label: 'Manual Export' },
        { value: 'export_auto', label: 'Auto Export' },
        { value: 'config_updated', label: 'Config Updated' }
      ];
    }

    // System admin (sysad) - sees everything
    return [
      { value: 'login', label: 'Login' },
      { value: 'logout', label: 'Logout' },
      { value: 'crud_create', label: 'Create Record' },
      { value: 'crud_update', label: 'Update Record' },
      { value: 'crud_delete', label: 'Delete Record' },
      { value: 'note_added', label: 'Note Added' },
      { value: 'note_updated', label: 'Note Updated' },
      { value: 'concern_resolved', label: 'Concern Resolved' },
      { value: 'driver_login', label: 'Driver Login' },
      { value: 'driver_logout', label: 'Driver Logout' },
      { value: 'merchant_login', label: 'Merchant Login' },
      { value: 'merchant_logout', label: 'Merchant Logout' },
      { value: 'trip_start', label: 'Trip Start' },
      { value: 'trip_end', label: 'Trip End' },
      { value: 'route_change', label: 'Route Change' },
      { value: 'refund', label: 'Refund' },
      { value: 'cash_in', label: 'Cash In' },
      { value: 'registration', label: 'Registration' },
      { value: 'export_manual', label: 'Manual Export' },
      { value: 'export_auto', label: 'Auto Export' },
      { value: 'maintenance_mode', label: 'Maintenance Mode' },
      { value: 'student_deactivation', label: 'Student Deactivation' },
      { value: 'config_updated', label: 'Config Updated' },
      { value: 'admin_action', label: 'Admin Action' },
      { value: 'user_action', label: 'User Action' },
      { value: 'system', label: 'System Event' },
      { value: 'security', label: 'Security Event' },
      { value: 'error', label: 'Error' }
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

      {/* Filters */}
      <div
        style={{
          background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
          borderColor: theme.accent.primary
        }}
        className="rounded-xl border-2 p-4 mb-5 flex flex-wrap gap-3 items-end"
      >
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search logs..." />
        <StatusFilter
          value={typeFilter}
          onChange={setTypeFilter}
          label="Type"
          options={getTypeOptions()}
        />
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          label="Status"
          options={[
            { value: 'success', label: 'Success' },
            { value: 'failed', label: 'Failed' }
          ]}
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        
        {/* Sort Buttons */}
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
        
        <ExportButton onClick={handleExport} disabled={sortedLogs.length === 0} />
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

// src/pages/admin/Sysad/ConfigPage.jsx
// System Admin Configuration - Maintenance Mode, Export Settings, Deactivation Scheduler

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Settings, Shield, Download, Calendar, Clock, Power, AlertTriangle, CheckCircle, X, Loader2, Archive, FileText, RefreshCw, Users } from 'lucide-react';
import ScheduleExportModal from '../../../components/modals/ScheduleExportModal';
import { ThemedDateInput, ThemedTimeInput } from '../../../components/shared/ThemedControls';

// Sysad-specific export types
const SYSAD_EXPORT_TYPES = [
  { value: 'Transactions', icon: '💳', label: 'Transactions' },
  { value: 'Users', icon: '👥', label: 'Users' },
  { value: 'Merchants', icon: '🏪', label: 'Merchants' },
  { value: 'Admins', icon: '👤', label: 'Admins' },
  { value: 'Logs', icon: '📋', label: 'System Logs' },
  { value: 'Concerns', icon: '💬', label: 'All Concerns' }
];

export default function SysadConfigPage() {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);

  // Sysad-specific configs (maintenance mode, deactivation scheduler)
  const [sysadConfig, setSysadConfig] = useState({
    maintenanceMode: false,
    maintenanceMessage: 'System is under maintenance. Please try again later.',
    deactivationScheduler: {
      enabled: false,
      date: '',
      time: ''
    }
  });

  // Export configurations (role-specific, same pattern as other admins)
  const [configurations, setConfigurations] = useState({
    autoExport: {
      frequency: 'daily',
      exportTypes: [],
      time: '00:00',
      emailRecipients: []
    }
  });

  const [exportHistory, setExportHistory] = useState([]);
  const [scheduledExports, setScheduledExports] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showEditMsgModal, setShowEditMsgModal] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);
  const [maintenanceMsgInput, setMaintenanceMsgInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [archiveFilter, setArchiveFilter] = useState('all');

  // Use theme accent color
  const accentColor = theme.accent.primary;

  useEffect(() => {
    fetchSysadConfig();
    loadConfigurations();
    loadExportHistory();
    loadScheduledExports();
  }, []);

  // Fetch sysad-specific config (maintenance mode, deactivation scheduler)
  const fetchSysadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/sysad/config');
      if (data?.config) {
        setSysadConfig(prev => ({ ...prev, ...data.config }));
      }
    } catch (error) {
      console.error('Failed to fetch sysad config:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load sysad-specific export configuration
  const loadConfigurations = async () => {
    try {
      const data = await api.get('/admin/configurations?adminRole=sysad');
      if (data) {
        // Drop any stored types outside this role's allowed list (keeps the
        // "N selected" count honest even if the saved config was polluted).
        const allowed = new Set(SYSAD_EXPORT_TYPES.map((t) => t.value.toLowerCase().replace(/\s+/g, '')));
        if (data.autoExport?.exportTypes) {
          data.autoExport.exportTypes = data.autoExport.exportTypes.filter(
            (t) => allowed.has(String(t).toLowerCase().replace(/\s+/g, ''))
          );
        }
        setConfigurations(data);
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  };

  const loadExportHistory = async () => {
    try {
      const data = await api.get('/admin/configurations/export-history?adminRole=sysad');
      setExportHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading export history:', error);
    }
  };

  const loadScheduledExports = async () => {
    try {
      const data = await api.get('/admin/configurations/scheduled-exports?adminRole=sysad');
      setScheduledExports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading scheduled exports:', error);
    }
  };

  const handleToggleMaintenance = async () => {
    // Enabling opens a confirmation modal (with the custom message); disabling
    // also goes through the modal for a consistent, non-blocking experience.
    setMaintenanceMsgInput(sysadConfig.maintenanceMessage);
    setShowMaintenanceModal(true);
  };

  const confirmEnableMaintenance = async () => {
    setSaving(true);
    try {
      await api.post('/admin/sysad/maintenance-mode', {
        enabled: true,
        message: maintenanceMsgInput || sysadConfig.maintenanceMessage
      });
      setSysadConfig(prev => ({
        ...prev,
        maintenanceMode: true,
        maintenanceMessage: maintenanceMsgInput || prev.maintenanceMessage
      }));
      toast.success('Maintenance mode enabled. All non-sysadmin users will be logged out.');
      setShowMaintenanceModal(false);
    } catch (error) {
      toast.error('Failed to enable maintenance mode');
    } finally {
      setSaving(false);
    }
  };

  const confirmDisableMaintenance = async () => {
    setSaving(true);
    try {
      await api.post('/admin/sysad/maintenance-mode', { enabled: false });
      setSysadConfig(prev => ({ ...prev, maintenanceMode: false }));
      toast.success('Maintenance mode disabled');
      setShowMaintenanceModal(false);
    } catch (error) {
      toast.error('Failed to disable maintenance mode');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    const trimmed = maintenanceMsgInput.trim();
    if (!trimmed) {
      toast.error('Message cannot be empty');
      return;
    }
    setSavingMsg(true);
    try {
      await api.post('/admin/sysad/maintenance-mode', { enabled: true, message: trimmed });
      setSysadConfig(prev => ({ ...prev, maintenanceMessage: trimmed }));
      toast.success('Maintenance message updated');
      setShowEditMsgModal(false);
    } catch (error) {
      toast.error('Failed to update maintenance message');
    } finally {
      setSavingMsg(false);
    }
  };

  const handleSaveAutoExport = async () => {
    setSaving(true);
    try {
      // Save with sysad admin role
      await api.put('/admin/configurations/auto-export', {
        ...configurations.autoExport,
        adminRole: 'sysad'
      });
      toast.success('Auto-export settings saved successfully!');
      setShowScheduleModal(false);
      loadConfigurations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleManualExport = async () => {
    setSaving(true);
    try {
      // Check if any export types are selected
      if (!configurations.autoExport.exportTypes || configurations.autoExport.exportTypes.length === 0) {
        toast.error('Please select at least one export type in the configuration settings');
        setSaving(false);
        return;
      }

      const result = await api.post('/admin/configurations/manual-export-sysad', {
        exportTypes: configurations.autoExport.exportTypes,
        dateRange,
        customStartDate,
        customEndDate
      });

      toast.success(`System data exported successfully! (${result.totalRecords || result.recordCount} total records)`);

      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileName || `sysad_export_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setShowExportModal(false);
      setDateRange('all');
      setCustomStartDate('');
      setCustomEndDate('');
      loadExportHistory();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Export failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExport = async (exportId) => {
    try {
      const result = await api.get(`/admin/configurations/download-export/${exportId}`);
      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      toast.error('Failed to download export');
    }
  };

  const handleSaveDeactivationSchedule = async () => {
    if (!sysadConfig.deactivationScheduler.date || !sysadConfig.deactivationScheduler.time) {
      toast.error('Please set both date and time');
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/sysad/deactivation-scheduler', sysadConfig.deactivationScheduler);
      toast.success('Deactivation schedule saved');
    } catch (error) {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // Combine exports for the archive table
  const combinedExports = [
    ...scheduledExports.map(exp => ({ ...exp, source: 'auto' })),
    ...exportHistory.map(exp => ({ ...exp, source: 'manual' }))
  ].sort((a, b) => new Date(b.exportedAt || b.timestamp || b.createdAt) - new Date(a.exportedAt || a.timestamp || a.createdAt));

  // Filter exports
  const filteredExports = combinedExports.filter((exp) => {
    // Archive filter
    if (archiveFilter !== 'all') {
      if (archiveFilter === 'auto' && exp.source !== 'auto') return false;
      if (archiveFilter === 'manual' && exp.source !== 'manual') return false;
    }

    // Search filter
    const matchesSearch = !searchQuery ||
      exp.exportType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.fileName?.toLowerCase().includes(searchQuery.toLowerCase());

    // Date filter
    const exportDate = new Date(exp.exportedAt || exp.timestamp || exp.createdAt);
    const matchesDateStart = !filterDateRange.start || exportDate >= new Date(filterDateRange.start);
    const matchesDateEnd = !filterDateRange.end || exportDate <= new Date(filterDateRange.end + 'T23:59:59');

    return matchesSearch && matchesDateStart && matchesDateEnd;
  });

  if (loading) {
    return (
      <div style={{ color: accentColor }} className="text-center py-20">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: accentColor }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <Settings className="w-5 h-5" /> System Configuration
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Manage system settings, maintenance mode, exports, and scheduled tasks
        </p>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-2">
        {/* Maintenance Mode */}
        <div
          style={{ background: theme.bg.card, borderColor: sysadConfig.maintenanceMode ? 'rgba(239,68,68,0.5)' : theme.border.primary }}
          className="p-6 rounded-2xl border-2"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div
                style={{ background: sysadConfig.maintenanceMode ? 'rgba(239,68,68,0.2)' : `${accentColor}20` }}
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <Shield className="w-6 h-6" style={{ color: sysadConfig.maintenanceMode ? '#EF4444' : accentColor }} />
              </div>
              <div className="flex-1">
                <h3 style={{ color: theme.text.primary }} className="font-bold text-lg mb-1">Maintenance Mode</h3>
                <p style={{ color: theme.text.secondary }} className="text-sm mb-3">
                  When enabled, only system administrators can access the system. All other users will be logged out and will see a maintenance message.
                </p>
                
                {/* Message + Edit only appear once maintenance mode is enabled */}
                {sysadConfig.maintenanceMode && (
                  <>
                    <div
                      style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-3"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-red-500 text-sm font-semibold">System is in maintenance mode - All non-sysadmin users logged out</span>
                    </div>

                    {/* Current Message Display */}
                    <div className="mb-3">
                      <div style={{ color: theme.text.secondary }} className="text-xs font-semibold mb-1">CURRENT MESSAGE:</div>
                      <div
                        style={{ background: theme.bg.secondary, borderColor: theme.border.primary, color: theme.text.primary }}
                        className="p-3 rounded-lg border text-sm"
                      >
                        {sysadConfig.maintenanceMessage}
                      </div>
                    </div>

                    {/* Edit Message Button */}
                    <button
                      onClick={() => { setMaintenanceMsgInput(sysadConfig.maintenanceMessage); setShowEditMsgModal(true); }}
                      style={{ background: `${accentColor}20`, color: accentColor, borderColor: accentColor }}
                      className="px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80 transition"
                    >
                      Edit Message
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={handleToggleMaintenance}
              disabled={saving}
              style={{
                background: sysadConfig.maintenanceMode ? '#EF4444' : '#10B981',
                color: '#FFFFFF'
              }}
              className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50 flex-shrink-0 ml-4"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
              {sysadConfig.maintenanceMode ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Automated System Export Section */}
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-6 rounded-2xl border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div style={{ background: `${accentColor}20` }} className="w-10 h-10 rounded-full flex items-center justify-center">
                <Download className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div>
                <h3 style={{ color: theme.text.primary }} className="font-bold text-lg">Automated System Export</h3>
                <p style={{ color: theme.text.secondary }} className="text-sm">
                  System automatically exports data as ZIP files for backup and compliance.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              style={{ background: `${accentColor}20`, color: accentColor, borderColor: `${accentColor}40` }}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm border hover:opacity-80 transition flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configure Schedule
            </button>
          </div>

          {/* Current Settings Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="p-4 rounded-xl border">
              <div className="text-2xl mb-2">📅</div>
              <div style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">Frequency</div>
              <div style={{ color: theme.text.primary }} className="font-bold">
                {configurations.autoExport?.frequency?.charAt(0).toUpperCase() + configurations.autoExport?.frequency?.slice(1) || 'Not set'}
              </div>
            </div>
            <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="p-4 rounded-xl border">
              <div className="text-2xl mb-2">🕐</div>
              <div style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">Export Time</div>
              <div style={{ color: theme.text.primary }} className="font-bold">
                {configurations.autoExport?.time || 'Not set'}
              </div>
            </div>
            <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }} className="p-4 rounded-xl border">
              <div className="text-2xl mb-2">📦</div>
              <div style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase mb-1">Data Types</div>
              <div style={{ color: theme.text.primary }} className="font-bold">
                {configurations.autoExport?.exportTypes?.length || 0} selected
              </div>
            </div>
          </div>

          {/* Manual Export Button */}
          <div style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }} className="p-6 rounded-xl border-2 border-dashed text-center">
            <div className="text-4xl mb-3">📦</div>
            <h4 style={{ color: theme.text.primary }} className="font-bold text-lg mb-2">Export System Data Now</h4>
            <p style={{ color: theme.text.secondary }} className="text-sm mb-4">
              Download a complete ZIP file with all system data: transactions, users, merchants, admins, logs, and concerns.
            </p>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={saving}
              style={{ background: '#10B981', color: '#FFFFFF' }}
              className="px-8 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? '⏳ Exporting...' : '📥 Download System Data (ZIP)'}
            </button>
          </div>
        </div>

        {/* Export Archive */}
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-6 rounded-2xl border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5" style={{ color: accentColor }} />
              <h3 style={{ color: theme.text.primary }} className="font-bold text-lg">Export Archive</h3>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              {['all', 'auto', 'manual'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setArchiveFilter(filter)}
                  style={{
                    background: archiveFilter === filter ? `${accentColor}20` : 'transparent',
                    color: archiveFilter === filter ? accentColor : theme.text.secondary,
                    borderColor: archiveFilter === filter ? `${accentColor}40` : theme.border.primary
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition capitalize"
                >
                  {filter === 'all' ? 'All' : filter === 'auto' ? 'Auto-Scheduled' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Date Filter */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <input
              type="text"
              placeholder="Search exports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="px-4 py-2 rounded-lg border text-sm flex-1 min-w-[200px] focus:outline-none"
            />
            <ThemedDateInput
              value={filterDateRange.start}
              onChange={(e) => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  max={filterDateRange.end || new Date().toLocaleDateString('en-CA')}
                />
            <span style={{ color: theme.text.secondary }} className="self-center">→</span>
            <ThemedDateInput
              value={filterDateRange.end}
              onChange={(e) => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  min={filterDateRange.start || undefined} max={new Date().toLocaleDateString('en-CA')}
                />
            {(filterDateRange.start || filterDateRange.end || searchQuery) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterDateRange({ start: '', end: '' });
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-500 border border-red-500/30"
              >
                Clear
              </button>
            )}
          </div>

          {/* Export List */}
          {filteredExports.length === 0 ? (
            <div className="text-center py-10" style={{ color: theme.text.muted }}>
              <div className="text-4xl mb-3 opacity-30">📂</div>
              <p>No exports yet</p>
              <p className="text-xs mt-1">Configure auto-export or trigger a manual export</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {filteredExports.map((exp, idx) => (
                <div
                  key={idx}
                  style={{ background: isDarkMode ? 'rgba(15,18,39,0.3)' : '#F9FAFB', borderColor: theme.border.primary }}
                  className="flex items-center justify-between p-4 rounded-xl border hover:border-opacity-50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg">{exp.source === 'auto' ? '🔄' : '👆'}</span>
                      <span style={{ color: accentColor }} className="font-bold">
                        {exp.exportType || 'System Export'}
                      </span>
                      <span
                        style={{
                          background: exp.source === 'auto' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
                          color: exp.source === 'auto' ? '#3B82F6' : '#A855F7'
                        }}
                        className="px-2 py-0.5 rounded text-xs font-bold"
                      >
                        {exp.source === 'auto' ? 'AUTO' : 'MANUAL'}
                      </span>
                    </div>
                    <div style={{ color: theme.text.secondary }} className="text-sm flex gap-4">
                      <span>📅 {new Date(exp.exportedAt || exp.timestamp || exp.createdAt).toLocaleDateString()}</span>
                      <span>🕐 {new Date(exp.exportedAt || exp.timestamp || exp.createdAt).toLocaleTimeString()}</span>
                      {exp.fileName && <span>📄 {exp.fileName}</span>}
                      {exp.recordCount && <span>📊 {exp.recordCount} records</span>}
                    </div>
                  </div>
                  {exp.status === 'success' ? (
                    <button
                      onClick={() => handleDownloadExport(exp._id)}
                      className="px-4 py-2 rounded-lg text-sm font-bold bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-green-500/30 transition"
                    >
                      📥 Download
                    </button>
                  ) : (
                    <span className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/20 text-red-500 border border-red-500/30">
                      ✗ Failed
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Deactivation Scheduler */}
        <div
          style={{
            background: theme.bg.card,
            borderColor: sysadConfig.deactivationScheduler?.enabled ? 'rgba(239,68,68,0.5)' : theme.border.primary
          }}
          className="p-6 rounded-2xl border-2"
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              style={{ background: sysadConfig.deactivationScheduler?.enabled ? 'rgba(239,68,68,0.2)' : `${accentColor}20` }}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Users className="w-5 h-5" style={{ color: sysadConfig.deactivationScheduler?.enabled ? '#EF4444' : accentColor }} />
            </div>
            <div>
              <h3 style={{ color: theme.text.primary }} className="font-bold text-lg">User Deactivation Scheduler</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm">
                Schedule a one-time batch deactivation of all student accounts.
              </p>
            </div>
          </div>

          {/* Status Banner */}
          {sysadConfig.deactivationScheduler?.enabled && (
            <div
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border mb-5"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-500 text-sm font-semibold">
                Deactivation scheduled — all student accounts will be deactivated on{' '}
                {sysadConfig.deactivationScheduler.date} at {sysadConfig.deactivationScheduler.time}
              </span>
            </div>
          )}

          {/* What this does */}
          <div
            style={{ background: isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}
            className="p-4 rounded-xl border mb-5"
          >
            <p style={{ color: theme.text.secondary }} className="text-sm leading-relaxed">
              <span style={{ color: '#EF4444' }} className="font-bold">⚠️ What this does: </span>
              At the scheduled date and time, <span style={{ color: theme.text.primary }} className="font-bold">all student accounts will be deactivated</span>. Students will no longer be able to log in, pay, or use their NUCash balance until an administrator reactivates them. Useful at the end of a semester or school year. <span style={{ color: '#EF4444' }} className="font-semibold">Accounts must be reactivated one by one — this cannot be undone in bulk.</span>
            </p>
          </div>

          {/* Scheduler Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label style={{ color: accentColor }} className="block text-xs font-bold uppercase mb-2">
                Deactivation Date
              </label>
              <ThemedDateInput
                value={sysadConfig.deactivationScheduler?.date || ''}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSysadConfig(prev => ({
                  ...prev,
                  deactivationScheduler: { ...prev.deactivationScheduler, date: e.target.value }
                }))}
                style={{
                  width: '100%',
                  background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                  border: `2px solid ${theme.border.primary}`,
                  borderRadius: '10px',
                  color: theme.text.primary,
                  padding: '10px 14px',
                  outline: 'none',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ color: accentColor }} className="block text-xs font-bold uppercase mb-2">
                Deactivation Time (24-hour)
              </label>
              <ThemedTimeInput
                value={sysadConfig.deactivationScheduler?.time || ''}
                onChange={(e) => setSysadConfig(prev => ({
                  ...prev,
                  deactivationScheduler: { ...prev.deactivationScheduler, time: e.target.value }
                }))}
                style={{
                  width: '100%',
                  background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                  border: `2px solid ${theme.border.primary}`,
                  borderRadius: '10px',
                  color: theme.text.primary,
                  padding: '10px 14px',
                  outline: 'none',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Enable Toggle + Save */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSysadConfig(prev => ({
                  ...prev,
                  deactivationScheduler: {
                    ...prev.deactivationScheduler,
                    enabled: !prev.deactivationScheduler?.enabled
                  }
                }))}
                style={{
                  background: sysadConfig.deactivationScheduler?.enabled ? '#EF4444' : '#6B7280',
                  width: '52px',
                  height: '28px',
                  borderRadius: '14px',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: sysadConfig.deactivationScheduler?.enabled ? '26px' : '2px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    background: '#FFFFFF',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </button>
              <span style={{ color: sysadConfig.deactivationScheduler?.enabled ? '#EF4444' : theme.text.secondary }} className="text-sm font-semibold">
                {sysadConfig.deactivationScheduler?.enabled ? 'Scheduler Enabled' : 'Scheduler Disabled'}
              </span>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveDeactivationSchedule}
              disabled={saving || !sysadConfig.deactivationScheduler?.date || !sysadConfig.deactivationScheduler?.time}
              style={{
                background: saving || !sysadConfig.deactivationScheduler?.date || !sysadConfig.deactivationScheduler?.time
                  ? 'rgba(239,68,68,0.3)'
                  : '#EF4444',
                color: '#FFFFFF',
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                cursor: saving || !sysadConfig.deactivationScheduler?.date || !sysadConfig.deactivationScheduler?.time ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: saving || !sysadConfig.deactivationScheduler?.date || !sysadConfig.deactivationScheduler?.time ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>

            {/* Clear Button */}
            {(sysadConfig.deactivationScheduler?.date || sysadConfig.deactivationScheduler?.enabled) && (
              <button
                onClick={async () => {
                  setSysadConfig(prev => ({
                    ...prev,
                    deactivationScheduler: { enabled: false, date: '', time: '' }
                  }));
                  try {
                    await api.post('/admin/sysad/deactivation-scheduler', { enabled: false, date: '', time: '' });
                    toast.success('Deactivation schedule cleared');
                  } catch {
                    toast.error('Failed to clear schedule');
                  }
                }}
                style={{
                  background: isDarkMode ? 'rgba(71,85,105,0.4)' : '#E5E7EB',
                  color: theme.text.secondary,
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Manual Export Modal */}
      {showExportModal && (
        <DateRangeModal
          theme={theme}
          isDarkMode={isDarkMode}
          dateRange={dateRange}
          setDateRange={setDateRange}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          loading={saving}
          onExport={handleManualExport}
          onCancel={() => {
            setShowExportModal(false);
            setDateRange('all');
            setCustomStartDate('');
            setCustomEndDate('');
          }}
        />
      )}

      {/* Auto Export Schedule Modal */}
      {showScheduleModal && (
        <ScheduleExportModal
          theme={theme}
          isDarkMode={isDarkMode}
          configurations={configurations}
          setConfigurations={setConfigurations}
          exportTypes={SYSAD_EXPORT_TYPES}
          loading={saving}
          onSave={handleSaveAutoExport}
          onCancel={() => setShowScheduleModal(false)}
        />
      )}

      {/* Maintenance Mode Modal */}
      {showMaintenanceModal && (
        <div
          onClick={() => !saving && setShowMaintenanceModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', background: isDarkMode ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)' : theme.bg.card, borderRadius: '16px', border: `2px solid ${sysadConfig.maintenanceMode ? '#22C55E' : '#F59E0B'}`, padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div style={{ background: sysadConfig.maintenanceMode ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)' }} className="w-11 h-11 rounded-full flex items-center justify-center">
                {sysadConfig.maintenanceMode
                  ? <Power className="w-6 h-6" style={{ color: '#22C55E' }} />
                  : <AlertTriangle className="w-6 h-6" style={{ color: '#F59E0B' }} />}
              </div>
              <h3 className="text-xl font-bold" style={{ color: theme.text.primary }}>
                {sysadConfig.maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
              </h3>
            </div>

            {sysadConfig.maintenanceMode ? (
              <p className="text-sm mb-6" style={{ color: theme.text.secondary }}>
                Disable maintenance mode? The system will become accessible to all users again.
              </p>
            ) : (
              <>
                <p className="text-sm mb-4" style={{ color: theme.text.secondary }}>
                  All non-sysadmin users will be <strong>immediately logged out</strong> and shown the message below until maintenance mode is turned off.
                </p>
                <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: theme.text.tertiary }}>
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceMsgInput}
                  onChange={(e) => setMaintenanceMsgInput(e.target.value)}
                  rows={3}
                  placeholder="System is under maintenance. Please try again later."
                  style={{ background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                  className="w-full p-3 rounded-xl border text-sm outline-none resize-none mb-6"
                />
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowMaintenanceModal(false)}
                disabled={saving}
                style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
                className="flex-1 py-3 rounded-xl font-semibold hover:opacity-80 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sysadConfig.maintenanceMode ? confirmDisableMaintenance : confirmEnableMaintenance}
                disabled={saving}
                style={{ background: sysadConfig.maintenanceMode ? '#EF4444' : '#22C55E', color: '#FFFFFF' }}
                className="flex-1 py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {sysadConfig.maintenanceMode ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Maintenance Message Modal */}
      {showEditMsgModal && (
        <div
          onClick={() => !savingMsg && setShowEditMsgModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', background: isDarkMode ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)' : theme.bg.card, borderRadius: '16px', border: `2px solid ${accentColor}`, padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div style={{ background: `${accentColor}26` }} className="w-11 h-11 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6" style={{ color: accentColor }} />
              </div>
              <h3 className="text-xl font-bold" style={{ color: theme.text.primary }}>
                Edit Maintenance Message
              </h3>
            </div>

            <p className="text-sm mb-4" style={{ color: theme.text.secondary }}>
              This message is shown to all non-sysadmin users while the system is in maintenance mode.
            </p>
            <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: theme.text.tertiary }}>
              Maintenance Message
            </label>
            <textarea
              value={maintenanceMsgInput}
              onChange={(e) => setMaintenanceMsgInput(e.target.value)}
              rows={3}
              placeholder="System is under maintenance. Please try again later."
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="w-full p-3 rounded-xl border text-sm outline-none resize-none mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditMsgModal(false)}
                disabled={savingMsg}
                style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
                className="flex-1 py-3 rounded-xl font-semibold hover:opacity-80 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMaintenanceMessage}
                disabled={savingMsg}
                style={{ background: accentColor, color: isDarkMode ? '#0f1227' : '#FFFFFF' }}
                className="flex-1 py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Date Range Modal for Manual Export
function DateRangeModal({ theme, isDarkMode, dateRange, setDateRange, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, loading, onExport, onCancel }) {
  const accentColor = theme.accent.primary;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ background: `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)` }} className="px-6 py-5">
          <h3 style={{ color: accentColor }} className="text-xl font-bold">Select Date Range</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm mt-1">Choose which records to include in the export</p>
        </div>

        <div className="p-6 space-y-3">
          {[
            { value: 'all', label: '📅 All Time', desc: 'Export all records' },
            { value: '24hr', label: '🕐 Last 24 Hours', desc: 'Records from the past day' },
            { value: 'week', label: '📆 This Week', desc: 'Records from the past 7 days' },
            { value: 'month', label: '📊 This Month', desc: 'Records from current month' },
            { value: 'custom', label: '🎯 Custom Range', desc: 'Choose specific dates' }
          ].map((option) => (
            <label
              key={option.value}
              style={{
                background: dateRange === option.value ? `${accentColor}15` : isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                borderColor: dateRange === option.value ? `${accentColor}40` : theme.border.primary
              }}
              className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition"
            >
              <input
                type="radio"
                name="dateRange"
                value={option.value}
                checked={dateRange === option.value}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div style={{ color: theme.text.primary }} className="font-semibold text-sm">{option.label}</div>
                <div style={{ color: theme.text.secondary }} className="text-xs">{option.desc}</div>
              </div>
            </label>
          ))}

          {dateRange === 'custom' && (
            <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB' }} className="p-4 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <label style={{ color: accentColor }} className="block text-xs font-semibold mb-2">Start Date</label>
                <ThemedDateInput
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#FFFFFF', color: theme.text.primary, borderColor: theme.border.primary }}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  max={customEndDate || new Date().toLocaleDateString('en-CA')}
                />
              </div>
              <div>
                <label style={{ color: accentColor }} className="block text-xs font-semibold mb-2">End Date</label>
                <ThemedDateInput
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#FFFFFF', color: theme.text.primary, borderColor: theme.border.primary }}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  min={customStartDate || undefined} max={new Date().toLocaleDateString('en-CA')}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onExport}
              disabled={loading}
              style={{ background: '#10B981', color: '#FFFFFF' }}
              className="flex-1 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? '⏳ Exporting...' : '📥 Export Now'}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
              className="flex-1 py-3 rounded-xl font-semibold hover:opacity-80 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

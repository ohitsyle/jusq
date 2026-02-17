// src/pages/admin/Merchant/Concerns.jsx
// Merchant-specific concerns - matches Treasury/Motorpool style with modern UI
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import SearchBar from '../../../components/shared/SearchBar';
import StatusFilter from '../../../components/shared/StatusFilter';
import DateRangeFilter from '../../../components/shared/DateRangeFilter';
import ExportButton from '../../../components/shared/ExportButton';
import { exportToCSV } from '../../../utils/csvExport';

export default function MerchantConcerns() {
  const { theme, isDarkMode } = useTheme();
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'assistance', 'feedback'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedConcern, setSelectedConcern] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalTab, setModalTab] = useState('details'); // 'details' or 'notes'
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const ITEMS_PER_PAGE = 15;
  const intervalRef = useRef(null);

  const fetchConcerns = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const data = await api.get(`/admin/user-concerns?${params}`);

      if (data?.concerns || Array.isArray(data)) {
        const allConcerns = data.concerns || data;
        // Filter to only show concerns for Merchant Office
        const merchantConcerns = allConcerns.filter(concern =>
          concern.reportTo === 'Merchant Office'
        );
        setConcerns(merchantConcerns);
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load concerns');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcerns(false);
    intervalRef.current = setInterval(() => fetchConcerns(true), 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [statusFilter, searchQuery]);

  const handleViewDetails = (concern) => {
    setSelectedConcern(concern);
    setShowDetailsModal(true);
    setModalTab('details');
  };

  const handleStatusChange = async (concern, newStatus) => {
    try {
      if (newStatus === 'resolved') {
        setSelectedConcern(concern);
        setShowDetailsModal(false);
        setShowResolveModal(true);
        return;
      }

      const adminData = JSON.parse(localStorage.getItem('merchantAdminData') || localStorage.getItem('adminData') || '{}');
      const data = await api.patch(`/admin/user-concerns/${concern.concernId || concern._id}/status`, {
        status: newStatus,
        adminName: adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'Merchant Admin'
      });

      if (data?.success) {
        toast.success('Status updated! User has been notified.');
        fetchConcerns(true);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) {
      toast.error('Please provide a resolution message');
      return;
    }

    setResolving(true);
    try {
      const adminData = JSON.parse(localStorage.getItem('merchantAdminData') || localStorage.getItem('adminData') || '{}');
      const data = await api.patch(`/admin/user-concerns/${selectedConcern.concernId || selectedConcern._id}/status`, {
        status: 'resolved',
        resolution: resolution.trim(),
        adminName: adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'Merchant Admin'
      });

      if (data?.success) {
        toast.success('Concern resolved! User has been notified via email.');
        setShowResolveModal(false);
        setResolution('');
        setSelectedConcern(null);
        fetchConcerns(true);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to resolve concern');
    } finally {
      setResolving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setSendingNote(true);
    try {
      const adminData = JSON.parse(localStorage.getItem('merchantAdminData') || localStorage.getItem('adminData') || '{}');
      const adminName = adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'Merchant Admin';
      const data = await api.post(`/admin/user-concerns/${selectedConcern.concernId || selectedConcern._id}/note`, {
        note: noteText.trim(),
        adminName
      });

      if (data?.success) {
        toast.success('Note added successfully');
        setNoteText('');
        const updatedConcern = { ...selectedConcern };
        updatedConcern.notes = updatedConcern.notes || [];
        updatedConcern.notes.push({
          message: noteText.trim(),
          adminName,
          timestamp: new Date().toISOString()
        });
        setSelectedConcern(updatedConcern);
        fetchConcerns(true);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add note');
    } finally {
      setSendingNote(false);
    }
  };

  const handleExport = () => {
    exportToCSV(filteredConcerns || [], 'merchant-concerns');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FBBF24';
      case 'in_progress': return '#3B82F6';
      case 'resolved': return '#10B981';
      default: return theme.text.secondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔄';
      case 'resolved': return '✅';
      default: return '📋';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter concerns based on active tab
  const filteredConcerns = (concerns || []).filter(concern => {
    if (activeTab === 'all') return true;
    if (activeTab === 'assistance') return concern.submissionType === 'assistance';
    if (activeTab === 'feedback') return concern.submissionType === 'feedback';
    return true;
  });

  // Pagination
  const totalPages = Math.ceil((filteredConcerns || []).length / ITEMS_PER_PAGE);
  const paginatedConcerns = (filteredConcerns || []).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
        Loading concerns...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-220px)] flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>🏪</span> Merchant Concerns
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Manage concerns reported to Merchant Office
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(251, 191, 36, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(251, 191, 36, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <span className="text-2xl">⏳</span>
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Pending</p>
            <p className="text-2xl font-bold text-yellow-500">
              {(concerns || []).filter(c => c.status === 'pending').length}
            </p>
          </div>
        </div>

        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(59, 130, 246, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(59, 130, 246, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔄</span>
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">In Progress</p>
            <p className="text-2xl font-bold text-blue-500">
              {(concerns || []).filter(c => c.status === 'in_progress').length}
            </p>
          </div>
        </div>

        <div
          style={{ background: theme.bg.card, borderColor: 'rgba(16, 185, 129, 0.3)' }}
          className="p-4 rounded-xl border flex items-center gap-4"
        >
          <div style={{ background: 'rgba(16, 185, 129, 0.2)' }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <span className="text-2xl">✅</span>
          </div>
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs font-semibold uppercase">Resolved</p>
            <p className="text-2xl font-bold text-emerald-500">
              {(concerns || []).filter(c => c.status === 'resolved').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card,
          borderColor: theme.accent.primary
        }}
        className="rounded-xl border-2 p-4 mb-5 flex flex-col lg:flex-row gap-4"
      >
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search concerns..."
            theme={theme}
            isDarkMode={isDarkMode}
          />
          <StatusFilter
            value={statusFilter}
            onChange={setStatusFilter}
            theme={theme}
            isDarkMode={isDarkMode}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' }
            ]}
          />
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </div>
        <ExportButton
          onClick={handleExport}
          disabled={!filteredConcerns || filteredConcerns.length === 0}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { value: 'all', label: 'All Concerns' },
          { value: 'assistance', label: 'Assistance' },
          { value: 'feedback', label: 'Feedback' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            style={{
              background: activeTab === tab.value ? theme.accent.primary : (isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB'),
              color: activeTab === tab.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.primary,
              borderColor: theme.border.primary
            }}
            className="px-4 py-2 rounded-lg font-semibold text-sm border hover:opacity-80 transition"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p style={{ color: theme.text.secondary }} className="text-sm">
          Showing <span style={{ color: theme.accent.primary }} className="font-bold">{(filteredConcerns || []).length}</span> concerns
        </p>
      </div>

      {/* Concerns Table */}
      <div className="flex-1">
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden">
          {!(filteredConcerns || []).length ? (
            <div style={{ color: theme.text.tertiary }} className="text-center py-20">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-semibold">No concerns found</p>
              <p className="text-sm mt-2">
                {!(concerns || []).length
                  ? "No concerns have been reported to Merchant Office"
                  : "Try adjusting your filters"
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB' }}>
                  <tr style={{ borderColor: theme.border.primary }} className="border-b">
                    <th style={{ color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">ID</th>
                    <th style={{ color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">User</th>
                    <th style={{ color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Subject</th>
                    <th style={{ color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Status</th>
                    <th style={{ color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Date</th>
                    <th style={{ color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(paginatedConcerns || []).map((concern) => (
                    <tr
                      key={concern._id}
                      style={{ borderColor: theme.border.primary }}
                      className="border-b hover:bg-white/5 transition"
                    >
                      <td style={{ color: theme.text.primary }} className="p-4">
                        <span className="font-mono text-xs">{concern.concernId || 'N/A'}</span>
                      </td>
                      <td style={{ color: theme.text.primary }} className="p-4">
                        <div>
                          <p className="font-semibold text-sm">{concern.userName || 'Unknown'}</p>
                          <p style={{ color: theme.text.secondary }} className="text-xs">{concern.userEmail || 'No email'}</p>
                        </div>
                      </td>
                      <td style={{ color: theme.text.primary }} className="p-4">
                        <p className="font-semibold text-sm">{concern.subject || 'No subject'}</p>
                        <p style={{ color: theme.text.secondary }} className="text-xs line-clamp-2">
                          {concern.feedbackText || concern.otherConcern || 'No details'}
                        </p>
                      </td>
                      <td className="p-4">
                        <span
                          style={{
                            background: `${getStatusColor(concern.status)}20`,
                            color: getStatusColor(concern.status)
                          }}
                          className="px-2 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 w-fit"
                        >
                          <span>{getStatusIcon(concern.status)}</span>
                          {concern.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ color: theme.text.secondary }} className="p-4">
                        <p className="text-xs">{formatDate(concern.createdAt || concern.submittedAt)}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetails(concern)}
                            style={{
                              background: 'rgba(59,130,246,0.1)',
                              color: '#3B82F6'
                            }}
                            className="px-3 py-1 rounded text-xs font-semibold hover:opacity-80 transition"
                          >
                            View
                          </button>
                          {concern.status !== 'resolved' && (
                            <button
                              onClick={() => handleStatusChange(concern, 'in_progress')}
                              style={{
                                background: 'rgba(251,191,36,0.1)',
                                color: '#F59E0B'
                              }}
                              className="px-3 py-1 rounded text-xs font-semibold hover:opacity-80 transition"
                            >
                              Progress
                            </button>
                          )}
                          {concern.status !== 'resolved' && (
                            <button
                              onClick={() => handleStatusChange(concern, 'resolved')}
                              style={{
                                background: 'rgba(16,185,129,0.1)',
                                color: '#10B981'
                              }}
                              className="px-3 py-1 rounded text-xs font-semibold hover:opacity-80 transition"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-5">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              background: currentPage === 1 ? 'rgba(0,0,0,0.1)' : theme.accent.primary,
              color: currentPage === 1 ? theme.text.secondary : (isDarkMode ? '#181D40' : '#FFFFFF'),
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
            className="px-3 py-1 rounded text-sm font-semibold transition"
          >
            Previous
          </button>
          <span style={{ color: theme.text.primary }} className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              background: currentPage === totalPages ? 'rgba(0,0,0,0.1)' : theme.accent.primary,
              color: currentPage === totalPages ? theme.text.secondary : (isDarkMode ? '#181D40' : '#FFFFFF'),
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
            className="px-3 py-1 rounded text-sm font-semibold transition"
          >
            Next
          </button>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedConcern && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowDetailsModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            style={{
              background: isDarkMode ? '#1E2347' : '#FFFFFF',
              borderColor: theme.border.primary
            }}
            className="relative rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: isDarkMode
                  ? `linear-gradient(135deg, ${getStatusColor(selectedConcern.status)}30 0%, ${getStatusColor(selectedConcern.status)}10 100%)`
                  : `linear-gradient(135deg, ${getStatusColor(selectedConcern.status)}20 0%, ${getStatusColor(selectedConcern.status)}10 100%)`,
                borderColor: `${getStatusColor(selectedConcern.status)}50`
              }}
              className="px-6 py-4 flex items-center justify-between border-b"
            >
              <div className="flex items-center gap-3">
                <div
                  style={{ background: `${getStatusColor(selectedConcern.status)}30` }}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                >
                  <span>{getStatusIcon(selectedConcern.status)}</span>
                </div>
                <div>
                  <h2 style={{ color: getStatusColor(selectedConcern.status) }} className="text-xl font-bold">
                    Concern Details
                  </h2>
                  <p style={{ color: theme.text.secondary }} className="text-sm">
                    {selectedConcern.concernId || 'No ID'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{ color: theme.text.secondary }}
                className="hover:opacity-70 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div style={{ padding: '0 24px', borderBottom: `2px solid ${theme.border.primary}`, display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setModalTab('details')}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `3px solid ${modalTab === 'details' ? theme.accent.primary : 'transparent'}`,
                  color: modalTab === 'details' ? theme.accent.primary : theme.text.secondary,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📋 Details
              </button>
              <button
                onClick={() => setModalTab('notes')}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `3px solid ${modalTab === 'notes' ? theme.accent.primary : 'transparent'}`,
                  color: modalTab === 'notes' ? theme.accent.primary : theme.text.secondary,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📝 Notes {selectedConcern.notes?.length > 0 && `(${selectedConcern.notes.length})`}
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px', maxHeight: '60vh' }}>
              {modalTab === 'details' ? (
                <>
                  {/* Status Badge */}
                  <div className="flex items-center gap-3 mb-5">
                    <span
                      style={{
                        background: `${getStatusColor(selectedConcern.status)}20`,
                        color: getStatusColor(selectedConcern.status)
                      }}
                      className="px-3 py-1.5 rounded-full text-sm font-bold capitalize flex items-center gap-2"
                    >
                      <span>{getStatusIcon(selectedConcern.status)}</span>
                      {selectedConcern.status?.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div
                    style={{
                      background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                      borderColor: theme.border.primary
                    }}
                    className="rounded-xl border p-4 space-y-3 mb-5"
                  >
                    <div className="flex justify-between">
                      <span style={{ color: theme.text.secondary }} className="text-sm">Submitted By</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold text-right">
                        {selectedConcern.userName || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.text.secondary }} className="text-sm">Email</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold">
                        {selectedConcern.userEmail || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.text.secondary }} className="text-sm">Subject</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold text-right max-w-[60%]">
                        {selectedConcern.subject || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.text.secondary }} className="text-sm">Submitted To</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold">
                        {selectedConcern.reportTo || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.text.secondary }} className="text-sm">Date</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold">
                        {formatDate(selectedConcern.createdAt || selectedConcern.submittedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mb-5">
                    <p style={{ color: theme.text.secondary }} className="text-sm font-semibold mb-2">Message</p>
                    <div
                      style={{
                        background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB',
                        borderColor: theme.border.primary
                      }}
                      className="rounded-xl border p-4"
                    >
                      <p style={{ color: theme.text.primary }} className="whitespace-pre-wrap">
                        {selectedConcern.feedbackText || selectedConcern.otherConcern || 'No message provided'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedConcern.status !== 'resolved' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleStatusChange(selectedConcern, 'in_progress');
                        }}
                        style={{
                          background: 'rgba(251,191,36,0.1)',
                          color: '#F59E0B'
                        }}
                        className="px-4 py-2 rounded-lg font-semibold hover:opacity-80 transition"
                      >
                        Mark as In Progress
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleStatusChange(selectedConcern, 'resolved');
                        }}
                        style={{
                          background: 'rgba(16,185,129,0.1)',
                          color: '#10B981'
                        }}
                        className="px-4 py-2 rounded-lg font-semibold hover:opacity-80 transition"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Notes Tab */
                <div>
                  {/* Add Note */}
                  <div className="mb-5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note..."
                        style={{
                          flex: 1,
                          background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB',
                          border: `2px solid ${theme.border.primary}`,
                          borderRadius: '12px',
                          color: theme.text.primary,
                          padding: '12px 16px',
                          outline: 'none'
                        }}
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={sendingNote}
                        style={{
                          background: theme.accent.primary,
                          color: isDarkMode ? '#181D40' : '#FFFFFF',
                          borderRadius: '12px',
                          padding: '12px 20px',
                          fontWeight: 600,
                          cursor: sendingNote ? 'not-allowed' : 'pointer',
                          opacity: sendingNote ? 0.6 : 1
                        }}
                      >
                        {sendingNote ? 'Adding...' : 'Add Note'}
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  {(!selectedConcern.notes || selectedConcern.notes.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.text.tertiary }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                      <p style={{ fontSize: '14px', margin: 0 }}>No notes yet</p>
                      <p style={{ fontSize: '12px', color: theme.text.muted, marginTop: '8px' }}>
                        Add notes to track progress on this concern
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedConcern.notes.slice().reverse().map((note, index) => (
                        <div
                          key={index}
                          style={{
                            background: theme.bg.tertiary,
                            borderRadius: '12px',
                            padding: '16px',
                            border: `1px solid ${theme.border.primary}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: theme.accent.primary, fontSize: '12px', fontWeight: 700 }}>
                              📨 {note.adminName || 'Admin'}
                            </span>
                            <span style={{ color: theme.text.muted, fontSize: '11px' }}>
                              {note.timestamp ? formatDate(note.timestamp) : ''}
                            </span>
                          </div>
                          <p style={{ color: theme.text.primary, margin: 0, lineHeight: '1.5' }}>
                            {note.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex justify-end border-t" style={{ borderColor: theme.border.primary }}>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB',
                  color: theme.text.primary
                }}
                className="px-6 py-2.5 rounded-xl font-semibold transition-all hover:opacity-80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedConcern && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowResolveModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            style={{
              background: isDarkMode ? '#1E2347' : '#FFFFFF',
              borderColor: theme.border.primary
            }}
            className="relative rounded-2xl shadow-2xl border w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: 'rgba(16,185,129,0.1)',
                borderColor: 'rgba(16,185,129,0.3)'
              }}
              className="px-6 py-5 flex items-center justify-between border-b"
            >
              <div className="flex items-center gap-3">
                <div style={{ background: 'rgba(16,185,129,0.2)' }} className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl">
                  ✅
                </div>
                <div>
                  <h2 style={{ color: '#10B981' }} className="text-xl font-bold">Resolve Concern</h2>
                  <p style={{ color: theme.text.secondary }} className="text-sm">
                    {selectedConcern.concernId || 'No ID'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{ color: theme.text.secondary }}
                className="hover:opacity-70 transition"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-5">
                <label style={{ color: theme.text.primary }} className="block font-semibold mb-2">
                  Resolution Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Please provide details about how this concern was resolved..."
                  rows={5}
                  style={{
                    width: '100%',
                    background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB',
                    border: `2px solid ${theme.border.primary}`,
                    borderRadius: '12px',
                    color: theme.text.primary,
                    padding: '14px 16px',
                    outline: 'none',
                    resize: 'none',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex justify-end gap-3 border-t" style={{ borderColor: theme.border.primary }}>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{
                  background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB',
                  color: theme.text.primary
                }}
                className="px-6 py-2.5 rounded-xl font-semibold transition-all hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  cursor: resolving ? 'not-allowed' : 'pointer',
                  opacity: resolving ? 0.6 : 1
                }}
                className="px-6 py-2.5 rounded-xl font-semibold transition-all"
              >
                {resolving ? 'Resolving...' : 'Resolve Concern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

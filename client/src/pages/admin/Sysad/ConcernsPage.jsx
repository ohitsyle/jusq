// src/pages/admin/Sysad/ConcernsPage.jsx
// System Admin Concerns - Shows ALL concerns/feedbacks from the NUCash system
// Matches Treasury/Motorpool style with All/Assistance/Feedback tabs and Notes system

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import SearchBar from '../../../components/shared/SearchBar';
import StatusFilter from '../../../components/shared/StatusFilter';
import DateRangeFilter from '../../../components/shared/DateRangeFilter';
import ExportButton from '../../../components/shared/ExportButton';
import { exportToCSV } from '../../../utils/csvExport';
import { X, Loader2, Send, CheckCircle, MessageCircle, FileText, Clock, AlertCircle } from 'lucide-react';

export default function SysadConcernsPage() {
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

      // Fetch ALL concerns from all departments for sysad
      const data = await api.get(`/admin/sysad/concerns?${params}`);
      if (data?.concerns) {
        setConcerns(data.concerns);
      }
    } catch (error) {
      if (!silent) toast.error('Failed to load concerns');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcerns();
    intervalRef.current = setInterval(() => fetchConcerns(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [statusFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, activeTab, startDate, endDate]);

  const handleViewDetails = async (concern) => {
    // Auto-change status to in_progress if it's pending and not feedback type
    if (concern.status === 'pending' && concern.submissionType !== 'feedback') {
      try {
        const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
        await api.patch(`/admin/sysad/concerns/${concern._id}/status`, {
          status: 'in_progress',
          adminName: adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'System Admin'
        });
        concern.status = 'in_progress';
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    }

    setSelectedConcern(concern);
    setModalTab('details');
    setNoteText('');
    setShowDetailsModal(true);
  };

  const handleOpenResolve = (concern) => {
    setResolution('');
    setShowDetailsModal(false);
    setShowResolveModal(true);
  };

  const handleSendNote = async () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note message');
      return;
    }

    setSendingNote(true);

    try {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      const adminName = adminData.firstName
        ? `${adminData.firstName} ${adminData.lastName || ''}`.trim()
        : 'System Admin';

      // Send note to backend
      const result = await api.post(
        `/admin/sysad/concerns/${selectedConcern._id}/note`,
        {
          note: noteText.trim(),
          adminName
        }
      );

      // Handle both wrapped and unwrapped responses
      const response = result?.data || result;

      if (response?.success) {
        toast.success('Note sent successfully!');
        setNoteText('');

        // Update selectedConcern with the returned data
        if (response.concern) {
          setSelectedConcern(response.concern);
          setModalTab('notes'); // Switch to notes tab
        }

        // Refresh list in background
        fetchConcerns(true);
      } else {
        toast.error(response?.message || 'Failed to send note');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to send note');
    } finally {
      setSendingNote(false);
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) {
      toast.error('Please provide a resolution message');
      return;
    }

    setResolving(true);
    try {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      const data = await api.patch(`/admin/sysad/concerns/${selectedConcern._id}/status`, {
        status: 'resolved',
        reply: resolution.trim(),
        adminName: adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'System Admin'
      });

      if (data?.success) {
        toast.success('Concern resolved! User has been notified via email.');
        setShowResolveModal(false);
        setShowDetailsModal(false);
        fetchConcerns(true);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to resolve concern');
    } finally {
      setResolving(false);
    }
  };

  const handleExport = () => {
    const dataToExport = filteredConcerns.map(c => ({
      ID: c._id?.slice(-8) || '',
      Type: c.submissionType || 'assistance',
      User: c.user?.firstName ? `${c.user.firstName} ${c.user.lastName || ''}` : c.userName || '',
      Subject: c.subject || '',
      Status: c.status || 'pending',
      Priority: c.priority || 'medium',
      Rating: c.rating || '',
      Date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
    }));
    exportToCSV(dataToExport, 'sysad_concerns');
  };

  // Filter concerns
  const filteredConcerns = concerns.filter(concern => {
    // Tab filter
    if (activeTab === 'assistance' && concern.submissionType !== 'assistance') return false;
    if (activeTab === 'feedback' && concern.submissionType !== 'feedback') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        concern._id?.toLowerCase().includes(query) ||
        concern.subject?.toLowerCase().includes(query) ||
        concern.message?.toLowerCase().includes(query) ||
        concern.user?.firstName?.toLowerCase().includes(query) ||
        concern.user?.lastName?.toLowerCase().includes(query) ||
        concern.userName?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter && concern.status !== statusFilter) return false;

    // Date range filter
    if (startDate || endDate) {
      const concernDate = new Date(concern.createdAt);
      if (startDate && concernDate < new Date(startDate)) return false;
      if (endDate && concernDate > new Date(endDate + 'T23:59:59')) return false;
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredConcerns.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredConcerns.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FBBF24';
      case 'in_progress': return '#3B82F6';
      case 'resolved': return '#10B981';
      default: return theme.text.secondary;
    }
  };

  // Aging system - matches Treasury admin style
  const calculateAging = (concern) => {
    // Only calculate aging for assistance requests that are not resolved
    if (concern.submissionType !== 'assistance' || concern.status === 'resolved') {
      return null;
    }

    const now = new Date();
    const createdDate = new Date(concern.createdAt);
    const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));

    let color = 'transparent';
    let badgeText = '';
    let badgeColor = '';

    if (ageInDays < 1) {
      color = 'transparent';
      badgeText = 'New';
      badgeColor = '#10B981';
    } else if (ageInDays >= 1 && ageInDays < 3) {
      color = 'rgba(251, 191, 36, 0.1)';
      badgeText = `${ageInDays}d old`;
      badgeColor = '#FBBF24';
    } else if (ageInDays >= 3 && ageInDays < 5) {
      color = 'rgba(249, 115, 22, 0.15)';
      badgeText = `${ageInDays}d old`;
      badgeColor = '#F97316';
    } else if (ageInDays >= 5 && ageInDays < 7) {
      color = 'rgba(234, 88, 12, 0.2)';
      badgeText = `${ageInDays}d old`;
      badgeColor = '#EA580C';
    } else {
      color = 'rgba(239, 68, 68, 0.25)';
      badgeText = `${ageInDays}d old`;
      badgeColor = '#EF4444';
    }

    return { ageInDays, backgroundColor: color, badgeText, badgeColor };
  };

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
        Loading concerns...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <div className="mb-5">
          <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
            <span>💬</span> Concerns & Feedback
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            {filteredConcerns.length > 0
              ? `Showing ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, filteredConcerns.length)} of ${filteredConcerns.length} • Page ${currentPage} of ${totalPages}`
              : `All user reports and feedbacks about the NUCash system • Total: ${concerns.length}`
            }
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {/* Pending Card */}
          <div
            style={{
              background: theme.bg.card,
              borderColor: 'rgba(251, 191, 36, 0.3)'
            }}
            className="p-4 rounded-xl border flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
          >
            <div
              style={{ background: 'rgba(251, 191, 36, 0.2)' }}
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Clock style={{ color: '#FBBF24' }} className="w-6 h-6" />
            </div>
            <div>
              <p style={{ color: theme.text.secondary }} className="text-[10px] font-semibold uppercase tracking-wide">Pending</p>
              <p style={{ color: '#FBBF24' }} className="text-2xl font-bold">
                {concerns.filter(c => c.status === 'pending' && c.submissionType !== 'feedback').length}
              </p>
            </div>
          </div>

          {/* In Progress Card */}
          <div
            style={{
              background: theme.bg.card,
              borderColor: 'rgba(59, 130, 246, 0.3)'
            }}
            className="p-4 rounded-xl border flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
          >
            <div
              style={{ background: 'rgba(59, 130, 246, 0.2)' }}
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <Loader2 style={{ color: '#3B82F6' }} className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <p style={{ color: theme.text.secondary }} className="text-[10px] font-semibold uppercase tracking-wide">In Progress</p>
              <p style={{ color: '#3B82F6' }} className="text-2xl font-bold">
                {concerns.filter(c => c.status === 'in_progress').length}
              </p>
            </div>
          </div>

          {/* Resolved Card */}
          <div
            style={{
              background: theme.bg.card,
              borderColor: 'rgba(16, 185, 129, 0.3)'
            }}
            className="p-4 rounded-xl border flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
          >
            <div
              style={{ background: 'rgba(16, 185, 129, 0.2)' }}
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <CheckCircle style={{ color: '#10B981' }} className="w-6 h-6" />
            </div>
            <div>
              <p style={{ color: theme.text.secondary }} className="text-[10px] font-semibold uppercase tracking-wide">Resolved</p>
              <p style={{ color: '#10B981' }} className="text-2xl font-bold">
                {concerns.filter(c => c.status === 'resolved').length}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'all' ? (isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)') : 'transparent',
              border: `2px solid ${activeTab === 'all' ? theme.accent.primary : (isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)')}`,
              borderRadius: '8px',
              color: activeTab === 'all' ? theme.accent.primary : theme.text.secondary,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            All ({concerns.length})
          </button>
          <button
            onClick={() => setActiveTab('assistance')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'assistance' ? 'rgba(59,130,246,0.2)' : 'transparent',
              border: `2px solid ${activeTab === 'assistance' ? '#3B82F6' : 'rgba(59,130,246,0.3)'}`,
              borderRadius: '8px',
              color: activeTab === 'assistance' ? '#3B82F6' : theme.text.secondary,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Assistance ({concerns.filter(c => c.submissionType === 'assistance' || !c.submissionType).length})
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'feedback' ? 'rgba(34,197,94,0.2)' : 'transparent',
              border: `2px solid ${activeTab === 'feedback' ? '#22C55E' : 'rgba(34,197,94,0.3)'}`,
              borderRadius: '8px',
              color: activeTab === 'feedback' ? '#22C55E' : theme.text.secondary,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Feedback ({concerns.filter(c => c.submissionType === 'feedback').length})
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex gap-3 items-end flex-wrap">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by ID, user, subject..."
          />
          {activeTab !== 'feedback' && (
            <StatusFilter
              value={statusFilter}
              onChange={setStatusFilter}
              label="Status"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' }
              ]}
            />
          )}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
          <ExportButton onClick={handleExport} disabled={filteredConcerns.length === 0} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filteredConcerns.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-20">
            <div className="text-5xl mb-4">💬</div>
            <p>No concerns found</p>
          </div>
        ) : (
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr style={{ background: isDarkMode ? 'rgba(255,212,28,0.1)' : 'rgba(59,130,246,0.1)' }}>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">ID</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">User</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Subject</th>
                  {activeTab === 'all' && (
                    <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                        className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Type</th>
                  )}
                  {activeTab === 'feedback' ? (
                    <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                        className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Rating</th>
                  ) : (
                    <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                        className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Status</th>
                  )}
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Date</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }}
                      className="text-right p-4 text-[11px] font-extrabold uppercase border-b-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((concern) => {
                  const aging = calculateAging(concern);
                  return (
                  <tr key={concern._id} style={{ borderBottom: `1px solid ${theme.border.primary}`, background: aging ? aging.backgroundColor : 'transparent' }} className="hover:bg-white/5 transition">
                    <td style={{ color: theme.text.primary }} className="p-4 font-mono text-xs">
                      {concern._id?.slice(-8)}
                      {aging && aging.badgeText && (
                        <span
                          style={{
                            background: aging.badgeColor,
                            color: '#FFFFFF',
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            marginLeft: '8px'
                          }}
                        >
                          {aging.badgeText}
                        </span>
                      )}
                    </td>
                    <td style={{ color: theme.text.primary }} className="p-4">
                      {concern.user?.firstName || concern.userName} {concern.user?.lastName || ''}
                    </td>
                    <td style={{ color: theme.text.primary }} className="p-4 max-w-[200px] truncate">
                      {concern.subject || 'No subject'}
                    </td>
                    {activeTab === 'all' && (
                      <td className="p-4">
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: concern.submissionType === 'feedback' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
                          color: concern.submissionType === 'feedback' ? '#22C55E' : '#3B82F6',
                          border: `1px solid ${concern.submissionType === 'feedback' ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        }}>
                          {concern.submissionType === 'feedback' ? 'Feedback' : 'Assistance'}
                        </span>
                      </td>
                    )}
                    {activeTab === 'feedback' ? (
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} style={{
                              fontSize: '14px',
                              color: i < (concern.rating || 0) ? '#FFD41C' : 'rgba(255,212,28,0.2)'
                            }}>
                              ★
                            </span>
                          ))}
                          <span style={{ color: theme.text.muted, marginLeft: '8px', fontSize: '11px' }}>
                            ({concern.rating || 0}/5)
                          </span>
                        </div>
                      </td>
                    ) : (
                      <td className="p-4">
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: `${getStatusColor(concern.status)}20`,
                          color: getStatusColor(concern.status),
                        }}>
                          {concern.status?.replace('_', ' ') || 'Pending'}
                        </span>
                      </td>
                    )}
                    <td style={{ color: theme.text.secondary }} className="p-4 text-sm">
                      {concern.createdAt ? new Date(concern.createdAt).toLocaleDateString() : ''}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleViewDetails(concern)}
                        style={{
                          padding: '6px 12px',
                          background: isDarkMode ? 'rgba(255,212,28,0.2)' : 'rgba(59,130,246,0.2)',
                          color: theme.accent.primary,
                          border: `1px solid ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ borderColor: theme.border.primary }} className="p-4 border-t flex items-center justify-center gap-3">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 16px',
                    background: currentPage === 1 ? 'rgba(100,100,100,0.2)' : theme.bg.tertiary,
                    color: currentPage === 1 ? theme.text.muted : theme.accent.primary,
                    border: `2px solid ${currentPage === 1 ? 'transparent' : theme.accent.primary}`,
                    borderRadius: '8px',
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
                    background: currentPage === totalPages ? 'rgba(100,100,100,0.2)' : theme.bg.tertiary,
                    color: currentPage === totalPages ? theme.text.muted : theme.accent.primary,
                    border: `2px solid ${currentPage === totalPages ? 'transparent' : theme.accent.primary}`,
                    borderRadius: '8px',
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

      {/* Details Modal */}
      {showDetailsModal && selectedConcern && (
        <DetailsModal
          concern={selectedConcern}
          theme={theme}
          isDarkMode={isDarkMode}
          modalTab={modalTab}
          setModalTab={setModalTab}
          noteText={noteText}
          setNoteText={setNoteText}
          sendingNote={sendingNote}
          onSendNote={handleSendNote}
          onOpenResolve={handleOpenResolve}
          onClose={() => { setShowDetailsModal(false); setSelectedConcern(null); }}
          getStatusColor={getStatusColor}
        />
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedConcern && (
        <ResolveModal
          concern={selectedConcern}
          theme={theme}
          isDarkMode={isDarkMode}
          resolution={resolution}
          setResolution={setResolution}
          resolving={resolving}
          onResolve={handleResolve}
          onClose={() => setShowResolveModal(false)}
        />
      )}
    </div>
  );
}

// Details Modal Component - Matches Treasury style with Details/Notes tabs
function DetailsModal({ concern, theme, isDarkMode, modalTab, setModalTab, noteText, setNoteText, sendingNote, onSendNote, onOpenResolve, onClose, getStatusColor }) {
  const isFeedback = concern.submissionType === 'feedback';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(255,212,28,0.3) 0%, rgba(255,212,28,0.1) 100%)' : 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 100%)' }}
             className="px-6 py-5 flex items-center justify-between">
          <div>
            <h3 style={{ color: theme.accent.primary }} className="text-xl font-bold">
              {isFeedback ? 'Feedback Details' : 'Concern Details'}
            </h3>
            <p style={{ color: theme.text.secondary }} className="text-sm mt-1">
              ID: {concern._id?.slice(-8)}
            </p>
          </div>
          <button onClick={onClose} style={{ color: theme.text.secondary }} className="hover:opacity-70 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs (only for assistance, not feedback) */}
        {!isFeedback && (
          <div className="flex gap-2 px-6 pt-4">
            <button
              onClick={() => setModalTab('details')}
              style={{
                padding: '8px 16px',
                background: modalTab === 'details' ? theme.accent.primary : 'transparent',
                color: modalTab === 'details' ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText className="w-4 h-4" />
              Details
            </button>
            <button
              onClick={() => setModalTab('notes')}
              style={{
                padding: '8px 16px',
                background: modalTab === 'notes' ? theme.accent.primary : 'transparent',
                color: modalTab === 'notes' ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MessageCircle className="w-4 h-4" />
              Notes ({concern.notes?.length || 0})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
          {(modalTab === 'details' || isFeedback) ? (
            <>
              {/* User Info */}
              <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }}
                   className="p-4 rounded-xl border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-1">User</p>
                    <p style={{ color: theme.text.primary }} className="font-semibold">
                      {concern.user?.firstName || concern.userName} {concern.user?.lastName || ''}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-1">Email</p>
                    <p style={{ color: theme.text.primary }}>{concern.user?.email || concern.userEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-1">Date Submitted</p>
                    <p style={{ color: theme.text.primary }}>
                      {concern.createdAt ? new Date(concern.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-1">
                      {isFeedback ? 'Rating' : 'Status'}
                    </p>
                    {isFeedback ? (
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} style={{ color: i < (concern.rating || 0) ? '#FFD41C' : theme.text.muted }}>★</span>
                        ))}
                        <span style={{ color: theme.text.muted, marginLeft: '4px' }}>({concern.rating || 0}/5)</span>
                      </div>
                    ) : (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: `${getStatusColor(concern.status)}20`,
                        color: getStatusColor(concern.status)
                      }}>
                        {concern.status?.replace('_', ' ') || 'Pending'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-2">Subject</p>
                <p style={{ color: theme.text.primary }} className="font-semibold">{concern.subject || 'No subject'}</p>
              </div>

              {/* Message */}
              <div>
                <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-2">Message</p>
                <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }}
                     className="p-4 rounded-xl border">
                  <p style={{ color: theme.text.primary }} className="whitespace-pre-wrap">
                    {concern.message || concern.feedbackText || 'No message provided'}
                  </p>
                </div>
              </div>

              {/* Resolution (if resolved) */}
              {concern.status === 'resolved' && concern.adminResponse && (
                <div>
                  <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-2">Resolution</p>
                  <div style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }}
                       className="p-4 rounded-xl border">
                    <p style={{ color: '#10B981' }} className="whitespace-pre-wrap font-semibold">
                      {concern.adminResponse}
                    </p>
                    {concern.resolvedBy && (
                      <p style={{ color: theme.text.muted }} className="text-xs mt-2">
                        Resolved by {concern.resolvedBy} on {concern.resolvedDate ? new Date(concern.resolvedDate).toLocaleString() : 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Notes Tab */
            <div className="space-y-4">
              {/* Notes History */}
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {concern.notes && concern.notes.length > 0 ? (
                  [...concern.notes].reverse().map((note, idx) => (
                    <div key={idx} style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', borderColor: theme.border.primary }}
                         className="p-3 rounded-xl border">
                      <div className="flex justify-between items-start mb-2">
                        <span style={{ color: theme.accent.primary }} className="font-semibold text-sm">{note.adminName || 'Admin'}</span>
                        <span style={{ color: theme.text.muted }} className="text-xs">
                          {note.timestamp ? new Date(note.timestamp).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <p style={{ color: theme.text.primary }} className="text-sm">{note.message}</p>
                    </div>
                  ))
                ) : (
                  <div style={{ color: theme.text.tertiary }} className="text-center py-8">
                    <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No notes yet</p>
                  </div>
                )}
              </div>

              {/* Add Note Input */}
              {concern.status !== 'resolved' && (
                <div>
                  <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-2">Add Note</p>
                  <div className="flex gap-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type your note..."
                      rows={2}
                      style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
                      className="flex-1 px-4 py-3 rounded-xl border text-sm focus:outline-none resize-none"
                    />
                    <button
                      onClick={onSendNote}
                      disabled={sendingNote || !noteText.trim()}
                      style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFFFFF' }}
                      className="px-4 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center"
                    >
                      {sendingNote ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderColor: theme.border.primary }} className="px-6 py-4 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
            className="px-6 py-2.5 rounded-xl font-semibold transition hover:opacity-80"
          >
            Close
          </button>
          {!isFeedback && concern.status !== 'resolved' && (
            <button
              onClick={onOpenResolve}
              style={{ background: '#10B981', color: '#FFFFFF' }}
              className="px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition hover:opacity-90"
            >
              <CheckCircle className="w-4 h-4" />
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Resolve Modal Component
function ResolveModal({ concern, theme, isDarkMode, resolution, setResolution, resolving, onResolve, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
             className="px-6 py-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Resolve Concern</h3>
            <p className="text-sm text-white/80 mt-1">ID: {concern._id?.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p style={{ color: theme.text.secondary }} className="text-xs uppercase font-semibold mb-2">Resolution Message *</p>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Explain how this concern was resolved..."
              rows={5}
              style={{ background: isDarkMode ? 'rgba(15,18,39,0.5)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }}
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none resize-none"
            />
            <p style={{ color: theme.text.muted }} className="text-xs mt-2">
              This message will be sent to the user via email.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderColor: theme.border.primary }} className="px-6 py-4 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
            className="px-6 py-2.5 rounded-xl font-semibold transition hover:opacity-80"
          >
            Cancel
          </button>
          <button
            onClick={onResolve}
            disabled={resolving || !resolution.trim()}
            style={{ background: '#10B981', color: '#FFFFFF' }}
            className="px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50"
          >
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {resolving ? 'Resolving...' : 'Resolve & Notify User'}
          </button>
        </div>
      </div>
    </div>
  );
}

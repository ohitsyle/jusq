// src/pages/admin/Treasury/ConcernsPage.jsx
// Treasury-specific concerns - matches Motorpool style with All/Assistance/Feedback tabs
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Search, Download } from 'lucide-react';
import { exportToCSV } from '../../../utils/csvExport';

export default function ConcernsPage() {
  const { theme, isDarkMode } = useTheme();
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
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
  const [modalTab, setModalTab] = useState('details');
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
      const data = await api.get(`/admin/treasury/concerns?${params}`);
      if (data?.concerns) setConcerns(data.concerns);
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
  }, [statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, activeTab, startDate, endDate]);

  const handleViewDetails = async (concern) => {
    if (concern.status === 'pending' && concern.submissionType !== 'feedback') {
      try {
        const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
        await api.patch(`/admin/treasury/concerns/${concern._id}/status`, {
          status: 'in_progress',
          adminName: adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'Treasury Admin'
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

  const handleOpenResolve = () => {
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
      const adminName = adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'Treasury Admin';
      const result = await api.post(`/admin/treasury/concerns/${selectedConcern._id}/note`, {
        note: noteText.trim(),
        adminName
      });
      const response = result?.data || result;
      if (response?.success) {
        toast.success('Note sent successfully!');
        setNoteText('');
        if (response.concern) {
          setSelectedConcern(response.concern);
          setModalTab('notes');
        }
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
      const data = await api.patch(`/admin/treasury/concerns/${selectedConcern._id}/status`, {
        status: 'resolved',
        reply: resolution.trim(),
        adminName: adminData.firstName ? `${adminData.firstName} ${adminData.lastName || ''}`.trim() : 'Treasury Admin'
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
    exportToCSV(dataToExport, 'treasury_concerns');
  };

  const filteredConcerns = concerns.filter(concern => {
    if (activeTab === 'assistance' && concern.submissionType !== 'assistance') return false;
    if (activeTab === 'feedback' && concern.submissionType !== 'feedback') return false;
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
    if (statusFilter && concern.status !== statusFilter) return false;
    if (startDate || endDate) {
      const concernDate = new Date(concern.createdAt);
      if (startDate && concernDate < new Date(startDate)) return false;
      if (endDate && concernDate > new Date(endDate + 'T23:59:59')) return false;
    }
    return true;
  });

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

  const calculateAging = (concern) => {
    if (concern.submissionType !== 'assistance' || concern.status === 'resolved') return null;
    const now = new Date();
    const createdDate = new Date(concern.createdAt);
    const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    let color = 'transparent', badgeText = '', badgeColor = '';
    if (ageInDays < 1) {
      badgeText = 'New';
      badgeColor = '#10B981';
    } else if (ageInDays < 3) {
      color = 'rgba(251, 191, 36, 0.1)';
      badgeText = `${ageInDays}d old`;
      badgeColor = '#FBBF24';
    } else if (ageInDays < 5) {
      color = 'rgba(249, 115, 22, 0.15)';
      badgeText = `${ageInDays}d old`;
      badgeColor = '#F97316';
    } else if (ageInDays < 7) {
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
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5">
        <div className="mb-5">
          <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
            <span>💬</span> Concerns & Feedback
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            {filteredConcerns.length > 0
              ? `Showing ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, filteredConcerns.length)} of ${filteredConcerns.length} • Page ${currentPage} of ${totalPages}`
              : `Manage user concerns and feedback • Total: ${concerns.length}`
            }
          </p>
        </div>

        <div className="flex gap-2 mb-5">
          <button onClick={() => setActiveTab('all')} style={{ padding: '10px 20px', background: activeTab === 'all' ? 'rgba(255,212,28,0.2)' : 'transparent', border: `2px solid ${activeTab === 'all' ? theme.accent.primary : 'rgba(255,212,28,0.3)'}`, borderRadius: '8px', color: activeTab === 'all' ? theme.accent.primary : theme.text.secondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            All ({concerns.length})
          </button>
          <button onClick={() => setActiveTab('assistance')} style={{ padding: '10px 20px', background: activeTab === 'assistance' ? 'rgba(59,130,246,0.2)' : 'transparent', border: `2px solid ${activeTab === 'assistance' ? '#3B82F6' : 'rgba(59,130,246,0.3)'}`, borderRadius: '8px', color: activeTab === 'assistance' ? '#3B82F6' : theme.text.secondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            🆘 Assistance ({concerns.filter(c => c.submissionType === 'assistance' || !c.submissionType).length})
          </button>
          <button onClick={() => setActiveTab('feedback')} style={{ padding: '10px 20px', background: activeTab === 'feedback' ? 'rgba(34,197,94,0.2)' : 'transparent', border: `2px solid ${activeTab === 'feedback' ? '#22C55E' : 'rgba(34,197,94,0.3)'}`, borderRadius: '8px', color: activeTab === 'feedback' ? '#22C55E' : theme.text.secondary, fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            💬 Feedback ({concerns.filter(c => c.submissionType === 'feedback').length})
          </button>
        </div>

        {/* Actions Bar - Updated to match inspiration */}
        <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card, borderColor: theme.accent.primary }} className="rounded-xl border-2 p-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
                <input type="text" placeholder="Search by ID, user, subject..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50" />
              </div>

              {/* Status Filter - Segmented Control */}
              {activeTab !== 'feedback' && (
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}>
                  {[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }].map((option) => (
                    <button key={option.value} onClick={() => { setStatusFilter(option.value); setCurrentPage(1); }} style={{ background: statusFilter === option.value ? theme.accent.primary : 'transparent', color: statusFilter === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary }} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80">
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Date Range */}
              <div className="flex gap-2 items-center">
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="px-3 py-1.5 rounded-xl border text-xs focus:outline-none" />
                <span style={{ color: theme.text.tertiary }} className="text-xs">to</span>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="px-3 py-1.5 rounded-xl border text-xs focus:outline-none" />
              </div>

              {/* Export Button */}
              <button onClick={handleExport} disabled={filteredConcerns.length === 0} style={{ background: filteredConcerns.length === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)', color: filteredConcerns.length === 0 ? 'rgba(16,185,129,0.5)' : '#10B981', borderColor: filteredConcerns.length === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.3)' }} className="px-4 py-2 rounded-xl font-semibold text-sm border flex items-center gap-2 hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

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
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">ID</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">User</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Subject</th>
                  {activeTab === 'all' && (
                    <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Type</th>
                  )}
                  {activeTab === 'feedback' ? (
                    <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Rating</th>
                  ) : (
                    <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Status</th>
                  )}
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-left p-4 text-[11px] font-extrabold uppercase border-b-2">Date</th>
                  <th style={{ borderColor: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)', color: theme.accent.primary }} className="text-right p-4 text-[11px] font-extrabold uppercase border-b-2">Actions</th>
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
                          <span style={{ background: aging.badgeColor, color: '#FFFFFF', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                            {aging.badgeText}
                          </span>
                        )}
                      </td>
                      <td style={{ color: theme.text.primary }} className="p-4">{concern.user?.firstName} {concern.user?.lastName}</td>
                      <td style={{ color: theme.text.primary }} className="p-4 max-w-[200px] truncate">{concern.subject || 'No subject'}</td>
                      {activeTab === 'all' && (
                        <td className="p-4">
                          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: concern.submissionType === 'feedback' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)', color: concern.submissionType === 'feedback' ? '#22C55E' : '#3B82F6', border: `1px solid ${concern.submissionType === 'feedback' ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
                            {concern.submissionType === 'feedback' ? '💬 Feedback' : '🆘 Assistance'}
                          </span>
                        </td>
                      )}
                      {activeTab === 'feedback' ? (
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} style={{ fontSize: '14px', color: i < (concern.rating || 0) ? '#FFD41C' : 'rgba(255,212,28,0.2)' }}>⭐</span>
                            ))}
                            <span style={{ color: theme.text.muted, marginLeft: '8px', fontSize: '11px' }}>({concern.rating || 0}/5)</span>
                          </div>
                        </td>
                      ) : (
                        <td className="p-4">
                          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: `${getStatusColor(concern.status)}20`, color: getStatusColor(concern.status) }}>
                            {concern.status?.replace('_', ' ') || 'Pending'}
                          </span>
                        </td>
                      )}
                      <td style={{ color: theme.text.secondary }} className="p-4 text-sm">{concern.createdAt ? new Date(concern.createdAt).toLocaleDateString() : ''}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleViewDetails(concern)} style={{ padding: '6px 12px', background: 'rgba(59,130,246,0.2)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ borderColor: theme.border.primary }} className="p-4 border-t flex items-center justify-center gap-3">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', background: currentPage === 1 ? 'rgba(100,100,100,0.2)' : theme.bg.tertiary, color: currentPage === 1 ? theme.text.muted : theme.accent.primary, border: `2px solid ${currentPage === 1 ? 'transparent' : theme.accent.primary}`, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                  ← Previous
                </button>
                <span style={{ color: theme.text.secondary, fontSize: '13px', fontWeight: 600 }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 16px', background: currentPage === totalPages ? 'rgba(100,100,100,0.2)' : theme.bg.tertiary, color: currentPage === totalPages ? theme.text.muted : theme.accent.primary, border: `2px solid ${currentPage === totalPages ? 'transparent' : theme.accent.primary}`, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details Modal with Tabs */}
      {showDetailsModal && selectedConcern && (
        <div
          onClick={() => setShowDetailsModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(15,18,39,0.9)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDarkMode ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)' : '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              border: `2px solid ${theme.border.primary}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: `2px solid ${theme.border.primary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: `${getStatusColor(selectedConcern.status)}20`,
                  color: getStatusColor(selectedConcern.status),
                  marginBottom: '8px'
                }}>
                  {selectedConcern.status?.replace('_', ' ') || 'Pending'}
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: theme.text.primary, margin: 0 }}>
                  {selectedConcern.subject || 'No Subject'}
                </h2>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  background: 'rgba(239,68,68,0.2)',
                  border: 'none',
                  color: '#EF4444',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ×
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
                📝 Notes History {selectedConcern.notes?.length > 0 && `(${selectedConcern.notes.length})`}
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
              {modalTab === 'details' ? (
                <>
                  {/* User Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: theme.accent.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', color: theme.accent.secondary }}>
                      {selectedConcern.user?.firstName?.[0] || '?'}
                    </div>
                    <div>
                      <p style={{ color: theme.text.primary, fontWeight: 600, margin: 0 }}>
                        {selectedConcern.user?.firstName} {selectedConcern.user?.lastName}
                      </p>
                      <p style={{ color: theme.text.secondary, fontSize: '13px', margin: 0 }}>
                        {selectedConcern.user?.email}
                      </p>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <p style={{ color: theme.text.muted, fontSize: '12px', margin: 0 }}>
                        {selectedConcern.createdAt ? new Date(selectedConcern.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>

                  {/* Message */}
                  <div style={{ background: theme.bg.tertiary, borderRadius: '12px', padding: '16px', marginBottom: '20px', border: `1px solid ${theme.border.primary}` }}>
                    <p style={{ color: theme.text.primary, whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.6' }}>
                      {selectedConcern.message || selectedConcern.description || 'No message provided'}
                    </p>
                  </div>

                  {/* Rating if feedback */}
                  {selectedConcern.submissionType === 'feedback' && selectedConcern.rating && (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ color: theme.text.secondary, fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>Rating</p>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} style={{ fontSize: '24px', color: i < selectedConcern.rating ? '#FFD41C' : 'rgba(255,212,28,0.2)' }}>
                            ⭐
                          </span>
                        ))}
                        <span style={{ color: theme.text.secondary, marginLeft: '8px' }}>
                          ({selectedConcern.rating}/5)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Resolution if exists */}
                  {selectedConcern.status === 'resolved' && selectedConcern.adminResponse && (
                    <div style={{ background: 'rgba(16,185,129,0.1)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <p style={{ color: '#10B981', fontSize: '12px', marginBottom: '8px', fontWeight: 700 }}>✓ Resolution</p>
                      <p style={{ color: theme.text.primary, margin: 0 }}>
                        {selectedConcern.adminResponse}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* Notes History Tab */
                <div>
                  {(!selectedConcern.notes || selectedConcern.notes.length === 0) && selectedConcern.status !== 'resolved' ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.text.tertiary }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                      <p style={{ fontSize: '14px', margin: 0 }}>No notes sent yet</p>
                      <p style={{ fontSize: '12px', color: theme.text.muted, marginTop: '8px' }}>
                        Use the note field below to send updates to the user
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Show notes in reverse order (newest first) */}
                      {selectedConcern.notes?.slice().reverse().map((note, index) => (
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
                              📨 {note.adminName || 'Treasury Admin'}
                            </span>
                            <span style={{ color: theme.text.muted, fontSize: '11px' }}>
                              {note.timestamp ? new Date(note.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                          <p style={{ color: theme.text.primary, margin: 0, lineHeight: '1.5' }}>
                            {note.message}
                          </p>
                        </div>
                      ))}

                      {/* Show resolution as final entry if resolved */}
                      {selectedConcern.status === 'resolved' && selectedConcern.adminResponse && (
                        <div
                          style={{
                            background: 'rgba(16,185,129,0.1)',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '2px solid rgba(16,185,129,0.3)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 700 }}>
                              ✓ RESOLVED by {selectedConcern.resolvedBy || 'Treasury Admin'}
                            </span>
                            <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 600 }}>
                              {selectedConcern.resolvedAt ? new Date(selectedConcern.resolvedAt).toLocaleString() : ''}
                            </span>
                          </div>
                          <p style={{ color: theme.text.primary, margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
                            {selectedConcern.adminResponse}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Note Input & Actions */}
            {selectedConcern.status === 'in_progress' && selectedConcern.submissionType !== 'feedback' && (
              <div style={{ borderTop: `2px solid ${theme.border.primary}`, padding: '20px 24px' }}>
                {/* Note Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: theme.text.primary, fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                    💬 Send Note to User
                  </label>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Type your message here... The user will receive this via email."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `2px solid ${theme.border.primary}`,
                      background: theme.bg.tertiary,
                      color: theme.text.primary,
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleSendNote}
                    disabled={sendingNote || !noteText.trim()}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      background: sendingNote || !noteText.trim() ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)',
                      color: sendingNote || !noteText.trim() ? 'rgba(59,130,246,0.5)' : '#3B82F6',
                      border: `2px solid ${sendingNote || !noteText.trim() ? 'rgba(59,130,246,0.3)' : '#3B82F6'}`,
                      borderRadius: '8px',
                      cursor: sendingNote || !noteText.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 700,
                      opacity: sendingNote || !noteText.trim() ? 0.6 : 1
                    }}
                  >
                    {sendingNote ? '⏳ Sending...' : '📨 Send Note'}
                  </button>
                  <button
                    onClick={() => handleOpenResolve(selectedConcern)}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      background: '#10B981',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(16,185,129,0.4)'
                    }}
                  >
                    ✓ Resolve Concern
                  </button>
                </div>
              </div>
            )}

            {/* Show resolve button for pending concerns */}
            {selectedConcern.status === 'pending' && selectedConcern.submissionType !== 'feedback' && (
              <div style={{ borderTop: `2px solid ${theme.border.primary}`, padding: '20px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleOpenResolve(selectedConcern)}
                  style={{
                    padding: '12px 24px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(16,185,129,0.4)'
                  }}
                >
                  ✓ Resolve Concern
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedConcern && (
        <div
          onClick={() => setShowResolveModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(15,18,39,0.9)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDarkMode ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)' : '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '90%',
              border: `2px solid ${theme.border.primary}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: `2px solid rgba(16,185,129,0.3)`, background: 'rgba(16,185,129,0.1)', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#10B981', margin: 0, marginBottom: '8px' }}>
                    Resolve Concern
                  </h2>
                  <p style={{ fontSize: '13px', color: theme.text.secondary, margin: 0 }}>
                    Mark this concern as resolved and notify the user
                  </p>
                </div>
                <button
                  onClick={() => setShowResolveModal(false)}
                  style={{
                    background: 'rgba(239,68,68,0.2)',
                    border: 'none',
                    color: '#EF4444',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '18px'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Concern Info */}
              <div style={{ background: theme.bg.tertiary, borderRadius: '12px', padding: '16px', marginBottom: '20px', border: `1px solid ${theme.border.primary}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: theme.text.secondary, fontSize: '12px' }}>From</span>
                  <span style={{ color: theme.text.primary, fontSize: '14px', fontWeight: 600 }}>
                    {selectedConcern.user?.firstName} {selectedConcern.user?.lastName}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: theme.text.secondary, fontSize: '12px' }}>Subject</span>
                  <span style={{ color: theme.text.primary, fontSize: '14px', fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>
                    {selectedConcern.subject}
                  </span>
                </div>
              </div>

              {/* Resolution Input */}
              <div>
                <label style={{ color: theme.text.primary, fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Resolution Message <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <p style={{ color: theme.text.secondary, fontSize: '13px', marginBottom: '12px' }}>
                  This final message will be sent to the user via email and mark the concern as resolved.
                </p>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Enter your resolution response..."
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `2px solid ${theme.border.primary}`,
                    background: theme.bg.tertiary,
                    color: theme.text.primary,
                    fontSize: '14px',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 24px', borderTop: `2px solid ${theme.border.primary}`, display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowResolveModal(false)}
                disabled={resolving}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: theme.bg.tertiary,
                  color: theme.text.primary,
                  border: `1px solid ${theme.border.primary}`,
                  borderRadius: '8px',
                  cursor: resolving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: resolving ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || !resolution.trim()}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: resolving || !resolution.trim() ? 'rgba(16,185,129,0.3)' : '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: resolving || !resolution.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 700,
                  opacity: resolving || !resolution.trim() ? 0.6 : 1,
                  boxShadow: resolving || !resolution.trim() ? 'none' : '0 4px 12px rgba(16,185,129,0.4)'
                }}
              >
                {resolving ? '⏳ Resolving...' : '✓ Resolve & Notify User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
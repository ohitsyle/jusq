// src/pages/admin/Accounting/Transfers.jsx
// Accounting: every Send Money transfer between students/employees — who sent
// how much to whom, with totals for the chosen dates. Read-only. Clicking a
// school ID narrows the list to that person's transfers (sent and received).
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ArrowLeftRight, ArrowRight, Search, Download, Users, Wallet, Hash, UserCheck, Inbox, X } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { exportToCSV } from '../../../utils/csvExport';
import { ThemedDateInput } from '../../../components/shared/ThemedControls';

const ITEMS_PER_PAGE = 20;
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtSchoolId = (id) => (/^\d{10}$/.test(id || '') ? `${id.slice(0, 4)}-${id.slice(4)}` : id || '—');
const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const roleLabel = (r) => (r === 'employee' ? 'Employee' : r === 'student' ? 'Student' : '');

export default function Transfers() {
  const { theme, isDarkMode } = useTheme();
  const [transfers, setTransfers] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0, senders: 0, receivers: 0 });
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const latestRequest = useRef(0);

  const baseColor = isDarkMode ? '255, 212, 28' : '59, 130, 246';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  // Wait for a pause in typing before searching
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const query = (extra = {}) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    Object.entries(extra).forEach(([k, v]) => params.append(k, v));
    return params.toString();
  };

  const load = async (silent = false) => {
    const id = ++latestRequest.current;
    if (!silent) setLoading(true);
    try {
      const data = await api.get(`/admin/accounting/transfers?${query()}`);
      if (id !== latestRequest.current) return; // a newer search already answered
      setTransfers(data?.transfers || []);
      setSummary(data?.summary || { count: 0, total: 0, senders: 0, receivers: 0 });
      setTruncated(!!data?.truncated);
    } catch {
      if (!silent) toast.error('Failed to load transfers');
    } finally {
      if (!silent && id === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    load();
    const interval = setInterval(() => { if (!document.hidden) load(true); }, 30000);
    return () => clearInterval(interval);
  }, [search, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.get(`/admin/accounting/transfers?${query({ export: '1' })}`);
      const rows = (data?.transfers || []).map((t) => ({
        'Date': fmtDate(t.createdAt),
        'Time': fmtTime(t.createdAt),
        'Reference No.': t.referenceNo,
        'Sender': t.from.name,
        'Sender School ID': fmtSchoolId(t.from.schoolUId),
        'Receiver': t.to.name,
        'Receiver School ID': fmtSchoolId(t.to.schoolUId),
        'Amount (PHP)': Number(t.amount).toFixed(2),
        'Status': t.status
      }));
      const admin = JSON.parse(localStorage.getItem('adminData') || '{}');
      exportToCSV(rows, 'send_money_transfers', {
        title: 'Send Money Transfers',
        adminName: [admin.firstName, admin.lastName].filter(Boolean).join(' '),
        department: 'Accounting',
        dateRange: startDate || endDate ? `${startDate || 'start'} to ${endDate || today}` : 'All time'
      });
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const showPerson = (schoolUId) => { setSearchInput(schoolUId); setSearch(schoolUId); };

  const totalPages = Math.max(1, Math.ceil(transfers.length / ITEMS_PER_PAGE));
  const pageRows = transfers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const inputStyle = { background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary };

  const cards = [
    { label: 'Transfers', value: summary.count.toLocaleString(), Icon: Hash },
    { label: 'Total sent', value: peso(summary.total), Icon: Wallet },
    { label: 'People who sent', value: summary.senders.toLocaleString(), Icon: Users },
    { label: 'People who received', value: summary.receivers.toLocaleString(), Icon: UserCheck }
  ];

  const Person = ({ p }) => (
    <div className="text-left min-w-0">
      <div style={{ color: theme.text.primary }} className="font-semibold truncate">{p.name}</div>
      <button
        onClick={() => showPerson(p.schoolUId)}
        title="Show only this person's transfers"
        style={{ color: theme.text.tertiary }}
        className="font-mono text-[11px] hover:underline"
      >
        {fmtSchoolId(p.schoolUId)}{roleLabel(p.role) ? ` · ${roleLabel(p.role)}` : ''}
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 border-b-2 pb-5" style={{ borderColor: `rgba(${baseColor}, 0.2)` }}>
        <div className="mb-5">
          <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
            <ArrowLeftRight className="w-5 h-5" /> Send Money
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            Money students and employees send each other • Refreshes every 30s
          </p>
        </div>

        {/* Summary for the current filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {cards.map(({ label, value, Icon }) => (
            <div key={label} style={{ background: theme.bg.card, borderColor: `rgba(${baseColor}, 0.2)` }} className="rounded-xl border p-4">
              <div style={{ color: theme.text.secondary }} className="text-xs font-semibold flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5" /> {label}
              </div>
              <div style={{ color: theme.text.primary }} className="text-xl font-extrabold">{loading ? '…' : value}</div>
            </div>
          ))}
        </div>

        {/* Actions bar */}
        <div style={{ background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card, borderColor: theme.accent.primary }} className="rounded-xl border-2 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px] max-w-[380px]">
              <Search style={{ color: theme.text.tertiary }} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
              <input
                type="text"
                placeholder="Search name, school ID or reference no."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={inputStyle}
                className="w-full pl-10 pr-9 py-2 rounded-xl border text-sm focus:outline-none transition-all focus:ring-2 focus:ring-opacity-50"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setSearch(''); }} aria-label="Clear search"
                  style={{ color: theme.text.tertiary }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <ThemedDateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle}
                className="h-[38px] px-3 rounded-xl border text-[13px] focus:outline-none" max={endDate || today} />
              <span style={{ color: theme.text.tertiary }} className="text-xs">to</span>
              <ThemedDateInput value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle}
                className="h-[38px] px-3 rounded-xl border text-[13px] focus:outline-none" min={startDate || undefined} max={today} />
            </div>

            <button
              onClick={handleExport}
              disabled={exporting || summary.count === 0}
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', borderColor: 'rgba(16,185,129,0.3)' }}
              className="px-4 py-2 rounded-xl font-semibold text-sm border flex items-center gap-2 hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div style={{ color: theme.accent.primary }} className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
            Loading transfers...
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ color: theme.text.tertiary }} className="text-center py-20">
            <Inbox className="w-12 h-12 mx-auto mb-4 opacity-60" />
            <p>{search || startDate || endDate ? 'No transfers match these filters' : 'No transfers yet'}</p>
          </div>
        ) : (
          <div
            style={{
              background: theme.bg.card,
              border: `1px solid rgba(${baseColor}, 0.2)`,
              borderRadius: '12px',
              boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(59,130,246,0.1)'
            }}
            className="overflow-hidden flex flex-col"
          >
            <div className="overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr style={{ background: `rgba(${baseColor}, 0.1)` }}>
                    {['Date', 'From', '', 'To', 'Amount', 'Reference No.'].map((h, i) => (
                      <th key={i} style={{
                        textAlign: h === 'From' || h === 'To' ? 'left' : 'center', padding: '12px 16px', fontSize: '11px', fontWeight: 800,
                        color: theme.accent.primary, textTransform: 'uppercase', borderBottom: `2px solid rgba(${baseColor}, 0.3)`
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => (
                    <tr key={t.referenceNo} style={{ borderBottom: `1px solid ${theme.border.primary}` }}>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: theme.text.primary, whiteSpace: 'nowrap' }}>
                        <div>{fmtDate(t.createdAt)}</div>
                        <div style={{ color: theme.text.tertiary, fontSize: '11px' }}>{fmtTime(t.createdAt)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 220 }}><Person p={t.from} /></td>
                      <td style={{ padding: '12px 4px', color: theme.text.tertiary }}><ArrowRight className="w-4 h-4" /></td>
                      <td style={{ padding: '12px 16px', maxWidth: 220 }}><Person p={t.to} /></td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: theme.text.primary, whiteSpace: 'nowrap' }}>{peso(t.amount)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', color: theme.text.secondary }}>{t.referenceNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4" style={{ background: theme.bg.secondary, borderTop: `1px solid rgba(${baseColor}, 0.2)` }}>
              <div style={{ color: theme.text.secondary, fontSize: '13px' }}>
                {truncated
                  ? `Showing the latest ${transfers.length.toLocaleString()} of ${summary.count.toLocaleString()} — pick dates to see older ones`
                  : `Page ${page} of ${totalPages} (${transfers.length.toLocaleString()} total)`}
              </div>
              {totalPages > 1 && (
                <div className="flex gap-3">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ color: page === 1 ? theme.text.tertiary : theme.text.secondary }}
                    className="px-5 py-2 rounded-md text-[13px] font-medium disabled:cursor-not-allowed">← Previous</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ background: page === totalPages ? 'transparent' : theme.accent.primary, color: page === totalPages ? theme.text.tertiary : (isDarkMode ? '#000000' : '#FFFFFF') }}
                    className="px-5 py-2 rounded-md text-[13px] font-semibold disabled:cursor-not-allowed">Next →</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// src/pages/admin/Sysad/SystemAlerts.jsx
// Sysad: create and manage system-wide alerts shown to end-users.
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Bell, Plus, Trash2, X, Loader2, Eye, EyeOff, Info, AlertTriangle, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';
import { confirmDialog } from '../../../components/shared/ConfirmDialogHost';
import ModalShell from '../../../components/shared/ModalShell';

const SEVERITIES = [
  { value: 'info', label: 'Info', color: '#3B82F6', Icon: Info },
  { value: 'success', label: 'Success', color: '#22C55E', Icon: CheckCircle2 },
  { value: 'warning', label: 'Warning', color: '#F59E0B', Icon: AlertTriangle },
  { value: 'critical', label: 'Critical', color: '#EF4444', Icon: AlertOctagon },
];
const sevMeta = (s) => SEVERITIES.find((x) => x.value === s) || SEVERITIES[0];

// Auto-hide choices; value = hours (0 = never expires)
const EXPIRY_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
];

export default function SystemAlerts() {
  const { theme, isDarkMode } = useTheme();
  const accent = theme.accent.primary;
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', severity: 'info', active: true, expiryHours: 0 });

  const load = async () => {
    try {
      const data = await api.get('/system-alerts');
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message are required'); return; }
    setSaving(true);
    try {
      const { expiryHours, ...body } = form;
      await api.post('/system-alerts', {
        ...body,
        expiresAt: expiryHours > 0 ? new Date(Date.now() + expiryHours * 3600 * 1000).toISOString() : null,
      });
      toast.success('Alert posted');
      setShowModal(false);
      setForm({ title: '', message: '', severity: 'info', active: true, expiryHours: 0 });
      load();
    } catch (e) { toast.error('Failed to post alert'); } finally { setSaving(false); }
  };

  const toggleActive = async (a) => {
    try { await api.put(`/system-alerts/${a._id}`, { active: !a.active }); load(); }
    catch (e) { toast.error('Failed to update alert'); }
  };

  const remove = async (a) => {
    if (!(await confirmDialog(`Delete alert "${a.title}"?`, { title: 'Delete Alert', confirmText: 'Delete', type: 'danger' }))) return;
    try { await api.delete(`/system-alerts/${a._id}`); toast.success('Alert deleted'); load(); }
    catch (e) { toast.error('Failed to delete alert'); }
  };

  const now = new Date();
  const isExpired = (a) => a.expiresAt && new Date(a.expiresAt) <= now;
  const visibleCount = alerts.filter((a) => a.active && !isExpired(a)).length;
  const hiddenCount = alerts.filter((a) => !a.active).length;
  const expiredCount = alerts.filter((a) => isExpired(a)).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header (standard sysad tab pattern) */}
      <div style={{ borderColor: theme.border.primary }} className="mb-6 border-b-2 pb-5 flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 style={{ color: accent }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
            <Bell className="w-5 h-5" /> System Alerts
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
            Post announcements and alerts shown to all end-users • {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: accent, color: isDarkMode ? '#181D40' : '#FFFFFF' }} className="py-3 px-6 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-2 shadow-lg border-none hover:opacity-90 transition">
          <Plus className="w-5 h-5" /> New Alert
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <AlertMetric icon={Bell} label="Total Alerts" value={alerts.length} color="#3B82F6" theme={theme} />
        <AlertMetric icon={Eye} label="Visible to Users" value={visibleCount} color="#10B981" theme={theme} />
        <AlertMetric icon={EyeOff} label="Hidden" value={hiddenCount} color="#6B7280" theme={theme} />
        <AlertMetric icon={Clock} label="Expired" value={expiredCount} color="#F59E0B" theme={theme} />
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto pr-2">
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} /></div>
      ) : alerts.length === 0 ? (
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-12 rounded-2xl border text-center">
          <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: theme.text.tertiary }} />
          <p style={{ color: theme.text.secondary }}>No alerts yet. Post one to notify end-users.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const m = sevMeta(a.severity);
            return (
              <div key={a._id} style={{ background: theme.bg.card, borderColor: a.active ? `${m.color}55` : theme.border.primary }} className="p-5 rounded-2xl border-2 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div style={{ background: `${m.color}22` }} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                    <m.Icon className="w-5 h-5" style={{ color: m.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 style={{ color: theme.text.primary }} className="font-bold">{a.title}</h3>
                      <span style={{ background: `${m.color}22`, color: m.color }} className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{m.label}</span>
                      {!a.active && <span style={{ background: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }} className="text-[10px] font-bold px-2 py-0.5 rounded-full">HIDDEN</span>}
                      {a.expiresAt && new Date(a.expiresAt) <= new Date() && (
                        <span style={{ background: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }} className="text-[10px] font-bold px-2 py-0.5 rounded-full">EXPIRED</span>
                      )}
                    </div>
                    <p style={{ color: theme.text.secondary }} className="text-sm">{a.message}</p>
                    <p style={{ color: theme.text.tertiary }} className="text-xs mt-2">
                      {new Date(a.createdAt).toLocaleString()}
                      {a.expiresAt && new Date(a.expiresAt) > new Date() && (
                        <span> • auto-hides {new Date(a.expiresAt).toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(a)} title={a.active ? 'Hide' : 'Show'} style={{ borderColor: theme.border.primary, color: theme.text.secondary }} className="p-2 rounded-lg border hover:opacity-80">
                    {a.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => remove(a)} title="Delete" style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444' }} className="p-2 rounded-lg border hover:opacity-80">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>{/* end scrollable list */}

      {showModal && (
        <ModalShell title="New System Alert" icon={Bell} onClose={() => !saving && setShowModal(false)}>
            <label style={{ color: theme.text.tertiary }} className="block text-xs font-bold uppercase mb-1">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="w-full p-3 rounded-xl border text-sm mb-4 outline-none" placeholder="e.g. Scheduled maintenance" />

            <label style={{ color: theme.text.tertiary }} className="block text-xs font-bold uppercase mb-1">Message</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} style={{ background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="w-full p-3 rounded-xl border text-sm mb-4 outline-none resize-none" placeholder="What do you want students to know?" />

            <label style={{ color: theme.text.tertiary }} className="block text-xs font-bold uppercase mb-2">Auto-hide After</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {EXPIRY_OPTIONS.map((o) => {
                const active = form.expiryHours === o.value;
                return (
                  <button key={o.value} onClick={() => setForm({ ...form, expiryHours: o.value })}
                    style={{
                      borderColor: active ? accent : theme.border.primary,
                      background: active ? `${accent}1A` : 'transparent',
                      color: active ? accent : theme.text.secondary
                    }}
                    className="py-2 rounded-xl border-2 text-xs font-bold transition">
                    {o.label}
                  </button>
                );
              })}
            </div>

            <label style={{ color: theme.text.tertiary }} className="block text-xs font-bold uppercase mb-2">Severity</label>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {SEVERITIES.map((s) => {
                const active = form.severity === s.value;
                return (
                  <button key={s.value} onClick={() => setForm({ ...form, severity: s.value })} style={{ borderColor: active ? s.color : theme.border.primary, background: active ? `${s.color}1A` : 'transparent' }} className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition">
                    <s.Icon className="w-5 h-5" style={{ color: s.color }} />
                    <span style={{ color: active ? s.color : theme.text.secondary }} className="text-xs font-bold">{s.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} disabled={saving} style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }} className="flex-1 py-3 rounded-xl font-semibold hover:opacity-80 transition disabled:opacity-50">Cancel</button>
              <button onClick={create} disabled={saving} style={{ background: accent, color: isDarkMode ? '#181D40' : '#FFFFFF' }} className="flex-1 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Post Alert
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  );
}

// Metric card matching the Manage Users summary row
function AlertMetric({ icon: Icon, label, value, color, theme }) {
  return (
    <div style={{ background: theme.bg.card, borderColor: `${color}25` }} className="p-4 rounded-xl border flex items-center gap-3">
      <div style={{ background: `${color}20`, color }} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p style={{ color: theme.text.secondary }} className="text-[11px] font-bold uppercase m-0">{label}</p>
        <p style={{ color }} className="text-lg font-bold m-0">{value}</p>
      </div>
    </div>
  );
}

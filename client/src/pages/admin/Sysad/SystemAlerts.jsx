// src/pages/admin/Sysad/SystemAlerts.jsx
// Sysad: create and manage system-wide alerts shown to end-users.
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Bell, Plus, Trash2, X, Loader2, Eye, EyeOff, Info, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { confirmDialog } from '../../../components/shared/ConfirmDialogHost';

const SEVERITIES = [
  { value: 'info', label: 'Info', color: '#3B82F6', Icon: Info },
  { value: 'success', label: 'Success', color: '#22C55E', Icon: CheckCircle2 },
  { value: 'warning', label: 'Warning', color: '#F59E0B', Icon: AlertTriangle },
  { value: 'critical', label: 'Critical', color: '#EF4444', Icon: AlertOctagon },
];
const sevMeta = (s) => SEVERITIES.find((x) => x.value === s) || SEVERITIES[0];

export default function SystemAlerts() {
  const { theme, isDarkMode } = useTheme();
  const accent = theme.accent.primary;
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', severity: 'info', active: true });

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
      await api.post('/system-alerts', form);
      toast.success('Alert posted');
      setShowModal(false);
      setForm({ title: '', message: '', severity: 'info', active: true });
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ color: theme.text.primary }} className="text-2xl font-bold">System Alerts</h1>
          <p style={{ color: theme.text.secondary }} className="text-sm">Post announcements and alerts shown to all end-users.</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: accent, color: isDarkMode ? '#181D40' : '#FFFFFF' }} className="px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition">
          <Plus className="w-5 h-5" /> New Alert
        </button>
      </div>

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
                    </div>
                    <p style={{ color: theme.text.secondary }} className="text-sm">{a.message}</p>
                    <p style={{ color: theme.text.tertiary }} className="text-xs mt-2">{new Date(a.createdAt).toLocaleString()}</p>
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

      {showModal && (
        <div onClick={() => !saving && setShowModal(false)} className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: isDarkMode ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)' : theme.bg.card, border: `2px solid ${accent}` }} className="w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: theme.text.primary }} className="text-xl font-bold">New System Alert</h3>
              <button onClick={() => setShowModal(false)} style={{ color: theme.text.secondary }}><X className="w-5 h-5" /></button>
            </div>

            <label style={{ color: theme.text.tertiary }} className="block text-xs font-bold uppercase mb-1">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="w-full p-3 rounded-xl border text-sm mb-4 outline-none" placeholder="e.g. Scheduled maintenance" />

            <label style={{ color: theme.text.tertiary }} className="block text-xs font-bold uppercase mb-1">Message</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} style={{ background: isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB', color: theme.text.primary, borderColor: theme.border.primary }} className="w-full p-3 rounded-xl border text-sm mb-4 outline-none resize-none" placeholder="What do you want students to know?" />

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
          </div>
        </div>
      )}
    </div>
  );
}

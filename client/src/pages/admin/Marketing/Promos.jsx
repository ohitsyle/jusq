// src/pages/admin/Marketing/Promos.jsx
// Marketing: manage promotion/loyalty campaigns + toggle the end-user promo tab.
// Styled to match the other admin dashboards.
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Plus, Trash2, Eye, EyeOff, Megaphone } from 'lucide-react';

const REWARD_TYPES = [
  { value: 'free_ride', label: 'Free Ride' },
  { value: 'discount', label: 'Discount' },
  { value: 'credit', label: 'Credit' },
];
const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Promos() {
  const { theme, isDarkMode } = useTheme();
  const accent = theme.accent.primary;
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoTabEnabled, setPromoTabEnabled] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', rewardType: 'free_ride', minimumRides: 10, frequency: 'monthly' });

  const load = async () => {
    try {
      const data = await api.get('/admin/promotions/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.get('/admin/promotions/tab-setting').then((d) => setPromoTabEnabled(d?.enabled ?? true)).catch(() => {});
  }, []);

  const toggleTab = async () => {
    const next = !promoTabEnabled;
    setPromoTabEnabled(next);
    try {
      await api.put('/admin/promotions/tab-setting', { enabled: next });
      toast.success(`End-user promotions tab ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setPromoTabEnabled(!next);
      toast.error('Failed to update tab setting');
    }
  };

  const createCampaign = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error('Title and description are required'); return; }
    setSaving(true);
    try {
      await api.post('/admin/promotions/campaigns', form);
      toast.success('Campaign created');
      setIsModalOpen(false);
      setForm({ title: '', description: '', rewardType: 'free_ride', minimumRides: 10, frequency: 'monthly' });
      load();
    } catch (e) {
      toast.error('Failed to create campaign');
    } finally { setSaving(false); }
  };

  const toggleActive = async (c) => {
    try { await api.put(`/admin/promotions/campaigns/${c._id}`, { active: !c.active }); load(); }
    catch (e) { toast.error('Failed to update campaign'); }
  };

  const removeCampaign = async (c) => {
    if (!window.confirm(`Delete campaign "${c.title}"?`)) return;
    try { await api.delete(`/admin/promotions/campaigns/${c._id}`); toast.success('Campaign deleted'); load(); }
    catch (e) { toast.error('Failed to delete campaign'); }
  };

  if (loading) {
    return (
      <div style={{ color: accent }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${accent} transparent transparent transparent` }} />
        Loading campaigns...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 style={{ color: theme.text.primary }} className="text-2xl font-bold m-0 mb-2">Promotions</h2>
          <p style={{ color: theme.text.secondary }} className="text-sm m-0">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} • {campaigns.filter((c) => c.active).length} active
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{ background: accent, color: isDarkMode ? '#181D40' : '#FFF' }}
          className="py-3 px-6 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-2 shadow-lg border-none"
        >
          <Plus className="w-5 h-5" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* End-user promo tab toggle */}
      <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border p-5 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ background: `${accent}20` }} className="w-11 h-11 rounded-full flex items-center justify-center">
            <Megaphone className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div>
            <div style={{ color: theme.text.primary }} className="font-bold text-sm">End-User Promotions Tab</div>
            <div style={{ color: theme.text.secondary }} className="text-xs mt-0.5">When on, students see a Promotions tab with active promos and their progress.</div>
          </div>
        </div>
        <button onClick={toggleTab} style={{ background: promoTabEnabled ? '#10B981' : '#6B7280', width: '52px', height: '28px', borderRadius: '14px', position: 'relative', transition: 'all 0.2s ease', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '2px', left: promoTabEnabled ? '26px' : '2px', width: '24px', height: '24px', borderRadius: '12px', background: '#FFFFFF', transition: 'all 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
        </button>
      </div>

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border p-12 text-center">
          <div className="text-[40px] opacity-30 mb-2">🎁</div>
          <p style={{ color: theme.text.secondary }} className="text-sm">No campaigns yet. Create your first promo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {campaigns.map((c) => (
            <div key={c._id} style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-6 rounded-2xl border relative overflow-hidden">
              <div className="absolute right-4 top-4 text-[40px] opacity-15">🎁</div>
              <div className="flex items-center gap-2 mb-2">
                <h3 style={{ color: theme.text.primary }} className="font-bold text-lg m-0">{c.title}</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-xl" style={{ color: c.active ? '#10B981' : '#9CA3AF', background: c.active ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)' }}>
                  {c.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p style={{ color: theme.text.secondary }} className="text-sm mb-4 pr-10">{c.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  REWARD_TYPES.find((r) => r.value === c.rewardType)?.label || c.rewardType,
                  `Min ${c.minimumRides} rides`,
                  c.frequency,
                  `${c.rewardsSent || 0} sent`
                ].map((chip, i) => (
                  <span key={i} className="text-xs font-semibold py-[3px] px-[10px] rounded-xl" style={{ color: accent, background: `${accent}20` }}>{chip}</span>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => toggleActive(c)} style={{ background: `${accent}15`, borderColor: theme.border.primary, color: accent }} className="py-2.5 px-4 border-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 hover:opacity-80">
                  {c.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {c.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => removeCampaign(c)} style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444' }} className="py-2.5 px-4 border-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 hover:opacity-80">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal (admin style) */}
      {isModalOpen && (
        <div onClick={() => !saving && setIsModalOpen(false)} className="fixed inset-0 flex items-center justify-center z-[9999]" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: isDarkMode ? 'linear-gradient(135deg, #1a1f3a 0%, #0f1227 100%)' : theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border p-8 w-[90%] max-w-[600px] max-h-[90vh] overflow-auto shadow-2xl">
            <h3 style={{ color: theme.text.primary }} className="text-xl font-bold m-0 mb-6">New Campaign</h3>

            <div className="grid gap-4">
              <Field label="Title" required theme={theme} isDarkMode={isDarkMode}>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Frequent Rider Reward" style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border" />
              </Field>
              <Field label="Description" required theme={theme} isDarkMode={isDarkMode}>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the promo for students" style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border resize-none" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Reward Type" theme={theme} isDarkMode={isDarkMode}>
                  <select value={form.rewardType} onChange={(e) => setForm({ ...form, rewardType: e.target.value })} style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border">
                    {REWARD_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
                <Field label="Frequency" theme={theme} isDarkMode={isDarkMode}>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border">
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Minimum Rides" theme={theme} isDarkMode={isDarkMode}>
                <input type="number" min={1} value={form.minimumRides} onChange={(e) => setForm({ ...form, minimumRides: parseInt(e.target.value, 10) || 1 })} style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border" />
              </Field>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setIsModalOpen(false)} disabled={saving} style={{ background: `${accent}15`, borderColor: theme.border.primary, color: accent }} className="py-3 px-6 border-2 rounded-lg text-sm font-semibold cursor-pointer">Cancel</button>
              <button onClick={createCampaign} disabled={saving} style={{ background: saving ? '#999' : accent, color: isDarkMode ? '#181D40' : '#FFF', opacity: saving ? 0.6 : 1 }} className="py-3 px-6 border-none rounded-lg text-sm font-bold cursor-pointer shadow-lg">
                {saving ? 'Saving...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = (theme, isDarkMode) => ({
  background: isDarkMode ? 'rgba(251,251,251,0.05)' : 'rgba(0,0,0,0.03)',
  borderColor: theme.border.primary,
  color: theme.text.primary
});

function Field({ label, required, theme, children }) {
  return (
    <div>
      <label style={{ color: theme.accent.primary }} className="block mb-2 text-xs font-bold uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

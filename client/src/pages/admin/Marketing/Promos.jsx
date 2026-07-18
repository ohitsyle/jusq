// src/pages/admin/Marketing/Promos.jsx
// Marketing: manage promotion/loyalty campaigns + toggle the end-user promo tab.
// Mirrors the system admin design language (Merchants-style cards, Sysad-style toggle).
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { toast } from 'react-toastify';
import { Plus, Megaphone, Power, Loader2, Gift, Repeat, Send, Bus } from 'lucide-react';
import { ThemedSelect } from '../../../components/shared/ThemedControls';
import { confirmDialog } from '../../../components/shared/ConfirmDialogHost';
import ModalShell from '../../../components/shared/ModalShell';

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
// Per-reward-type config for the dynamic value field in the create modal.
const REWARD_VALUE_META = {
  free_ride: { label: 'Number of Free Rides', hint: 'How many free shuttle rides the student receives', min: 1, max: 20, default: 1 },
  discount:  { label: 'Discount Percentage (%)', hint: 'Percent off the student\'s next ride fare', min: 1, max: 100, default: 10 },
  credit:    { label: 'Credit Amount (₱)', hint: 'Pesos credited straight to the student\'s NUCash balance', min: 1, max: 5000, default: 50 },
};
// Badge text for campaign cards, e.g. "Free Ride ×2" / "15% Off" / "₱50 Credit"
const rewardChip = (c) => {
  const v = c.rewardValue ?? 1;
  if (c.rewardType === 'discount') return `${v}% Off`;
  if (c.rewardType === 'credit') return `₱${v} Credit`;
  return v > 1 ? `Free Rides ×${v}` : 'Free Ride';
};

export default function Promos() {
  const { theme, isDarkMode } = useTheme();
  const accent = theme.accent.primary;
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [promoTabEnabled, setPromoTabEnabled] = useState(true);
  const [togglingTab, setTogglingTab] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // campaign being edited, null = creating
  const EMPTY_FORM = { title: '', description: '', rewardType: 'free_ride', rewardValue: 1, minimumRides: 10, frequency: 'monthly' };
  const [form, setForm] = useState(EMPTY_FORM);

  // Send-rewards flow
  const [rewardTarget, setRewardTarget] = useState(null); // campaign being sent
  const [eligible, setEligible] = useState(null);         // null = loading
  const [sendingRewards, setSendingRewards] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/admin/promotions/campaigns');
      const list = Array.isArray(data) ? data : [];
      // Active campaigns first, deactivated last; newest first within each group.
      list.sort((a, b) => (b.active === true) - (a.active === true) || new Date(b.createdAt) - new Date(a.createdAt));
      setCampaigns(list);
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.get('/admin/promotions/tab-setting').then((d) => setPromoTabEnabled(d?.enabled ?? true)).catch(() => {});
  }, []);

  const toggleTab = async () => {
    const next = !promoTabEnabled;
    setTogglingTab(true);
    try {
      await api.put('/admin/promotions/tab-setting', { enabled: next });
      setPromoTabEnabled(next);
      toast.success(`End-user promotions tab ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error('Failed to update tab setting');
    } finally { setTogglingTab(false); }
  };

  const closeModal = () => { setIsModalOpen(false); setEditTarget(null); setForm(EMPTY_FORM); };

  const openEdit = (c) => {
    setEditTarget(c);
    setForm({
      title: c.title || '',
      description: c.description || '',
      rewardType: c.rewardType || 'free_ride',
      rewardValue: c.rewardValue ?? (REWARD_VALUE_META[c.rewardType]?.default ?? 1),
      minimumRides: c.minimumRides || 1,
      frequency: c.frequency || 'monthly',
    });
    setIsModalOpen(true);
  };

  const saveCampaign = async () => {
    if (!form.title.trim() || !form.description.trim()) { toast.error('Title and description are required'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        // rewardType is locked after creation; the server ignores it anyway
        const { rewardType, ...updates } = form;
        await api.put(`/admin/promotions/campaigns/${editTarget._id}`, updates);
        toast.success('Campaign updated');
      } else {
        await api.post('/admin/promotions/campaigns', form);
        toast.success('Campaign created');
      }
      closeModal();
      load();
    } catch (e) {
      toast.error(editTarget ? 'Failed to update campaign' : 'Failed to create campaign');
    } finally { setSaving(false); }
  };

  const toggleActive = async (c) => {
    try { await api.put(`/admin/promotions/campaigns/${c._id}`, { active: !c.active }); load(); }
    catch (e) { toast.error('Failed to update campaign'); }
  };

  const removeCampaign = async (c) => {
    if (!(await confirmDialog(`Delete campaign "${c.title}"? This cannot be undone.`, { title: 'Delete Campaign', confirmText: 'Delete', type: 'danger' }))) return;
    try { await api.delete(`/admin/promotions/campaigns/${c._id}`); toast.success('Campaign deleted'); load(); }
    catch (e) { toast.error('Failed to delete campaign'); }
  };

  const openRewards = async (c) => {
    setRewardTarget(c);
    setEligible(null);
    try {
      // campaignId gives the server the frequency window + duplicate-send state
      const users = await api.get(`/admin/promotions/eligible-users?campaignId=${c._id}`);
      setEligible(Array.isArray(users) ? users : []);
    } catch (e) {
      setEligible([]);
    }
  };

  const sendRewards = async () => {
    if (!rewardTarget) return;
    setSendingRewards(true);
    try {
      const res = await api.post(`/admin/promotions/campaigns/${rewardTarget._id}/send-rewards`);
      const sent = res?.sent ?? 0;
      toast.success(`Sent ${sent} reward email${sent !== 1 ? 's' : ''}!${res?.skipped ? ` (${res.skipped} already rewarded this period)` : ''}`);
      setRewardTarget(null);
      load();
    } catch (e) {
      toast.error(e?.error || 'Failed to send rewards');
    } finally {
      setSendingRewards(false);
    }
  };

  // Human label for a campaign's eligibility window
  const periodLabel = (frequency) =>
    frequency === 'weekly' ? 'this week' : frequency === 'biweekly' ? 'this fortnight' : 'this month';

  const filtered = campaigns.filter((c) =>
    !searchQuery ||
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ color: accent }} className="text-center py-[60px]">
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
          <h2 style={{ color: theme.text.primary }} className="text-2xl font-bold m-0 mb-2">
            Promotional Campaigns
          </h2>
          <p style={{ color: theme.text.secondary }} className="text-sm m-0">
            {filtered.length} campaign{filtered.length !== 1 ? 's' : ''} • {campaigns.filter((c) => c.active).length} active
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setForm(EMPTY_FORM); setIsModalOpen(true); }}
          style={{ background: accent, color: isDarkMode ? '#181D40' : '#FFF' }}
          className="py-3 px-6 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-2 shadow-lg border-none"
        >
          <Plus className="w-5 h-5" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* End-user promo tab toggle (Sysad maintenance-card pattern) */}
      <div
        style={{ background: theme.bg.card, borderColor: promoTabEnabled ? 'rgba(16,185,129,0.5)' : theme.border.primary }}
        className="p-6 rounded-2xl border-2 mb-5"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div
              style={{ background: promoTabEnabled ? 'rgba(16,185,129,0.2)' : `${accent}20` }}
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Megaphone className="w-6 h-6" style={{ color: promoTabEnabled ? '#10B981' : accent }} />
            </div>
            <div className="flex-1">
              <h3 style={{ color: theme.text.primary }} className="font-bold text-lg mb-1">End-User Promotions Tab</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm mb-0">
                When enabled, students see a Promotions tab on their portal with active promos and their ride progress.
              </p>
            </div>
          </div>
          <button
            onClick={toggleTab}
            disabled={togglingTab}
            style={{ background: promoTabEnabled ? '#EF4444' : '#10B981', color: '#FFFFFF' }}
            className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition disabled:opacity-50 flex-shrink-0 ml-4"
          >
            {togglingTab ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
            {promoTabEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border-2 p-4 mb-5" style={{ background: isDarkMode ? 'rgba(15,18,39,0.8)' : theme.bg.card, borderColor: accent }}>
        <input
          type="text"
          placeholder="🔍 Search campaigns by title or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB',
            borderColor: theme.border.primary,
            color: theme.text.primary
          }}
          className="w-full max-w-[320px] py-2.5 px-4 border rounded-xl text-sm outline-none"
        />
      </div>

      {/* Campaign Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        {filtered.length > 0 ? (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
            {filtered.map((c) => (
              <CampaignCard key={c._id} campaign={c} onToggle={toggleActive} onDelete={removeCampaign} onSendRewards={openRewards} onEdit={openEdit} theme={theme} isDarkMode={isDarkMode} />
            ))}
          </div>
        ) : (
          <div style={{ background: theme.bg.card, borderColor: theme.border.primary, color: theme.text.tertiary }}
            className="rounded-2xl border-2 p-16 text-center">
            <div className="text-6xl mb-4">🎁</div>
            <p className="m-0 text-base">
              {searchQuery ? 'No campaigns found matching your search' : 'No campaigns yet. Create your first promo!'}
            </p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal (shared ModalShell chrome) */}
      {isModalOpen && (
        <ModalShell
          title={editTarget ? 'Edit Campaign' : 'New Campaign'}
          icon={Gift}
          onClose={() => !saving && closeModal()}
          maxWidth="max-w-[600px]"
        >
            <div className="grid gap-4">
              <Field label="Title" required theme={theme}>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Frequent Rider Reward"
                  style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border" />
              </Field>
              <Field label="Description" required theme={theme}>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the promo for students"
                  style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border resize-none" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Reward Type" theme={theme}>
                  <ThemedSelect value={form.rewardType} disabled={!!editTarget}
                    onChange={(e) => setForm({ ...form, rewardType: e.target.value, rewardValue: REWARD_VALUE_META[e.target.value]?.default ?? 1 })}
                    style={{ ...inputStyle(theme, isDarkMode), opacity: editTarget ? 0.6 : 1 }} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border">
                    {REWARD_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </ThemedSelect>
                  {editTarget && (
                    <p style={{ color: theme.text.tertiary }} className="text-[11px] m-0 mt-1.5">
                      Reward type can't be changed after creation
                    </p>
                  )}
                </Field>
                <Field label="Frequency" theme={theme}>
                  <ThemedSelect value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border">
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </ThemedSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={REWARD_VALUE_META[form.rewardType]?.label || 'Reward Value'} theme={theme}>
                  <input type="number"
                    min={REWARD_VALUE_META[form.rewardType]?.min ?? 1}
                    max={REWARD_VALUE_META[form.rewardType]?.max}
                    value={form.rewardValue}
                    onChange={(e) => {
                      const meta = REWARD_VALUE_META[form.rewardType] || { min: 1 };
                      let v = parseInt(e.target.value, 10) || meta.min;
                      if (meta.max) v = Math.min(v, meta.max);
                      setForm({ ...form, rewardValue: Math.max(meta.min, v) });
                    }}
                    style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border" />
                  <p style={{ color: theme.text.tertiary }} className="text-[11px] m-0 mt-1.5">
                    {REWARD_VALUE_META[form.rewardType]?.hint}
                  </p>
                </Field>
                <Field label="Minimum Rides" theme={theme}>
                  <input type="number" min={1} value={form.minimumRides} onChange={(e) => setForm({ ...form, minimumRides: parseInt(e.target.value, 10) || 1 })}
                    style={inputStyle(theme, isDarkMode)} className="w-full py-3 px-4 border-2 rounded-lg text-sm outline-none box-border" />
                  <p style={{ color: theme.text.tertiary }} className="text-[11px] m-0 mt-1.5">
                    Rides a student must complete to qualify
                  </p>
                </Field>
              </div>
              {/* Live preview of what students will earn */}
              <div style={{ background: `${accent}12`, borderColor: `${accent}40` }} className="rounded-xl border p-3.5">
                <p style={{ color: theme.text.primary }} className="text-[13px] m-0">
                  <Gift className="w-4 h-4 inline-block mr-1.5 -mt-0.5" style={{ color: accent }} />
                  Students who complete <b>{form.minimumRides} ride{form.minimumRides !== 1 ? 's' : ''}</b> get{' '}
                  <b style={{ color: accent }}>
                    {form.rewardType === 'free_ride' ? `${form.rewardValue} free ride${form.rewardValue !== 1 ? 's' : ''}`
                      : form.rewardType === 'discount' ? `${form.rewardValue}% off their next ride`
                      : `₱${form.rewardValue} NUCash credit`}
                  </b>
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={closeModal} disabled={saving}
                style={{ background: `${accent}15`, borderColor: theme.border.primary, color: accent }}
                className="py-3 px-6 border-2 rounded-lg text-sm font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={saveCampaign} disabled={saving}
                style={{ background: saving ? '#999' : accent, color: isDarkMode ? '#181D40' : '#FFF', opacity: saving ? 0.6 : 1 }}
                className="py-3 px-6 border-none rounded-lg text-sm font-bold cursor-pointer shadow-lg">
                {saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
        </ModalShell>
      )}

      {/* Send Rewards Modal (shared ModalShell chrome) */}
      {rewardTarget && (
        <ModalShell
          title="Send Rewards"
          icon={Send}
          onClose={() => !sendingRewards && setRewardTarget(null)}
          maxWidth="max-w-[560px]"
        >
            <p style={{ color: theme.text.secondary }} className="text-sm m-0 mb-5">
              Campaign: <span style={{ color: accent }} className="font-bold">{rewardTarget.title}</span> • minimum {rewardTarget.minimumRides} ride{rewardTarget.minimumRides !== 1 ? 's' : ''} {periodLabel(rewardTarget.frequency)}
            </p>

            {eligible === null ? (
              <div style={{ color: accent }} className="text-center py-8">
                <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" />
                <p style={{ color: theme.text.secondary }} className="text-sm">Finding eligible riders…</p>
              </div>
            ) : eligible.length === 0 ? (
              <div style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }} className="rounded-xl border p-4 mb-5">
                <p style={{ color: '#F59E0B' }} className="text-sm font-semibold m-0">
                  No students have reached {rewardTarget.minimumRides} rides {periodLabel(rewardTarget.frequency)} yet. Try again later or lower the campaign's minimum.
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const fresh = eligible.filter((u) => !u.alreadyRewarded).length;
                  const done = eligible.length - fresh;
                  return (
                    <div style={{ background: `${accent}12`, borderColor: `${accent}40` }} className="rounded-xl border p-4 mb-4">
                      <p style={{ color: theme.text.primary }} className="text-sm font-bold m-0">
                        {fresh} rider{fresh !== 1 ? 's' : ''} will receive the reward email immediately.
                        {done > 0 && <span style={{ color: theme.text.secondary }} className="font-semibold"> {done} already rewarded {periodLabel(rewardTarget.frequency)} and will be skipped.</span>}
                      </p>
                    </div>
                  );
                })()}
                <div className="mb-5 max-h-[200px] overflow-y-auto rounded-xl border" style={{ borderColor: theme.border.primary }}>
                  {eligible.map((u) => (
                    <div key={u._id} className="flex justify-between items-center gap-3 px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: theme.border.primary, opacity: u.alreadyRewarded ? 0.55 : 1 }}>
                      <div>
                        <div style={{ color: theme.text.primary }} className="text-sm font-semibold">{u.fullName}</div>
                        <div style={{ color: theme.text.tertiary }} className="text-xs">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.alreadyRewarded && (
                          <span className="text-[10px] font-bold py-1 px-2 rounded-lg whitespace-nowrap" style={{ color: '#10B981', background: 'rgba(16,185,129,0.15)' }}>
                            ✓ Rewarded
                          </span>
                        )}
                        <span className="text-xs font-bold py-1 px-2.5 rounded-xl whitespace-nowrap" style={{ color: accent, background: `${accent}20` }}>
                          {u.ridesThisMonth} rides
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setRewardTarget(null)} disabled={sendingRewards}
                style={{ background: `${accent}15`, borderColor: theme.border.primary, color: accent }}
                className="py-3 px-6 border-2 rounded-lg text-sm font-semibold cursor-pointer">
                Cancel
              </button>
              <button onClick={sendRewards} disabled={sendingRewards || !eligible || eligible.filter((u) => !u.alreadyRewarded).length === 0}
                style={{ background: sendingRewards ? '#999' : accent, color: isDarkMode ? '#181D40' : '#FFF', opacity: (!eligible || eligible.filter((u) => !u.alreadyRewarded).length === 0) ? 0.5 : 1 }}
                className="py-3 px-6 border-none rounded-lg text-sm font-bold cursor-pointer shadow-lg">
                {sendingRewards ? 'Sending…' : `Send to ${eligible?.filter((u) => !u.alreadyRewarded).length ?? 0} rider${(eligible?.filter((u) => !u.alreadyRewarded).length ?? 0) !== 1 ? 's' : ''}`}
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  );
}

// Campaign card — mirrors MerchantCard structure (badge chip, status dot, info rows, bordered actions)
function CampaignCard({ campaign: c, onToggle, onDelete, onSendRewards, onEdit, theme, isDarkMode }) {
  const isActive = c.active !== false;
  const rewardLabel = rewardChip(c);

  return (
    <div
      style={{ background: theme.bg.card, borderColor: theme.border.primary, opacity: isActive ? 1 : 0.7 }}
      className="rounded-2xl border-2 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl flex flex-col"
    >
      {/* Header with reward badge + status dot */}
      <div className="flex justify-between items-start mb-4">
        <div style={{ background: `${theme.accent.primary}20`, borderColor: theme.border.primary, color: theme.accent.primary }}
          className="py-1.5 px-3.5 border rounded-lg text-xs font-bold">
          {rewardLabel}
        </div>
        <div className="w-3 h-3 rounded-full" style={{
          background: isActive ? '#10B981' : '#EF4444',
          boxShadow: `0 0 0 3px ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
        }} />
      </div>

      {/* Title + description */}
      <h3 style={{ color: theme.text.primary }} className="text-xl font-bold m-0 mb-2">{c.title}</h3>
      <p style={{ color: theme.text.secondary }} className="text-[13px] m-0 mb-4 line-clamp-2">{c.description}</p>

      {/* Info rows */}
      <div className="flex flex-col gap-2 mb-4">
        <div style={{ color: theme.text.secondary }} className="text-[13px] flex items-center gap-2">
          <Bus className="w-5 h-5" />
          <span>Minimum {c.minimumRides} ride{c.minimumRides !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ color: theme.text.secondary }} className="text-[13px] flex items-center gap-2">
          <Repeat className="w-5 h-5" />
          <span className="capitalize">{c.frequency}</span>
        </div>
        <div style={{ color: theme.text.secondary }} className="text-[13px] flex items-center gap-2">
          <Send className="w-5 h-5" />
          <span>{c.rewardsSent || 0} reward{(c.rewardsSent || 0) !== 1 ? 's' : ''} sent</span>
        </div>
      </div>

      {/* Actions — mt-auto pins them to the card bottom so cards in the same
          grid row align even when descriptions differ in length */}
      <div className="mt-auto">
      {isActive && (
        <button
          onClick={() => onSendRewards(c)}
          className="w-full py-2.5 px-4 rounded-lg text-[13px] font-bold cursor-pointer transition-all mb-2 hover:opacity-90 border-none shadow"
          style={{ background: theme.accent.primary, color: isDarkMode ? '#181D40' : '#FFFFFF' }}
        >
          🎁 Send Rewards to Eligible Riders
        </button>
      )}
      <div style={{ borderColor: theme.border.primary }} className="flex gap-2 pt-4 border-t">
        <button
          onClick={() => onEdit(c)}
          className="flex-1 py-2.5 px-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-all border hover:opacity-80 whitespace-nowrap"
          style={{ background: `${theme.accent.primary}18`, borderColor: `${theme.accent.primary}50`, color: theme.accent.primary }}
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onToggle(c)}
          className="flex-1 py-2.5 px-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-all border hover:opacity-80 whitespace-nowrap"
          style={{
            background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            borderColor: isActive ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)',
            color: isActive ? '#EF4444' : '#10B981'
          }}
        >
          {isActive ? '🔴 Deactivate' : '✅ Activate'}
        </button>
        <button
          onClick={() => onDelete(c)}
          className="flex-1 py-2.5 px-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-all border hover:opacity-80 whitespace-nowrap"
          style={{ background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444' }}
        >
          🗑️ Delete
        </button>
      </div>
      </div>
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

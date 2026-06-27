// src/pages/admin/Marketing/MarketingHome.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Megaphone } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';

export default function MarketingHome() {
  const { theme } = useTheme();
  const [campaigns, setCampaigns] = useState([]);
  const [promoTabEnabled, setPromoTabEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [c, t] = await Promise.all([
        api.get('/admin/promotions/campaigns').catch(() => []),
        api.get('/admin/promotions/tab-setting').catch(() => ({}))
      ]);
      setCampaigns(Array.isArray(c) ? c : []);
      setPromoTabEnabled(t?.enabled ?? true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(true), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const active = campaigns.filter((c) => c.active).length;
  const rewardsSent = campaigns.reduce((s, c) => s + (c.rewardsSent || 0), 0);

  if (loading) {
    return (
      <div style={{ color: theme.accent.primary }} className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: `${theme.accent.primary} transparent transparent transparent` }} />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-[30px] border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <Megaphone className="w-5 h-5" /> Marketing Dashboard
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Promotions, loyalty campaigns, and the end-user promo tab • Auto-updates every minute
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-4 gap-5 mb-5">
        <StatCard icon="🎁" label="TOTAL CAMPAIGNS" value={campaigns.length} subtitle="created" color="#06B6D4" theme={theme} />
        <StatCard icon="📣" label="ACTIVE CAMPAIGNS" value={active} subtitle="running" color="#10B981" theme={theme} />
        <StatCard icon="🎉" label="REWARDS SENT" value={rewardsSent.toLocaleString()} subtitle="to students" color="#A855F7" theme={theme} />
        <StatCard icon="✨" label="PROMO TAB" value={promoTabEnabled ? 'On' : 'Off'} subtitle={promoTabEnabled ? 'visible to students' : 'hidden'} color={promoTabEnabled ? '#10B981' : '#EF4444'} theme={theme} />
      </div>
    </div>
  );
}

// Stat Card (matches the other admin dashboards)
function StatCard({ icon, label, value, subtitle, color, theme }) {
  return (
    <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-6 rounded-2xl border relative overflow-hidden">
      <div className="absolute right-4 top-4 text-[40px] opacity-15">{icon}</div>
      <div style={{ color: theme.text.secondary }} className="text-[11px] font-bold uppercase tracking-wide mb-3">{label}</div>
      <div style={{ color: theme.text.primary }} className="text-[28px] font-extrabold mb-2">{value}</div>
      <div className="text-xs font-semibold inline-block py-[3px] px-[10px] rounded-xl" style={{ color, background: `${color}20` }}>{subtitle}</div>
    </div>
  );
}

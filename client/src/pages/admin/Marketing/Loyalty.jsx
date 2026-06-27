// src/pages/admin/Marketing/Loyalty.jsx
// Placeholder loyalty-points overview, styled to match the other admin dashboards.
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export default function Loyalty() {
  const { theme } = useTheme();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div style={{ borderColor: theme.border.primary }} className="mb-[30px] border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <Sparkles className="w-5 h-5" /> Loyalty Points
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Points accrual, member tiers, and reward redemptions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        <StatCard icon="✨" label="POINTS ISSUED" value="—" subtitle="all time" color="#06B6D4" theme={theme} />
        <StatCard icon="🏅" label="ACTIVE MEMBERS" value="—" subtitle="earning" color="#10B981" theme={theme} />
        <StatCard icon="🎉" label="REDEMPTIONS" value="—" subtitle="claimed" color="#A855F7" theme={theme} />
      </div>

      {/* Coming soon */}
      <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="rounded-2xl border p-10 text-center">
        <div className="text-[40px] opacity-40 mb-3">🚧</div>
        <h3 style={{ color: theme.text.primary }} className="text-lg font-bold m-0 mb-2">Loyalty program — coming soon</h3>
        <p style={{ color: theme.text.secondary }} className="text-sm max-w-md mx-auto m-0">
          Points accrual, member tiers, and reward redemption tracking will live here. For now, ride-based reward campaigns are managed under the Promos tab.
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtitle, color, theme }) {
  return (
    <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-6 rounded-2xl border relative overflow-hidden opacity-80">
      <div className="absolute right-4 top-4 text-[40px] opacity-15">{icon}</div>
      <div style={{ color: theme.text.secondary }} className="text-[11px] font-bold uppercase tracking-wide mb-3">{label}</div>
      <div style={{ color: theme.text.primary }} className="text-[28px] font-extrabold mb-2">{value}</div>
      <div className="text-xs font-semibold inline-block py-[3px] px-[10px] rounded-xl" style={{ color, background: `${color}20` }}>{subtitle}</div>
    </div>
  );
}

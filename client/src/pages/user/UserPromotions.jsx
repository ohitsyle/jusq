// src/pages/user/UserPromotions.jsx
// End-user promotions: active campaigns + a loyalty-progress placeholder.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { Gift, Sparkles, Loader2, Ticket, TrendingUp } from 'lucide-react';

const REWARD_LABEL = { free_ride: 'Free Ride', discount: 'Discount', credit: 'Credit' };

export default function UserPromotions() {
  const { theme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const accent = theme.accent.primary;
  const [promos, setPromos] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [ridesTaken, setRidesTaken] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/user/promos').catch(() => null),
      api.get('/user/trips').catch(() => null),
    ]).then(([p, t]) => {
      if (p) { setPromos(p.promos || []); setEnabled(p.tabEnabled ?? true); }
      if (t) setRidesTaken(t.totalTrips || 0);
    }).finally(() => setLoading(false));
  }, []);

  // If Marketing disabled the tab, send the user home.
  useEffect(() => {
    if (!loading && !enabled) navigate('/user/dashboard', { replace: true });
  }, [loading, enabled, navigate]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Gift className="w-7 h-7" style={{ color: accent }} />
        <h1 style={{ color: theme.text.primary }} className="text-2xl font-bold">Promotions</h1>
      </div>
      <p style={{ color: theme.text.secondary }} className="text-sm mb-6">Current promos and your loyalty progress.</p>

      {promos.length === 0 ? (
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-12 rounded-2xl border text-center">
          <Ticket className="w-12 h-12 mx-auto mb-3" style={{ color: theme.text.tertiary }} />
          <p style={{ color: theme.text.secondary }}>No active promotions right now. Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {promos.map((p) => {
            const goal = p.minimumRides || 0;
            const pct = goal ? Math.min(100, Math.round((ridesTaken / goal) * 100)) : 0;
            return (
              <div key={p._id} style={{ background: theme.bg.card, borderColor: `${accent}40` }} className="p-5 rounded-2xl border-2">
                <div className="flex items-start gap-3 mb-3">
                  <div style={{ background: `${accent}20` }} className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6" style={{ color: accent }} />
                  </div>
                  <div className="flex-1">
                    <h3 style={{ color: theme.text.primary }} className="font-bold">{p.title}</h3>
                    <p style={{ color: theme.text.secondary }} className="text-sm">{p.description}</p>
                  </div>
                  <span style={{ background: `${accent}1A`, color: accent }} className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                    {REWARD_LABEL[p.rewardType] || 'Reward'}
                  </span>
                </div>

                {/* Loyalty progress (placeholder until per-user point accrual is wired) */}
                {goal > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: theme.text.secondary }} className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Your progress</span>
                      <span style={{ color: theme.text.primary }} className="font-bold">{ridesTaken} / {goal} rides</span>
                    </div>
                    <div style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} className="h-2.5 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%`, background: accent }} className="h-full rounded-full transition-all" />
                    </div>
                    {pct >= 100 && <p style={{ color: '#22C55E' }} className="text-xs font-semibold mt-1.5">🎉 You qualify for this reward!</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ color: theme.text.tertiary }} className="text-xs text-center mt-6">
        Progress shown is based on your recorded shuttle trips. Detailed loyalty points are coming soon.
      </p>
    </div>
  );
}

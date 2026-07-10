// src/pages/user/UserPromotions.jsx
// End-user "Promos & Rewards" tab — a full-bleed rewards experience.
// Each reward type gets its own bespoke design:
//   free_ride -> loyalty punch card: one stamp per shuttle ride this month
//   discount  -> perforated coupon ticket with a tear-off stub
//   credit    -> shimmering cash voucher
// Progress is computed client-side from /user/trips (rides in the current
// month, refunds excluded) to mirror the marketing eligibility engine.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { Gift, Sparkles, Loader2, Ticket, Bus, PartyPopper, BadgePercent, Wallet, Star } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Deterministic "hand-stamped" rotations so the card feels playful but stable across renders.
const STAMP_ROTS = [-8, 6, -4, 7, -6, 4, -7, 3, 8, -5, 5, -3];

const rewardHeadline = (p) => {
  const v = p.rewardValue ?? 1;
  if (p.rewardType === 'discount') return `${v}% OFF`;
  if (p.rewardType === 'credit') return `₱${v}`;
  return v > 1 ? `${v} FREE RIDES` : 'FREE RIDE';
};

// Eligibility window start per promo frequency — mirrors the marketing
// rewards engine (weekly = Monday-start week, biweekly = 14-day blocks,
// monthly = calendar month).
const periodStart = (frequency) => {
  const now = new Date();
  if (frequency === 'weekly') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }
  if (frequency === 'biweekly') {
    return new Date(Math.floor(now.getTime() / (14 * 86400000)) * 14 * 86400000);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const periodName = (frequency) =>
  frequency === 'weekly' ? 'This Week' : frequency === 'biweekly' ? 'This Fortnight' : MONTH_NAMES[new Date().getMonth()];

// Completed (non-refunded) rides inside the promo's current window
const ridesInPeriod = (trips, frequency) => {
  const start = periodStart(frequency);
  return trips.filter((t) => !t.isRefund && new Date(t.date) >= start).length;
};

export default function UserPromotions() {
  const { theme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const accent = theme.accent.primary;
  const [promos, setPromos] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/user/promos').catch(() => null),
      api.get('/user/trips').catch(() => null),
    ]).then(([p, t]) => {
      if (p) { setPromos(p.promos || []); setEnabled(p.tabEnabled ?? true); }
      if (t) setTrips(t.trips || []);
    }).finally(() => setLoading(false));
  }, []);

  // If Marketing disabled the tab, send the user home.
  useEffect(() => {
    if (!loading && !enabled) navigate('/user/dashboard', { replace: true });
  }, [loading, enabled, navigate]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} /></div>;
  }

  const monthName = MONTH_NAMES[new Date().getMonth()];
  const ridesThisMonth = ridesInPeriod(trips, 'monthly');
  // Punch cards are the hero pieces — show them first, full width.
  const stampCards = promos.filter((p) => p.rewardType === 'free_ride');
  const tickets = promos.filter((p) => p.rewardType !== 'free_ride');

  return (
    <div className="w-full">
      <style>{`
        @keyframes stampPop { 0% { transform: scale(0) rotate(0deg); opacity: 0; } 70% { transform: scale(1.25) rotate(var(--rot)); } 100% { transform: scale(1) rotate(var(--rot)); opacity: 1; } }
        @keyframes promoShimmer { 0% { transform: translateX(-150%) skewX(-18deg); } 100% { transform: translateX(350%) skewX(-18deg); } }
        @keyframes promoGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.45); } 50% { box-shadow: 0 0 24px 6px rgba(251,191,36,0.35); } }
        @keyframes promoFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes promoWiggle { 0%, 88%, 100% { transform: rotate(0deg); } 90% { transform: rotate(-12deg); } 94% { transform: rotate(10deg); } 98% { transform: rotate(-6deg); } }
        .promo-stamp { animation: stampPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .promo-shimmer::after { content: ''; position: absolute; top: 0; bottom: 0; width: 45%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); animation: promoShimmer 3.2s ease-in-out infinite; }
        .promo-glow { animation: promoGlow 1.8s ease-in-out infinite; }
        .promo-float { animation: promoFloat 3.5s ease-in-out infinite; }
        .promo-wiggle { animation: promoWiggle 3s ease-in-out infinite; }
      `}</style>

      {/* ============ HERO ============ */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
        style={{ background: `linear-gradient(120deg, ${accent} 0%, #7C3AED 60%, #DB2777 110%)` }}
      >
        {/* floating decor */}
        <div className="absolute top-6 right-10 text-4xl promo-float select-none" aria-hidden>🎁</div>
        <div className="absolute bottom-6 right-32 text-3xl promo-float select-none" style={{ animationDelay: '0.8s' }} aria-hidden>✨</div>
        <div className="absolute top-14 right-52 text-2xl promo-float select-none" style={{ animationDelay: '1.6s' }} aria-hidden>🚌</div>
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} aria-hidden />
        <div className="absolute -top-16 left-1/3 w-56 h-56 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} aria-hidden />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">NUCash Rewards</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white m-0 mb-2">Promos & Rewards</h1>
            <p className="text-white/85 text-sm md:text-base m-0 max-w-xl">
              Ride the shuttle, collect stamps, unlock treats. Each promo tracks its own week, fortnight, or month — make every ride count! 🎉
            </p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-2xl px-6 py-4 text-center border border-white/25">
            <div className="text-4xl font-black text-white leading-none mb-1">{ridesThisMonth}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">ride{ridesThisMonth !== 1 ? 's' : ''} in {monthName}</div>
          </div>
        </div>
      </div>

      {promos.length === 0 ? (
        <div style={{ background: theme.bg.card, borderColor: theme.border.primary }} className="p-16 rounded-3xl border-2 text-center">
          <div className="text-6xl mb-4 promo-float inline-block">🎟️</div>
          <h3 style={{ color: theme.text.primary }} className="text-lg font-bold mb-1">No promos right now</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm">The marketing team is cooking something up. Check back soon!</p>
        </div>
      ) : (
        <>
          {/* ============ PUNCH CARDS (free rides) ============ */}
          {stampCards.map((p) => (
            <StampCard key={p._id} promo={p} rides={ridesInPeriod(trips, p.frequency)} periodTitle={periodName(p.frequency)} theme={theme} isDarkMode={isDarkMode} accent={accent} />
          ))}

          {/* ============ COUPONS & VOUCHERS ============ */}
          {tickets.length > 0 && (
            <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))' }}>
              {tickets.map((p) => p.rewardType === 'discount'
                ? <CouponTicket key={p._id} promo={p} rides={ridesInPeriod(trips, p.frequency)} theme={theme} isDarkMode={isDarkMode} />
                : <CashVoucher key={p._id} promo={p} rides={ridesInPeriod(trips, p.frequency)} theme={theme} isDarkMode={isDarkMode} />)}
            </div>
          )}
        </>
      )}

      <p style={{ color: theme.text.tertiary }} className="text-xs text-center mt-2 pb-4">
        Progress counts your completed shuttle rides within each promo's period (refunds excluded). Rewards are sent to your school email once you qualify. 💌
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Free ride -> loyalty punch card. One stamp per ride this month;   */
/* the final slot is the golden reward slot.                          */
/* ---------------------------------------------------------------- */
function StampCard({ promo: p, rides, periodTitle, theme, isDarkMode, accent }) {
  const goal = Math.max(1, p.minimumRides || 1);
  const stamped = Math.min(rides, goal);
  const remaining = goal - stamped;
  const qualified = remaining <= 0;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border-2 mb-8"
      style={{
        background: isDarkMode
          ? `linear-gradient(135deg, rgba(30,35,71,0.95) 0%, rgba(15,18,39,0.95) 100%)`
          : `linear-gradient(135deg, #FFFFFF 0%, ${accent}0D 100%)`,
        borderColor: qualified ? '#FBBF24' : `${accent}55`,
      }}
    >
      {/* ticket-edge dots along the top */}
      <div className="absolute top-0 left-0 right-0 h-2 flex justify-around" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="w-2 h-2 rounded-full -mt-1" style={{ background: qualified ? '#FBBF24' : `${accent}45` }} />
        ))}
      </div>

      <div className="p-6 md:p-8 pt-8">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${qualified ? 'promo-wiggle' : ''}`}
              style={{ background: qualified ? 'linear-gradient(135deg, #FBBF24, #F59E0B)' : `linear-gradient(135deg, ${accent}, #7C3AED)` }}
            >
              <Bus className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: qualified ? '#F59E0B' : accent }}>
                Ride Club · {periodTitle}
              </div>
              <h3 style={{ color: theme.text.primary }} className="text-xl md:text-2xl font-black m-0 mb-1">{p.title}</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm m-0 max-w-2xl">{p.description}</p>
            </div>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-black whitespace-nowrap ${qualified ? 'promo-glow' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
              color: '#78350F',
            }}
          >
            🎫 {rewardHeadline(p)}
          </div>
        </div>

        {/* stamp grid */}
        <div className="flex flex-wrap gap-3 md:gap-4 mb-6">
          {Array.from({ length: goal }).map((_, i) => {
            const isRewardSlot = i === goal - 1;
            const isStamped = i < stamped;
            const rot = STAMP_ROTS[i % STAMP_ROTS.length];
            if (isStamped) {
              return (
                <div
                  key={i}
                  className="promo-stamp w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    '--rot': `${rot}deg`,
                    animationDelay: `${i * 0.07}s`,
                    background: isRewardSlot
                      ? 'linear-gradient(135deg, #FBBF24, #F59E0B)'
                      : `linear-gradient(135deg, ${accent}, #7C3AED)`,
                    boxShadow: isRewardSlot ? '0 4px 14px rgba(245,158,11,0.5)' : `0 4px 12px ${accent}55`,
                  }}
                >
                  {isRewardSlot ? <PartyPopper className="w-6 h-6 text-white" /> : <Bus className="w-5 h-5 md:w-6 md:h-6 text-white" />}
                </div>
              );
            }
            return (
              <div
                key={i}
                className="w-12 h-12 md:w-14 md:h-14 rounded-full flex flex-col items-center justify-center flex-shrink-0 border-2 border-dashed"
                style={{
                  borderColor: isRewardSlot ? '#F59E0B' : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                  background: isRewardSlot ? 'rgba(251,191,36,0.08)' : 'transparent',
                }}
              >
                {isRewardSlot ? (
                  <>
                    <Gift className="w-5 h-5" style={{ color: '#F59E0B' }} />
                    <span className="text-[8px] font-black mt-0.5" style={{ color: '#F59E0B' }}>FREE</span>
                  </>
                ) : (
                  <span className="text-xs font-bold" style={{ color: theme.text.tertiary }}>{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* progress footer */}
        {qualified ? (
          <div
            className="rounded-2xl p-4 flex items-center gap-3 border-2"
            style={{ background: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.5)' }}
          >
            <span className="text-3xl promo-wiggle inline-block" aria-hidden>🎉</span>
            <div>
              <div className="font-black text-base" style={{ color: '#F59E0B' }}>Card complete — you did it!</div>
              <div className="text-sm" style={{ color: theme.text.secondary }}>
                You've earned <b>{rewardHeadline(p).toLowerCase()}</b>. Keep an eye on your school email for your reward! 💌
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: accent }} />
              <span className="text-sm font-semibold" style={{ color: theme.text.secondary }}>
                <b style={{ color: theme.text.primary }}>{stamped}</b> of {goal} stamps collected
              </span>
            </div>
            <span
              className="text-sm font-black px-3.5 py-1.5 rounded-full"
              style={{ background: `${accent}18`, color: accent }}
            >
              🚌 {remaining} more ride{remaining !== 1 ? 's' : ''} until your {rewardHeadline(p).toLowerCase()}!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Discount -> perforated coupon ticket with a tear-off % stub.      */
/* ---------------------------------------------------------------- */
function CouponTicket({ promo: p, rides, theme, isDarkMode }) {
  const goal = Math.max(1, p.minimumRides || 1);
  const pct = Math.min(100, Math.round((rides / goal) * 100));
  const qualified = rides >= goal;
  const notchBg = isDarkMode ? '#131735' : '#EDF4FF'; // matches page background closely

  return (
    <div
      className="relative flex rounded-2xl overflow-hidden border-2"
      style={{
        background: isDarkMode ? 'rgba(30,35,71,0.9)' : '#FFFFFF',
        borderColor: qualified ? 'rgba(251,191,36,0.7)' : 'rgba(249,115,22,0.45)',
      }}
    >
      {/* tear-off stub */}
      <div
        className="relative w-28 md:w-32 flex-shrink-0 flex flex-col items-center justify-center p-4 promo-shimmer overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #F59E0B 0%, #F97316 60%, #EA580C 100%)' }}
      >
        <BadgePercent className="w-7 h-7 text-white/90 mb-1" />
        <div className="text-3xl font-black text-white leading-none">{p.rewardValue ?? 0}%</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/85 mt-1">OFF RIDE</div>
      </div>

      {/* perforation */}
      <div className="relative w-0 border-l-2 border-dashed flex-shrink-0" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }}>
        <span className="absolute -top-3 -left-3 w-6 h-6 rounded-full" style={{ background: notchBg }} aria-hidden />
        <span className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full" style={{ background: notchBg }} aria-hidden />
      </div>

      {/* body */}
      <div className="flex-1 p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: '#F97316' }}>Discount Coupon</div>
        <h3 style={{ color: theme.text.primary }} className="font-black text-lg m-0 mb-1">{p.title}</h3>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0 mb-4 line-clamp-2">{p.description}</p>

        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: theme.text.secondary }} className="font-semibold">Your progress</span>
          <span style={{ color: theme.text.primary }} className="font-black">{Math.min(rides, goal)} / {goal} rides</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #F59E0B, #F97316)' }} />
        </div>
        {qualified ? (
          <p className="text-xs font-black mt-2 m-0" style={{ color: '#F59E0B' }}>🎉 Coupon unlocked — watch your email!</p>
        ) : (
          <p className="text-xs font-semibold mt-2 m-0" style={{ color: theme.text.tertiary }}>{goal - rides} more ride{goal - rides !== 1 ? 's' : ''} to unlock</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Credit -> shimmering cash voucher, banknote style.                */
/* ---------------------------------------------------------------- */
function CashVoucher({ promo: p, rides, theme, isDarkMode }) {
  const goal = Math.max(1, p.minimumRides || 1);
  const pct = Math.min(100, Math.round((rides / goal) * 100));
  const qualified = rides >= goal;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border-2 promo-shimmer"
      style={{
        background: 'linear-gradient(135deg, #059669 0%, #10B981 55%, #34D399 120%)',
        borderColor: qualified ? 'rgba(251,191,36,0.8)' : 'rgba(16,185,129,0.5)',
      }}
    >
      {/* banknote decor */}
      <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full border-[6px]" style={{ borderColor: 'rgba(255,255,255,0.12)' }} aria-hidden />
      <div className="absolute -right-2 -bottom-10 w-28 h-28 rounded-full border-[6px]" style={{ borderColor: 'rgba(255,255,255,0.10)' }} aria-hidden />
      <div className="absolute left-1/2 top-3 text-[9px] font-black uppercase tracking-[0.35em] text-white/50 -translate-x-1/2" aria-hidden>· NUCash Credit Voucher ·</div>

      <div className="relative p-5 pt-8 md:p-6 md:pt-9">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white m-0 mb-0.5">{p.title}</h3>
              <p className="text-[13px] text-white/80 m-0 line-clamp-2">{p.description}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl md:text-4xl font-black text-white leading-none">₱{p.rewardValue ?? 0}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/75 mt-1">free credit</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-white/85">Your progress</span>
          <span className="font-black text-white">{Math.min(rides, goal)} / {goal} rides</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-white/20">
          <div className="h-full rounded-full transition-all duration-700 bg-white" style={{ width: `${pct}%` }} />
        </div>
        {qualified ? (
          <p className="text-xs font-black mt-2 m-0 text-yellow-200">🎉 ₱{p.rewardValue ?? 0} is coming your way — check your email!</p>
        ) : (
          <p className="text-xs font-semibold mt-2 m-0 text-white/75">{goal - rides} more ride{goal - rides !== 1 ? 's' : ''} to cash in</p>
        )}
      </div>
    </div>
  );
}

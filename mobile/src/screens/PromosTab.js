// src/screens/PromosTab.js
// End-user "Promos & Rewards" tab — mirrors the web page
// (client/src/pages/user/UserPromotions.jsx). Each reward type has its own design:
//   free_ride -> loyalty punch card: one stamp per shuttle ride this period
//   discount  -> perforated coupon ticket with a tear-off stub
//   credit    -> cash voucher
// Progress is computed from /user/trips (rides in the promo's current
// week / fortnight / month, refunds excluded), same as the web.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Bus, Gift, PartyPopper, BadgePercent, Wallet, Star, Sparkles } from 'lucide-react-native';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Deterministic "hand-stamped" rotations so the card feels playful but stable across renders.
const STAMP_ROTS = [-8, 6, -4, 7, -6, 4, -7, 3, 8, -5, 5, -3];
const GOLD = ['#FBBF24', '#F59E0B'];

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

// '#RRGGBB' + opacity -> rgba(), so gradients and tints work on every Android version.
const alpha = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

let gradientSeq = 0;
// A View with a linear-gradient background (react-native-svg, no extra native module).
function Gradient({ colors, from = [0, 0], to = [1, 1], style, children }) {
  const id = useRef(`g${++gradientSeq}`).current;
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {/* The Svg sits in its own absolute layer; on Android an Svg given
          position:absolute directly still took part in layout. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}>
              {colors.map((c, i) => (
                <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

// Gentle bobbing for the hero's emoji decor.
function Floating({ delay = 0, style, children }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -7, duration: 1750, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.Text style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.Text>;
}

// A stamp that "thunks" onto the card when the tab opens.
function Stamp({ index, rot, reward, accent }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: 1, delay: index * 70, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.stampSlot, { transform: [{ scale: s }, { rotate: `${rot}deg` }] }]}>
      <Gradient
        colors={reward ? GOLD : [accent, '#7C3AED']}
        style={[styles.stampFill, { backgroundColor: reward ? '#F59E0B' : accent, shadowColor: reward ? '#F59E0B' : accent }]}
      >
        {reward ? <PartyPopper size={22} color="#FFFFFF" /> : <Bus size={20} color="#FFFFFF" />}
      </Gradient>
    </Animated.View>
  );
}

export default function PromosTab({ promos, trips, theme }) {
  const accent = theme.accent;
  const monthName = MONTH_NAMES[new Date().getMonth()];
  const ridesThisMonth = ridesInPeriod(trips, 'monthly');
  // Punch cards are the hero pieces — show them first.
  const stampCards = promos.filter((p) => p.rewardType === 'free_ride');
  const tickets = promos.filter((p) => p.rewardType !== 'free_ride');

  return (
    <View>
      {/* ============ HERO ============ */}
      <Gradient colors={[accent, '#7C3AED', '#DB2777']} from={[0, 0.2]} to={[1, 0.8]} style={styles.hero}>
        <View style={[styles.heroBubble, { width: 170, height: 170, bottom: -60, left: -50 }]} />
        <View style={[styles.heroBubble, { width: 190, height: 190, top: -90, right: -40, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        <Floating style={[styles.heroEmoji, { top: 14, right: 18, fontSize: 30 }]}>🎁</Floating>
        <Floating delay={800} style={[styles.heroEmoji, { top: 58, right: 64, fontSize: 18 }]}>🚌</Floating>

        <View style={styles.heroKickerRow}>
          <Sparkles size={16} color="#FDE047" />
          <Text style={styles.heroKicker}>NUCASH REWARDS</Text>
        </View>
        <Text style={styles.heroTitle}>Promos & Rewards</Text>
        <Text style={styles.heroText}>
          Ride the shuttle, collect stamps, unlock treats. Each promo tracks its own week, fortnight, or month — make every ride count! 🎉
        </Text>
        <View style={styles.heroCount}>
          <Text style={styles.heroCountNum}>{ridesThisMonth}</Text>
          <Text style={styles.heroCountLabel}>
            {`RIDE${ridesThisMonth !== 1 ? 'S' : ''} IN ${monthName.toUpperCase()}`}
          </Text>
        </View>
      </Gradient>

      {promos.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Floating style={{ fontSize: 48, marginBottom: 10 }}>🎟️</Floating>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No promos right now</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>The marketing team is cooking something up. Check back soon!</Text>
        </View>
      ) : (
        <>
          {stampCards.map((p) => (
            <StampCard key={p._id} promo={p} rides={ridesInPeriod(trips, p.frequency)} periodTitle={periodName(p.frequency)} theme={theme} />
          ))}
          {tickets.map((p) => (p.rewardType === 'discount'
            ? <CouponTicket key={p._id} promo={p} rides={ridesInPeriod(trips, p.frequency)} theme={theme} />
            : <CashVoucher key={p._id} promo={p} rides={ridesInPeriod(trips, p.frequency)} theme={theme} />))}
        </>
      )}

      <Text style={[styles.footNote, { color: theme.textMuted }]}>
        Progress counts your completed shuttle rides within each promo's period (refunds excluded). Rewards are sent to your school email once you qualify. 💌
      </Text>
    </View>
  );
}

/* Free ride -> loyalty punch card. One stamp per ride; the last slot is the reward. */
function StampCard({ promo: p, rides, periodTitle, theme }) {
  const accent = theme.accent;
  const goal = Math.max(1, p.minimumRides || 1);
  const stamped = Math.min(rides, goal);
  const remaining = goal - stamped;
  const qualified = remaining <= 0;
  const headline = rewardHeadline(p);

  return (
    <Gradient
      colors={theme.isDark ? ['rgba(30,35,71,0.95)', 'rgba(15,18,39,0.95)'] : ['#FFFFFF', alpha(accent, 0.06)]}
      style={[styles.stampCard, { borderColor: qualified ? '#FBBF24' : alpha(accent, 0.33) }]}
    >
      {/* ticket-edge dots along the top */}
      <View style={styles.edgeDots}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={[styles.edgeDot, { backgroundColor: qualified ? '#FBBF24' : alpha(accent, 0.27) }]} />
        ))}
      </View>

      <View style={styles.stampHeader}>
        <Gradient colors={qualified ? GOLD : [accent, '#7C3AED']} style={styles.stampIcon}>
          <Bus size={26} color="#FFFFFF" />
        </Gradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: qualified ? '#F59E0B' : accent }]}>
            {`RIDE CLUB · ${periodTitle.toUpperCase()}`}
          </Text>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{p.title}</Text>
          {!!p.description && <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{p.description}</Text>}
        </View>
      </View>

      <Gradient colors={GOLD} style={styles.rewardPill}>
        <Text style={styles.rewardPillText}>🎫 {headline}</Text>
      </Gradient>

      {/* stamp grid */}
      <View style={styles.stampGrid}>
        {Array.from({ length: goal }).map((_, i) => {
          const isRewardSlot = i === goal - 1;
          if (i < stamped) {
            return <Stamp key={i} index={i} rot={STAMP_ROTS[i % STAMP_ROTS.length]} reward={isRewardSlot} accent={accent} />;
          }
          return (
            <View
              key={i}
              style={[styles.stampSlot, styles.stampEmpty, {
                borderColor: isRewardSlot ? '#F59E0B' : (theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                backgroundColor: isRewardSlot ? 'rgba(251,191,36,0.08)' : 'transparent',
              }]}
            >
              {isRewardSlot ? (
                <>
                  <Gift size={18} color="#F59E0B" />
                  <Text style={styles.freeTag}>FREE</Text>
                </>
              ) : (
                <Text style={[styles.slotNum, { color: theme.textMuted }]}>{i + 1}</Text>
              )}
            </View>
          );
        })}
      </View>

      {qualified ? (
        <View style={styles.doneBox}>
          <Text style={{ fontSize: 26 }}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle}>Card complete — you did it!</Text>
            <Text style={[styles.doneText, { color: theme.textSecondary }]}>
              You've earned <Text style={{ fontWeight: '800' }}>{headline.toLowerCase()}</Text>. Keep an eye on your school email for your reward! 💌
            </Text>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.stampCountRow}>
            <Star size={15} color={accent} />
            <Text style={[styles.stampCount, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{stamped}</Text> of {goal} stamps collected
            </Text>
          </View>
          <View style={[styles.morePill, { backgroundColor: alpha(accent, 0.1) }]}>
            <Text style={[styles.morePillText, { color: accent }]}>
              🚌 {remaining} more ride{remaining !== 1 ? 's' : ''} until your {headline.toLowerCase()}!
            </Text>
          </View>
        </View>
      )}
    </Gradient>
  );
}

function ProgressBar({ pct, track, fill }) {
  return (
    <View style={[styles.barTrack, { backgroundColor: track }]}>
      {fill === 'orange'
        ? <Gradient colors={['#F59E0B', '#F97316']} from={[0, 0]} to={[1, 0]} style={[styles.barFill, { width: `${pct}%` }]} />
        : <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: fill }]} />}
    </View>
  );
}

/* Discount -> perforated coupon ticket with a tear-off % stub. */
function CouponTicket({ promo: p, rides, theme }) {
  const goal = Math.max(1, p.minimumRides || 1);
  const pct = Math.min(100, Math.round((rides / goal) * 100));
  const qualified = rides >= goal;
  const perf = theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)';

  return (
    <View style={[styles.coupon, {
      backgroundColor: theme.isDark ? 'rgba(30,35,71,0.9)' : '#FFFFFF',
      borderColor: qualified ? 'rgba(251,191,36,0.7)' : 'rgba(249,115,22,0.45)',
    }]}>
      <Gradient colors={['#F59E0B', '#F97316', '#EA580C']} from={[0.2, 0]} to={[0.8, 1]} style={styles.couponStub}>
        <BadgePercent size={24} color="rgba(255,255,255,0.9)" />
        <Text style={styles.couponPct}>{p.rewardValue ?? 0}%</Text>
        <Text style={styles.couponOff}>OFF RIDE</Text>
      </Gradient>

      {/* perforation with notches cut from the card edge */}
      <View style={[styles.perforation, { borderColor: perf }]}>
        <View style={[styles.notch, { top: -11, backgroundColor: theme.bg }]} />
        <View style={[styles.notch, { bottom: -11, backgroundColor: theme.bg }]} />
      </View>

      <View style={styles.couponBody}>
        <Text style={[styles.kicker, { color: '#F97316' }]}>DISCOUNT COUPON</Text>
        <Text style={[styles.ticketTitle, { color: theme.text }]}>{p.title}</Text>
        {!!p.description && <Text numberOfLines={2} style={[styles.ticketDesc, { color: theme.textSecondary }]}>{p.description}</Text>}
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Your progress</Text>
          <Text style={[styles.progressValue, { color: theme.text }]}>{Math.min(rides, goal)} / {goal} rides</Text>
        </View>
        <ProgressBar pct={pct} track={theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} fill="orange" />
        {qualified
          ? <Text style={[styles.progressHint, { color: '#F59E0B', fontWeight: '900' }]}>🎉 Coupon unlocked — watch your email!</Text>
          : <Text style={[styles.progressHint, { color: theme.textMuted }]}>{goal - rides} more ride{goal - rides !== 1 ? 's' : ''} to unlock</Text>}
      </View>
    </View>
  );
}

/* Credit -> cash voucher, banknote style. */
function CashVoucher({ promo: p, rides }) {
  const goal = Math.max(1, p.minimumRides || 1);
  const pct = Math.min(100, Math.round((rides / goal) * 100));
  const qualified = rides >= goal;
  const value = p.rewardValue ?? 0;

  return (
    <Gradient
      colors={['#059669', '#10B981', '#34D399']}
      style={[styles.voucher, { borderColor: qualified ? 'rgba(251,191,36,0.8)' : 'rgba(16,185,129,0.5)' }]}
    >
      <View style={[styles.voucherRing, { width: 130, height: 130, top: -34, right: -34 }]} />
      <View style={[styles.voucherRing, { width: 100, height: 100, bottom: -40, right: -8, borderColor: 'rgba(255,255,255,0.10)' }]} />
      <Text style={styles.voucherBanner}>· NUCASH CREDIT VOUCHER ·</Text>

      <View style={styles.voucherHead}>
        <View style={styles.voucherIcon}><Wallet size={22} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ticketTitle, { color: '#FFFFFF' }]}>{p.title}</Text>
          {!!p.description && <Text numberOfLines={2} style={[styles.ticketDesc, { color: 'rgba(255,255,255,0.8)', marginBottom: 0 }]}>{p.description}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.voucherValue}>₱{value}</Text>
          <Text style={styles.voucherValueLabel}>FREE CREDIT</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={[styles.progressLabel, { color: 'rgba(255,255,255,0.85)' }]}>Your progress</Text>
        <Text style={[styles.progressValue, { color: '#FFFFFF' }]}>{Math.min(rides, goal)} / {goal} rides</Text>
      </View>
      <ProgressBar pct={pct} track="rgba(255,255,255,0.2)" fill="#FFFFFF" />
      {qualified
        ? <Text style={[styles.progressHint, { color: '#FEF08A', fontWeight: '900' }]}>🎉 ₱{value} is coming your way — check your email!</Text>
        : <Text style={[styles.progressHint, { color: 'rgba(255,255,255,0.75)' }]}>{goal - rides} more ride{goal - rides !== 1 ? 's' : ''} to cash in</Text>}
    </Gradient>
  );
}

const styles = StyleSheet.create({
  // hero
  hero: { borderRadius: 24, padding: 20, paddingTop: 22, marginBottom: 18, marginTop: 4 },
  heroBubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroEmoji: { position: 'absolute' },
  heroKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  heroKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', letterSpacing: 2.4 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 6, paddingRight: 70 },
  heroText: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19 },
  heroCount: {
    alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  heroCountNum: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  heroCountLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },

  // empty
  empty: { borderRadius: 24, borderWidth: 2, padding: 36, alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  emptyText: { fontSize: 13, textAlign: 'center' },

  // shared
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 2.2, marginBottom: 3 },
  cardTitle: { fontSize: 19, fontWeight: '900', marginBottom: 3 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '600' },
  progressValue: { fontSize: 12, fontWeight: '900' },
  progressHint: { fontSize: 12, fontWeight: '600', marginTop: 7 },
  barTrack: { height: 11, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },

  // punch card
  stampCard: { borderRadius: 24, borderWidth: 2, padding: 18, paddingTop: 24, marginBottom: 18 },
  edgeDots: { position: 'absolute', top: -4, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  edgeDot: { width: 8, height: 8, borderRadius: 4 },
  stampHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stampIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rewardPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 16 },
  rewardPillText: { color: '#78350F', fontSize: 13, fontWeight: '900' },
  stampGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  stampSlot: { width: 46, height: 46, borderRadius: 23 },
  stampFill: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  stampEmpty: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  freeTag: { color: '#F59E0B', fontSize: 8, fontWeight: '900', marginTop: 1 },
  slotNum: { fontSize: 12, fontWeight: '700' },
  stampCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  stampCount: { fontSize: 13, fontWeight: '600' },
  morePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  morePillText: { fontSize: 13, fontWeight: '900' },
  doneBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 2, padding: 14,
    backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.5)',
  },
  doneTitle: { color: '#F59E0B', fontSize: 15, fontWeight: '900', marginBottom: 2 },
  doneText: { fontSize: 13, lineHeight: 18 },

  // coupon
  coupon: { flexDirection: 'row', borderRadius: 18, borderWidth: 2, overflow: 'hidden', marginBottom: 16 },
  couponStub: { width: 96, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  couponPct: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 4 },
  couponOff: { color: 'rgba(255,255,255,0.88)', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 2 },
  perforation: { width: 0, borderLeftWidth: 2, borderStyle: 'dashed' },
  notch: { position: 'absolute', left: -11, width: 20, height: 20, borderRadius: 10 },
  couponBody: { flex: 1, padding: 14 },
  ticketTitle: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  ticketDesc: { fontSize: 12.5, lineHeight: 17, marginBottom: 12 },

  // voucher
  voucher: { borderRadius: 18, borderWidth: 2, padding: 16, paddingTop: 28, marginBottom: 16 },
  voucherRing: { position: 'absolute', borderRadius: 999, borderWidth: 6, borderColor: 'rgba(255,255,255,0.12)' },
  voucherBanner: {
    position: 'absolute', top: 9, left: 0, right: 0, textAlign: 'center',
    color: 'rgba(255,255,255,0.5)', fontSize: 8.5, fontWeight: '900', letterSpacing: 3,
  },
  voucherHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  voucherIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  voucherValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  voucherValueLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 2 },

  footNote: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4, marginBottom: 12, paddingHorizontal: 8 },
});

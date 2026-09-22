// src/screens/UserDashboardScreen.js
// Student/end-user dashboard — matches the web Student Portal:
// NU-branded header, dark/light theme toggle, tab nav (Home / History / My Concerns),
// balance + transactions, and area-based concerns/feedback (mirrors the web flow).
// Icons: lucide-react-native (no emojis), to match the web.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import IdleSignOut, { ActivityModal, IDLE_MINUTES, markActive } from '../shared/components/IdleSignOut';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Sun, Moon, Home, History, ClipboardList, GraduationCap, Eye, EyeOff,
  CheckCircle2, XCircle, MessageSquare, ArrowDownLeft, ArrowUpRight,
  Monitor, Wallet, Store, Bus, Star, KeyRound, AlertTriangle, LogOut,
  X, ChevronRight, Inbox, Receipt, Check,
  Send, Gift, Bell, Info, AlertOctagon, Search, ArrowRight, TrendingUp, Navigation, ShieldCheck,
} from 'lucide-react-native';

const ALERT_SEVERITY = {
  info: { color: '#3B82F6', Icon: Info },
  success: { color: '#22C55E', Icon: CheckCircle2 },
  warning: { color: '#F59E0B', Icon: AlertTriangle },
  critical: { color: '#EF4444', Icon: AlertOctagon },
};
import api from '../services/api';
import ChangePinModal from './ChangePinModal';
import DeactivateAccountModal from './DeactivateAccountModal';
import SendMoneyModal from './SendMoneyModal';
import PromosTab from './PromosTab';

const AUTO_REFRESH_INTERVAL = 30000;
const THEME_KEY = '@nucash_user_theme';

// Theme tokens mirroring the web ThemeContext (dark = NU navy + yellow, light = blue).
const makeTheme = (isDark) =>
  isDark
    ? {
        isDark: true,
        bg: '#0F1227',
        headerBg: '#181D40',
        card: 'rgba(255,255,255,0.04)',
        cardSolid: '#1A2048',
        text: '#FBFBFB',
        textSecondary: 'rgba(251,251,251,0.6)',
        textMuted: 'rgba(251,251,251,0.4)',
        accent: '#FFD41C',
        onAccent: '#181D40',
        accentSoft: 'rgba(255,212,28,0.12)',
        border: 'rgba(255,255,255,0.08)',
        danger: '#EF4444',
        success: '#22C55E',
        pending: '#F59E0B',
        overlay: 'rgba(0,0,0,0.65)',
      }
    : {
        isDark: false,
        bg: '#EAF2FF',
        headerBg: '#FFFFFF',
        card: '#FFFFFF',
        cardSolid: '#FFFFFF',
        text: '#181D40',
        textSecondary: 'rgba(24,29,64,0.7)',
        textMuted: 'rgba(24,29,64,0.45)',
        accent: '#3B82F6',
        onAccent: '#FFFFFF',
        accentSoft: 'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.16)',
        danger: '#EF4444',
        success: '#16A34A',
        pending: '#D97706',
        overlay: 'rgba(0,0,0,0.5)',
      };

const TABS = [
  { key: 'home', Icon: Home, label: 'Home' },
  { key: 'history', Icon: History, label: 'History' },
  { key: 'concerns', Icon: ClipboardList, label: 'My Concerns' },
];

const RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

// Areas a student can report to (mirrors the web department list).
const AREAS = [
  { value: 'sysad', label: 'NUCash System', Icon: Monitor, desc: 'Technical issues, app problems' },
  { value: 'treasury', label: 'Finance', Icon: Wallet, desc: 'Balance, cash-in, payments' },
  { value: 'merchants', label: 'Merchants', Icon: Store, desc: 'Store-related concerns' },
  { value: 'motorpool', label: 'Shuttle Service', Icon: Bus, desc: 'Transportation concerns' },
];

// Readable department for a concern's reportTo (code, older office name, or a merchant's name).
// Mirrors client/src/utils/departments.js.
const DEPARTMENT_NAMES = {
  sysad: 'System Administrator', itso: 'System Administrator',
  treasury: 'Treasury', 'treasury office': 'Treasury',
  motorpool: 'Motorpool', 'nu shuttle service': 'Motorpool',
  merchant: 'Merchants', merchants: 'Merchants', 'merchant office': 'Merchants',
  accounting: 'Accounting', marketing: 'Marketing',
};

export default function UserDashboardScreen({ navigation, route }) {
  const [isDark, setIsDark] = useState(true);
  const theme = makeTheme(isDark);
  const styles = makeStyles(theme);

  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyRange, setHistoryRange] = useState('all');

  const [showConcernModal, setShowConcernModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Concern form (area-based, mirrors web)
  const [concernArea, setConcernArea] = useState('');
  const [concernMerchant, setConcernMerchant] = useState('');
  const [concernSubject, setConcernSubject] = useState('');
  const [concernDetails, setConcernDetails] = useState('');

  // Feedback form
  const [feedbackArea, setFeedbackArea] = useState('');
  const [feedbackMerchant, setFeedbackMerchant] = useState('');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);

  // Merchants (loaded when an area === 'merchants' is chosen)
  const [merchants, setMerchants] = useState([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Ported web features
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [trips, setTrips] = useState([]);
  const [promos, setPromos] = useState([]);
  const [promoTabEnabled, setPromoTabEnabled] = useState(false);

  // Send Money (student-to-student) — see SendMoneyModal
  const [showTransferModal, setShowTransferModal] = useState(false);

  const userId = route.params?.userId;
  const userEmail = route.params?.userEmail;
  const initialLoadDone = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light') setIsDark(false);
      else if (v === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    if (!userId) return;
    fetchDashboardData(true);
    const interval = setInterval(() => fetchDashboardData(false), AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (concernArea === 'merchants' || feedbackArea === 'merchants') fetchMerchants();
  }, [concernArea, feedbackArea]);

  const fetchDashboardData = async (showSpinner = false) => {
    try {
      if (showSpinner && !initialLoadDone.current) setLoading(true);

      const userRes = await api.get(`/user/${userId}`);
      setUser(userRes.data);
      setBalance(userRes.data.balance || 0);

      const txRes = await api.get(`/user/${userId}/transactions?limit=100`);
      setTransactions(txRes.data || []);

      const concernsRes = await api.get(`/user/${userId}/concerns`);
      setConcerns(concernsRes.data || []);

      // Ported extras (best-effort; token-authed via api interceptor)
      api.get('/system-alerts/active').then((r) => setSystemAlerts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      api.get('/user/trips').then((r) => { const all = r.data?.trips || []; setTrips(all); setRecentTrips(all.filter((t) => !t.isRefund).slice(0, 4)); }).catch(() => {});
      api.get('/user/promos').then((r) => { setPromos(r.data?.promos || []); setPromoTabEnabled(!!r.data?.tabEnabled); }).catch(() => {});

      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (!initialLoadDone.current) Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchants = async () => {
    if (merchants.length || loadingMerchants) return;
    setLoadingMerchants(true);
    try {
      const res = await api.get('/user/merchants');
      setMerchants(res.data?.merchants || []);
    } catch (error) {
      setMerchants([]);
    } finally {
      setLoadingMerchants(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [userId]);

  const resetConcernForm = () => {
    setConcernArea(''); setConcernMerchant(''); setConcernSubject(''); setConcernDetails('');
  };
  const resetFeedbackForm = () => {
    setFeedbackArea(''); setFeedbackMerchant(''); setFeedbackSubject(''); setFeedbackText(''); setFeedbackRating(0);
  };

  const handleSubmitConcern = async () => {
    if (!concernArea) return Alert.alert('Required', 'Please choose an area to report to.');
    if (concernArea === 'merchants' && !concernMerchant) return Alert.alert('Required', 'Please select a merchant.');
    if (!concernSubject.trim() || !concernDetails.trim()) return Alert.alert('Required', 'Please enter a subject and details.');
    setSubmitting(true);
    try {
      const res = await api.post('/user/concerns', {
        department: concernArea,
        merchant: concernArea === 'merchants' ? concernMerchant : undefined,
        subject: concernSubject.trim(),
        details: concernDetails.trim(),
      });
      if (res.data?.success) {
        Alert.alert('Submitted', 'Your concern has been received. We will get back to you soon.');
        resetConcernForm();
        setShowConcernModal(false);
        await fetchDashboardData();
      } else {
        Alert.alert('Error', 'Failed to submit concern');
      }
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to submit concern');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackArea) return Alert.alert('Required', 'Please choose an area.');
    if (feedbackArea === 'merchants' && !feedbackMerchant) return Alert.alert('Required', 'Please select a merchant.');
    if (!feedbackRating) return Alert.alert('Required', 'Please give a star rating.');
    setSubmitting(true);
    try {
      const res = await api.post('/user/feedback', {
        department: feedbackArea,
        merchant: feedbackArea === 'merchants' ? feedbackMerchant : undefined,
        subject: feedbackSubject.trim() || undefined,
        feedback: feedbackText.trim() || undefined,
        rating: feedbackRating,
      });
      if (res.data?.success) {
        Alert.alert('Thank you!', 'Your feedback has been received.');
        resetFeedbackForm();
        setShowFeedbackModal(false);
        await fetchDashboardData();
      } else {
        Alert.alert('Error', 'Failed to submit feedback');
      }
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Send Money ------------------------------------------------------------
  const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const openTransfer = () => setShowTransferModal(true);

  // 3 wrong PINs lock the account and end every session — go back to sign-in.
  const signOutAfterLock = async () => {
    setShowTransferModal(false);
    try { await AsyncStorage.multiRemove(['auth_token', 'user_role']); } catch { /* ignore */ }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // Inactivity sign-out (IdleSignOut), or "Sign out now" on its warning
  const signOutIdle = async (reason) => {
    try { await AsyncStorage.multiRemove(['auth_token', 'user_role', 'user_id']); } catch { /* ignore */ }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    if (reason === 'idle') {
      Alert.alert('Signed out', `You were signed out after ${IDLE_MINUTES} minutes without activity. Please sign in again.`);
    }
  };

  const dismissAlert = (id) => setDismissedAlerts((prev) => [...prev, id]);
  const visibleAlerts = systemAlerts.filter((a) => !dismissedAlerts.includes(a._id));

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const isCredit = (tx) => (tx.transactionType || tx.type) === 'credit';
  const txDescription = (tx) =>
    tx.description || tx.merchantName || tx.merchant || (isCredit(tx) ? 'Cash-In' : 'Payment');

  const inRange = (tx) => {
    if (historyRange === 'all') return true;
    const t = new Date(tx.createdAt || tx.timestamp).getTime();
    const now = Date.now();
    if (historyRange === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return t >= start.getTime();
    }
    if (historyRange === 'week') return t >= now - 7 * 864e5;
    if (historyRange === 'month') return t >= now - 30 * 864e5;
    return true;
  };

  const recentTx = transactions.slice(0, 5);
  const historyTx = transactions.filter(inRange);

  // Where a concern went, by department name (same names as the website)
  const areaLabel = (val) => DEPARTMENT_NAMES[String(val || '').trim().toLowerCase()] || val;

  const concernStatus = (c) => {
    const s = (c.status || '').toLowerCase();
    if (c.submissionType === 'feedback' || c.type === 'feedback') return { label: 'Received', color: theme.accent };
    if (s === 'resolved') return { label: 'Resolved', color: theme.success };
    return { label: 'Pending', color: theme.pending };
  };

  const getInitials = () =>
    `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';

  // ---- Reusable form pieces --------------------------------------------------

  const AreaSelector = ({ selected, onSelect }) => (
    <View style={styles.areaGrid}>
      {AREAS.map((a) => {
        const active = selected === a.value;
        const color = active ? theme.accent : theme.textSecondary;
        return (
          <TouchableOpacity
            key={a.value}
            style={[styles.areaCard, active && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
            onPress={() => onSelect(a.value)}
          >
            <a.Icon size={22} color={color} strokeWidth={2} />
            <Text style={[styles.areaLabel, active && { color: theme.accent }]}>{a.label}</Text>
            <Text style={styles.areaDesc}>{a.desc}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const MerchantPicker = ({ selected, onSelect }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>Select Merchant</Text>
      {loadingMerchants ? (
        <ActivityIndicator color={theme.accent} style={{ marginVertical: 12 }} />
      ) : merchants.length === 0 ? (
        <Text style={styles.sheetDesc}>No merchants available</Text>
      ) : (
        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {merchants.map((m) => {
            const active = selected === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                style={[styles.merchantRow, active && { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                onPress={() => onSelect(m.value)}
              >
                <Store size={16} color={active ? theme.accent : theme.textSecondary} />
                <Text style={[styles.merchantText, active && { color: theme.accent }]} numberOfLines={1}>{m.label}</Text>
                {active && <Check size={16} color={theme.accent} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  // ---- Tab content -----------------------------------------------------------

  const TransactionRow = ({ tx }) => {
    const credit = isCredit(tx);
    const Arrow = credit ? ArrowDownLeft : ArrowUpRight;
    const color = credit ? theme.success : theme.danger;
    return (
      <View style={styles.txCard}>
        <View style={[styles.txIcon, { backgroundColor: `${color}22` }]}>
          <Arrow size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txTitle} numberOfLines={1}>{txDescription(tx)}</Text>
          <Text style={styles.txDate}>{formatDate(tx.createdAt || tx.timestamp)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, { color }]}>
            {credit ? '+' : '-'}₱{(tx.amount || 0).toFixed(2)}
          </Text>
          {!!tx.status && <Text style={[styles.txStatus, { color: theme.textMuted }]}>{tx.status}</Text>}
        </View>
      </View>
    );
  };

  const renderHome = () => (
    <>
      {/* System alerts */}
      {visibleAlerts.map((a) => {
        const sev = ALERT_SEVERITY[a.severity] || ALERT_SEVERITY.info;
        return (
          <View key={a._id} style={[styles.alertCard, { backgroundColor: `${sev.color}14`, borderColor: `${sev.color}55` }]}>
            <View style={[styles.alertIconWrap, { backgroundColor: `${sev.color}22` }]}>
              <sev.Icon size={18} color={sev.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertMsg}>{a.message}</Text>
            </View>
            <TouchableOpacity onPress={() => dismissAlert(a._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceAmount}>
            {balanceVisible ? `₱${balance.toFixed(2)}` : '₱ •••••'}
          </Text>
          <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)} style={styles.eyeBtn}>
            {balanceVisible ? <EyeOff size={22} color={theme.textSecondary} /> : <Eye size={22} color={theme.textSecondary} />}
          </TouchableOpacity>
        </View>
        <View style={styles.balanceFooter}>
          <View style={styles.badge}>
            <GraduationCap size={14} color={theme.accent} />
            <Text style={styles.badgeText}>{user?.schoolUId || '—'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: user?.isActive ? `${theme.success}22` : `${theme.danger}22` }]}>
            {user?.isActive ? <CheckCircle2 size={14} color={theme.success} /> : <XCircle size={14} color={theme.danger} />}
            <Text style={[styles.badgeText, { color: user?.isActive ? theme.success : theme.danger }]}>
              {user?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.sendBtn} onPress={openTransfer} activeOpacity={0.85}>
          <Send size={16} color={theme.onAccent} />
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Recent trips (NU Shuttle Service) */}
      <View style={styles.tripsHeaderRow}>
        <Bus size={16} color={theme.accent} />
        <Text style={styles.sectionTitle}>Recent Trips Taken</Text>
      </View>
      {recentTrips.length === 0 ? (
        <EmptyState theme={theme} Icon={Navigation} text="No shuttle trips yet" />
      ) : (
        recentTrips.map((t, i) => (
          <View key={t.id || i} style={styles.tripRow}>
            <View style={styles.tripIcon}><Bus size={16} color={theme.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripName} numberOfLines={1}>{t.routeName}</Text>
              <Text style={styles.tripDate}>{formatDate(t.date)}</Text>
            </View>
          </View>
        ))
      )}

      {/* Quick actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionCard} onPress={() => setShowConcernModal(true)}>
          <ClipboardList size={26} color={theme.accent} />
          <Text style={styles.actionLabel}>Report a Concern</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => setShowFeedbackModal(true)}>
          <MessageSquare size={26} color={theme.accent} />
          <Text style={styles.actionLabel}>Share Feedback</Text>
        </TouchableOpacity>
      </View>

      {/* Recent transactions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => setActiveTab('history')} style={styles.seeAllBtn}>
          <Text style={styles.seeAll}>See all</Text>
          <ChevronRight size={16} color={theme.accent} />
        </TouchableOpacity>
      </View>
      {recentTx.length === 0 ? (
        <EmptyState theme={theme} Icon={Receipt} text="No transactions yet" />
      ) : (
        recentTx.map((tx, i) => <TransactionRow key={tx._id || i} tx={tx} />)
      )}
    </>
  );

  const renderHistory = () => (
    <>
      <Text style={styles.pageTitle}>Transaction History</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {RANGES.map((r) => {
          const active = historyRange === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => setHistoryRange(r.key)}
              style={[styles.rangePill, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
            >
              <Text style={[styles.rangePillText, active && { color: theme.onAccent }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {historyTx.length === 0 ? (
        <EmptyState theme={theme} Icon={Inbox} text="No transactions for this period" />
      ) : (
        historyTx.map((tx, i) => <TransactionRow key={tx._id || i} tx={tx} />)
      )}
    </>
  );

  const renderConcerns = () => (
    <>
      <Text style={styles.pageTitle}>My Concerns</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionCard} onPress={() => setShowConcernModal(true)}>
          <ClipboardList size={26} color={theme.accent} />
          <Text style={styles.actionLabel}>Report a Concern</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => setShowFeedbackModal(true)}>
          <MessageSquare size={26} color={theme.accent} />
          <Text style={styles.actionLabel}>Share Feedback</Text>
        </TouchableOpacity>
      </View>

      {concerns.length === 0 ? (
        <EmptyState theme={theme} Icon={CheckCircle2} text="You have no concerns or feedback yet" />
      ) : (
        concerns.map((c, i) => {
          const st = concernStatus(c);
          const isFeedback = c.submissionType === 'feedback' || c.type === 'feedback';
          const body = c.feedbackText || c.message || '';
          return (
            <View key={c._id || i} style={styles.concernCard}>
              <View style={styles.concernTop}>
                <View style={[styles.concernBadge, { backgroundColor: `${st.color}22` }]}>
                  <Text style={[styles.concernBadgeText, { color: st.color }]}>{st.label}</Text>
                </View>
                <View style={styles.concernTypeWrap}>
                  {isFeedback ? <MessageSquare size={13} color={theme.textSecondary} /> : <ClipboardList size={13} color={theme.textSecondary} />}
                  <Text style={styles.concernType}>{isFeedback ? 'Feedback' : 'Concern'}</Text>
                </View>
                <Text style={styles.concernDate}>{formatDate(c.createdAt)}</Text>
              </View>

              {!!c.subject && <Text style={styles.concernSubject}>{c.subject}</Text>}
              {!!c.reportTo && <Text style={styles.concernArea}>To: {areaLabel(c.reportTo)}</Text>}
              {isFeedback && !!c.rating && (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} color={theme.accent} fill={n <= c.rating ? theme.accent : 'transparent'} />
                  ))}
                </View>
              )}
              {!!body && <Text style={styles.concernMsg}>{body}</Text>}

              {!!c.response && (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Response</Text>
                  <Text style={styles.responseText}>{c.response}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </>
  );

  const renderPromos = () => <PromosTab promos={promos} trips={trips} theme={theme} />;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const visibleTabs = [
    { key: 'home', Icon: Home, label: 'Home' },
    { key: 'history', Icon: History, label: 'History' },
    ...(promoTabEnabled ? [{ key: 'promos', Icon: Gift, label: 'Promos' }] : []),
    { key: 'concerns', Icon: ClipboardList, label: 'Concerns' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']} onTouchStart={markActive}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBg} />
      <IdleSignOut theme={theme} onSignOut={signOutIdle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoSquare}>
            <Text style={styles.logoText}>NU</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>NUCash System</Text>
            <Text style={styles.headerSubtitle}>STUDENT PORTAL</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme}>
            {isDark ? <Sun size={18} color={theme.accent} /> : <Moon size={18} color={theme.accent} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfileModal(true)}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab nav */}
      <View style={styles.tabBar}>
        {visibleTabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && { backgroundColor: theme.accent }]}
              onPress={() => setActiveTab(t.key)}
            >
              <t.Icon size={15} color={active ? theme.onAccent : theme.textSecondary} />
              <Text style={[styles.tabLabel, active && { color: theme.onAccent }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'home' && renderHome()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'promos' && renderPromos()}
        {activeTab === 'concerns' && renderConcerns()}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Profile Modal */}
      <ActivityModal visible={showProfileModal} animationType="slide" transparent onRequestClose={() => setShowProfileModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowProfileModal(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{getInitials()}</Text>
              </View>
              <Text style={styles.profileName}>{user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <View style={styles.profileChips}>
                <View style={styles.badge}><GraduationCap size={14} color={theme.accent} /><Text style={styles.badgeText}>{user?.schoolUId || '—'}</Text></View>
                <View style={styles.badge}><Text style={styles.badgeText}>{user?.accountType === 'employee' ? 'Employee' : 'Student'}</Text></View>
              </View>
            </View>

            <TouchableOpacity style={styles.profileAction} onPress={() => { setShowProfileModal(false); setShowChangePinModal(true); }}>
              <KeyRound size={18} color={theme.text} />
              <Text style={styles.profileActionText}>Change PIN</Text>
              <ChevronRight size={18} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.profileAction, { borderColor: `${theme.danger}55` }]} onPress={() => { setShowProfileModal(false); setShowDeactivateModal(true); }}>
              <AlertTriangle size={18} color={theme.danger} />
              <Text style={[styles.profileActionText, { color: theme.danger }]}>Deactivate Account</Text>
              <ChevronRight size={18} color={theme.danger} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.profileAction, { borderColor: `${theme.danger}55` }]} onPress={() => { setShowProfileModal(false); navigation.replace('Login'); }}>
              <LogOut size={18} color={theme.danger} />
              <Text style={[styles.profileActionText, { color: theme.danger }]}>Logout</Text>
              <ChevronRight size={18} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ActivityModal>

      {/* Concern Modal */}
      <ActivityModal visible={showConcernModal} animationType="slide" transparent onRequestClose={() => setShowConcernModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowConcernModal(false)}>
          <View style={[styles.sheet, { maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Report a Concern</Text>
              <TouchableOpacity onPress={() => setShowConcernModal(false)}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Which area is this about?</Text>
              <AreaSelector selected={concernArea} onSelect={(v) => { setConcernArea(v); setConcernMerchant(''); }} />

              {concernArea === 'merchants' && <MerchantPicker selected={concernMerchant} onSelect={setConcernMerchant} />}

              <Text style={styles.fieldLabel}>Subject</Text>
              <TextInput
                style={styles.inputSingle}
                placeholder="Brief subject"
                placeholderTextColor={theme.textMuted}
                value={concernSubject}
                onChangeText={setConcernSubject}
              />

              <Text style={styles.fieldLabel}>Details</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe your concern..."
                placeholderTextColor={theme.textMuted}
                multiline
                value={concernDetails}
                onChangeText={setConcernDetails}
                textAlignVertical="top"
              />

              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmitConcern} disabled={submitting}>
                <Text style={styles.primaryBtnText}>{submitting ? 'Submitting...' : 'Submit Concern'}</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </ActivityModal>

      {/* Feedback Modal */}
      <ActivityModal visible={showFeedbackModal} animationType="slide" transparent onRequestClose={() => setShowFeedbackModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFeedbackModal(false)}>
          <View style={[styles.sheet, { maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Share Feedback</Text>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                <X size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Which area is this about?</Text>
              <AreaSelector selected={feedbackArea} onSelect={(v) => { setFeedbackArea(v); setFeedbackMerchant(''); }} />

              {feedbackArea === 'merchants' && <MerchantPicker selected={feedbackMerchant} onSelect={setFeedbackMerchant} />}

              <Text style={styles.fieldLabel}>Rate your experience</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setFeedbackRating(n)}>
                    <Star size={34} color={theme.accent} fill={n <= feedbackRating ? theme.accent : 'transparent'} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Subject (optional)</Text>
              <TextInput
                style={styles.inputSingle}
                placeholder="Brief subject"
                placeholderTextColor={theme.textMuted}
                value={feedbackSubject}
                onChangeText={setFeedbackSubject}
              />

              <Text style={styles.fieldLabel}>Your feedback</Text>
              <TextInput
                style={styles.input}
                placeholder="Tell us how we can improve..."
                placeholderTextColor={theme.textMuted}
                multiline
                value={feedbackText}
                onChangeText={setFeedbackText}
                textAlignVertical="top"
              />

              <TouchableOpacity style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmitFeedback} disabled={submitting}>
                <Text style={styles.primaryBtnText}>{submitting ? 'Submitting...' : 'Send Feedback'}</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </ActivityModal>

      {/* Send Money (student-to-student) */}
      <SendMoneyModal
        visible={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        theme={theme}
        balance={balance}
        onSuccess={(newBalance) => { if (typeof newBalance === 'number') setBalance(newBalance); fetchDashboardData(true); }}
        onLockedSignOut={signOutAfterLock}
      />

      <ChangePinModal visible={showChangePinModal} onClose={() => setShowChangePinModal(false)} userEmail={userEmail} userId={userId} />
      <DeactivateAccountModal visible={showDeactivateModal} onClose={() => setShowDeactivateModal(false)} userEmail={userEmail} userId={userId} />
    </SafeAreaView>
  );
}

const EmptyState = ({ theme, Icon, text }) => (
  <View style={{ alignItems: 'center', paddingVertical: 36 }}>
    <Icon size={40} color={theme.textMuted} strokeWidth={1.5} />
    <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 10 }}>{text}</Text>
  </View>
);

const makeStyles = (t) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: t.textSecondary, marginTop: 12, fontSize: 14 },

    // Header
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.headerBg,
      borderBottomWidth: 2, borderBottomColor: t.accent,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoSquare: { width: 42, height: 42, borderRadius: 10, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
    logoText: { color: t.onAccent, fontWeight: '800', fontSize: 18 },
    headerTitle: { color: t.text, fontSize: 17, fontWeight: '700' },
    headerSubtitle: { color: t.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.accentSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.accent },
    avatarBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: t.onAccent, fontWeight: '800', fontSize: 14 },

    // Tabs
    tabBar: { flexDirection: 'row', gap: 6, margin: 12, padding: 6, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
    tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
    tabLabel: { color: t.textSecondary, fontSize: 12.5, fontWeight: '700' },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 14, paddingTop: 2 },

    // Balance
    balanceCard: { backgroundColor: t.cardSolid, borderRadius: 18, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: t.border },
    balanceLabel: { color: t.textSecondary, fontSize: 13, fontWeight: '600' },
    balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    balanceAmount: { color: t.accent, fontSize: 34, fontWeight: '800' },
    eyeBtn: { marginLeft: 12, padding: 4 },
    balanceFooter: { flexDirection: 'row', gap: 8, marginTop: 16 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    badgeText: { color: t.accent, fontSize: 12, fontWeight: '700' },

    // Actions
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    actionCard: { flex: 1, backgroundColor: t.card, borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: t.border },
    actionLabel: { color: t.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },

    // Sections
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { color: t.text, fontSize: 16, fontWeight: '800' },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    seeAll: { color: t.accent, fontSize: 13, fontWeight: '700' },
    pageTitle: { color: t.text, fontSize: 20, fontWeight: '800', marginBottom: 14, marginTop: 2 },

    // Range pills
    rangePill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
    rangePillText: { color: t.textSecondary, fontSize: 13, fontWeight: '700' },

    // Transactions
    txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: t.border },
    txIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    txTitle: { color: t.text, fontSize: 14, fontWeight: '700' },
    txDate: { color: t.textMuted, fontSize: 12, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '800' },
    txStatus: { fontSize: 11, marginTop: 2 },

    // Concerns
    concernCard: { backgroundColor: t.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
    concernTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    concernBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    concernBadgeText: { fontSize: 11, fontWeight: '800' },
    concernTypeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    concernType: { color: t.textSecondary, fontSize: 12, fontWeight: '600' },
    concernDate: { color: t.textMuted, fontSize: 11, marginLeft: 'auto' },
    concernSubject: { color: t.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
    concernArea: { color: t.accent, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    ratingRow: { flexDirection: 'row', gap: 2, marginBottom: 6 },
    concernMsg: { color: t.text, fontSize: 14, lineHeight: 20 },
    responseBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: t.accentSoft },
    responseLabel: { color: t.accent, fontSize: 11, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
    responseText: { color: t.text, fontSize: 13, lineHeight: 19 },

    // Modal / sheet
    overlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
    sheet: { backgroundColor: t.isDark ? '#181D40' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, borderTopWidth: 2, borderColor: t.accent },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sheetTitle: { color: t.text, fontSize: 18, fontWeight: '800' },
    sheetDesc: { color: t.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 19 },
    fieldLabel: { color: t.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    input: { backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB', borderRadius: 12, borderWidth: 1, borderColor: t.border, color: t.text, padding: 14, fontSize: 14, minHeight: 110, marginBottom: 16 },
    inputSingle: { backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB', borderRadius: 12, borderWidth: 1, borderColor: t.border, color: t.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 16 },
    primaryBtn: { backgroundColor: t.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    primaryBtnText: { color: t.onAccent, fontSize: 15, fontWeight: '800' },
    starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },

    // Area selector
    areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    areaCard: { width: '47%', backgroundColor: t.card, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: t.border, gap: 6 },
    areaLabel: { color: t.text, fontSize: 14, fontWeight: '800' },
    areaDesc: { color: t.textMuted, fontSize: 11, lineHeight: 15 },

    // Merchant picker
    merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6, borderWidth: 1.5, borderColor: t.border },
    merchantText: { color: t.text, fontSize: 13, fontWeight: '600', flex: 1 },

    // Profile
    profileInfo: { alignItems: 'center', marginBottom: 20 },
    profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    profileAvatarText: { color: t.onAccent, fontSize: 28, fontWeight: '800' },
    profileName: { color: t.text, fontSize: 18, fontWeight: '800' },
    profileEmail: { color: t.textSecondary, fontSize: 13, marginTop: 4 },
    profileChips: { flexDirection: 'row', gap: 8, marginTop: 12 },
    profileAction: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: t.border },
    profileActionText: { color: t.text, fontSize: 15, fontWeight: '700', flex: 1 },

    // System alerts
    alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 12 },
    alertIconWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    alertTitle: { color: t.text, fontSize: 13, fontWeight: '800' },
    alertMsg: { color: t.textSecondary, fontSize: 13, marginTop: 1 },

    // Send button (balance card)
    sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: t.accent, borderRadius: 12, paddingVertical: 12, marginTop: 16 },
    sendBtnText: { color: t.onAccent, fontSize: 14, fontWeight: '800' },

    // Recent trips
    tripsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10 },
    tripRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: t.border },
    tripIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: t.accentSoft, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    tripName: { color: t.text, fontSize: 14, fontWeight: '700' },
    tripDate: { color: t.textMuted, fontSize: 12, marginTop: 2 },

    // Transfer modal
    tSendIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.accentSoft, justifyContent: 'center', alignItems: 'center' },
    tStepText: { color: t.textSecondary, fontSize: 12 },
    tErr: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 14 },
    tErrText: { color: t.danger, fontSize: 13, flex: 1 },
    tHint: { color: t.textMuted, fontSize: 12, marginTop: 10 },
    tSearchBtn: { width: 52, borderRadius: 12, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
    tRecipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: t.border },
    tRecipAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center' },
    tRecipInitials: { color: t.onAccent, fontWeight: '800', fontSize: 15 },
    tRecipName: { color: t.text, fontSize: 15, fontWeight: '800' },
    tRecipMeta: { color: t.textSecondary, fontSize: 12, marginTop: 1 },
    tChange: { color: t.accent, fontSize: 12, fontWeight: '800' },
    tBalRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    tBalBox: { flex: 1, backgroundColor: t.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border },
    tBalLabel: { color: t.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    tBalValue: { color: t.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
    tAmtRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB', borderRadius: 12, borderWidth: 1, borderColor: t.border, paddingHorizontal: 14, marginBottom: 20 },
    tPeso: { color: t.textSecondary, fontSize: 20, fontWeight: '800', marginRight: 4 },
    tAmtInput: { flex: 1, color: t.text, fontSize: 20, fontWeight: '800', paddingVertical: 12 },
    tBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: t.accent, borderRadius: 12, paddingVertical: 15, marginTop: 4 },
    tBtnText: { color: t.onAccent, fontSize: 15, fontWeight: '800' },
    tGhost: { flex: 1, backgroundColor: t.isDark ? 'rgba(71,85,105,0.5)' : '#E5E7EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    tGhostText: { color: t.text, fontSize: 15, fontWeight: '700' },
    tShield: { width: 56, height: 56, borderRadius: 16, backgroundColor: t.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    tPinPrompt: { color: t.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    tPinInput: { backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : '#F4F7FB', borderRadius: 12, borderWidth: 1, borderColor: t.border, color: t.text, textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 10, paddingVertical: 12, marginBottom: 20 },
    tSuccessIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    tSuccessTitle: { color: t.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
    tSuccessMsg: { color: t.textSecondary, fontSize: 14, marginBottom: 16, textAlign: 'center' },
    tNewBal: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 18 },
    tNewBalText: { color: t.textSecondary, fontSize: 13 },
  });

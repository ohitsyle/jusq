// src/screens/SendMoneyModal.js
// Send Money (student app) — same flow as the web portal:
// recipient (tap their card / favorites / recent / school ID) -> amount -> review
// -> PIN -> result (reference no., add to favorites). The server enforces the
// ₱5,000 daily limit and locks the account after 3 wrong PINs.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import {
  Send, X, Star, Clock, ArrowRight, ArrowLeft, CheckCircle2, XCircle, Lock, ShieldCheck,
  AlertOctagon, Zap, Mail, SmartphoneNfc, ChevronRight,
} from 'lucide-react-native';
import api from '../services/api';
import NFCService from '../services/NFCService';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n) => Math.round(n * 100) / 100;
const initials = (p) => ((p?.firstName?.[0] || '') + (p?.lastName?.[0] || '')).toUpperCase() || '?';
const when = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// School ID formats: students ####-###### (default), employees ##-######
const ID_FORMATS = { long: { groups: [4, 6], example: '2023-123456' }, short: { groups: [2, 6], example: '23-123456' } };
const idLength = (fmt) => ID_FORMATS[fmt].groups[0] + ID_FORMATS[fmt].groups[1];
const formatId = (digits, fmt) => {
  const [a] = ID_FORMATS[fmt].groups;
  return digits.length > a ? `${digits.slice(0, a)}-${digits.slice(a)}` : digits;
};
const displayId = (id) => {
  const d = String(id || '');
  return d.length === 10 ? formatId(d, 'long') : d.length === 8 ? formatId(d, 'short') : d;
};

const STEPS = ['recipient', 'amount', 'review', 'pin'];
const STEP_LABELS = { recipient: 'Recipient', amount: 'Amount', review: 'Review', pin: 'Confirm' };
const QUICK = [50, 100, 200, 500];

export default function SendMoneyModal({ visible, onClose, theme: t, balance: balanceProp, onSuccess, onLockedSignOut }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const [step, setStep] = useState('recipient');
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [idFmt, setIdFmt] = useState('long');
  const [idDigits, setIdDigits] = useState('');
  const [lookup, setLookup] = useState({ state: 'idle' }); // idle | loading | found | error
  const [scanning, setScanning] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const pinRef = useRef(null);

  const balance = overview?.balance ?? balanceProp ?? 0;
  const remainingToday = overview?.remainingToday ?? 5000;
  const dailyLimit = overview?.dailyLimit ?? 5000;
  const maxSendable = round2(Math.min(balance, remainingToday));
  const amt = round2(parseFloat(amount) || 0);
  const balanceAfter = round2(balance - amt);

  // Fresh start every time the sheet opens
  useEffect(() => {
    if (!visible) { NFCService.cancelScan().catch(() => {}); setScanning(false); return; }
    setStep('recipient'); setIdFmt('long'); setIdDigits(''); setLookup({ state: 'idle' }); setRecipient(null);
    setAmount(''); setPin(''); setPinError(''); setResult(null); setSending(false);
    setLoadingOverview(true);
    api.get('/user/transfer/overview')
      .then((r) => { setOverview(r.data); setAttemptsLeft(r.data?.attemptsLeft ?? 3); })
      .catch(() => setOverview(null))
      .finally(() => setLoadingOverview(false));
  }, [visible]);

  // Look the school ID up as soon as it's complete
  useEffect(() => {
    // Typing clears old messages; an empty field keeps a card-tap message visible.
    if (idDigits.length !== idLength(idFmt)) { if (idDigits.length) setLookup({ state: 'idle' }); return; }
    let alive = true;
    setLookup({ state: 'loading' });
    api.get(`/user/lookup/${idDigits}`)
      .then((r) => {
        if (!alive) return;
        const d = r.data;
        if (d?.found) setLookup({ state: 'found', peer: { ...d, displayId: formatId(d.schoolUId, idFmt) } });
        else setLookup({ state: 'error', message: d?.self ? "That's your own school ID." : d?.inactive ? 'That account is not active.' : 'No one found with that school ID.' });
      })
      .catch((e) => alive && setLookup({ state: 'error', message: e?.response?.data?.error || 'Lookup failed. Please try again.' }));
    return () => { alive = false; };
  }, [idDigits, idFmt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (step === 'pin') setTimeout(() => pinRef.current?.focus(), 250); }, [step]);

  const amountError = useMemo(() => {
    if (!amount) return '';
    if (amt <= 0) return 'Enter an amount greater than ₱0.';
    if (amt > balance) return `That's more than your balance (${peso(balance)}).`;
    if (amt > remainingToday) return remainingToday > 0 ? `Over your daily limit — you can send ${peso(remainingToday)} more today.` : `You've reached today's ${peso(dailyLimit)} sending limit.`;
    return '';
  }, [amount, amt, balance, remainingToday, dailyLimit]);

  const chooseRecipient = (peer) => { setRecipient(peer); setAmount(''); setStep('amount'); };

  const pickSaved = async (peer) => {
    try {
      const r = await api.get(`/user/lookup/${peer.schoolUId}`);
      if (r.data?.found) chooseRecipient({ ...r.data, displayId: peer.displayId || displayId(peer.schoolUId) });
      else setLookup({ state: 'error', message: `${peer.fullName} can't receive money right now.` });
    } catch (e) { setLookup({ state: 'error', message: e?.response?.data?.error || 'Lookup failed. Please try again.' }); }
  };

  // "Tap their card": read the recipient's school ID with this phone's NFC
  const tapCard = async () => {
    setLookup({ state: 'idle' });
    const ok = await NFCService.init();
    if (!ok) { setLookup({ state: 'error', message: "This phone can't read cards (no NFC). Enter their school ID instead." }); return; }
    if (!(await NFCService.isEnabled())) {
      Alert.alert('Turn on NFC', 'Turn on NFC in your phone settings, then tap their card again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => NfcManager.goToNfcSetting?.().catch(() => {}) },
      ]);
      return;
    }
    setScanning(true);
    const read = await NFCService.readRFIDCard();
    setScanning(false);
    if (!read.success) {
      if (!/cancel/i.test(read.error || '')) setLookup({ state: 'error', message: "Couldn't read the card. Hold it still against the back of your phone and try again." });
      return;
    }
    setLookup({ state: 'loading' });
    try {
      const r = await api.get(`/user/lookup-card/${read.uid}`);
      const d = r.data;
      if (d?.found) { setLookup({ state: 'idle' }); chooseRecipient(d); }
      else setLookup({ state: 'error', message: d?.self ? "That's your own card." : d?.inactive ? "That card's account isn't active." : "That card isn't registered to NUCash." });
    } catch (e) { setLookup({ state: 'error', message: e?.response?.data?.error || 'Lookup failed. Please try again.' }); }
  };

  const cancelScan = async () => { await NFCService.cancelScan().catch(() => {}); setScanning(false); };

  const onIdChange = (raw) => {
    if (idFmt === 'long' && /^\d{2}-$/.test(raw)) { setIdFmt('short'); setIdDigits(raw.slice(0, 2)); return; }
    setIdDigits(raw.replace(/\D/g, '').slice(0, idLength(idFmt)));
  };

  const send = async (fullPin) => {
    if (sending) return;
    setSending(true); setPinError('');
    try {
      const r = await api.post('/user/transfer', { recipientSchoolId: recipient.schoolUId, amount: amt, pin: fullPin });
      if (r.data?.success) { setResult({ status: 'success', ...r.data }); setStep('result'); onSuccess && onSuccess(r.data.newBalance); }
      else { setResult({ status: 'failed', message: r.data?.error || 'Transfer failed.' }); setStep('result'); }
    } catch (e) {
      const d = e?.response?.data || {};
      if (d.locked) { setResult({ status: 'locked', message: d.error }); setStep('result'); }
      else if (d.attemptsLeft !== undefined) { setAttemptsLeft(d.attemptsLeft); setPinError(d.error); setPin(''); setTimeout(() => pinRef.current?.focus(), 150); }
      else { setResult({ status: 'failed', message: d.error || 'Transfer failed. Check your connection and try again.' }); setStep('result'); }
    } finally { setSending(false); }
  };

  const onPinChange = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 6);
    setPin(d); setPinError('');
    if (d.length === 6) send(d);
  };

  const toggleFavorite = async () => {
    if (!result?.to || favBusy) return;
    setFavBusy(true);
    try {
      const r = result.isFavorite
        ? await api.delete(`/user/transfer/favorites/${result.to.schoolUId}`)
        : await api.post('/user/transfer/favorites', { schoolUId: result.to.schoolUId });
      setResult((x) => ({ ...x, isFavorite: !!r.data?.isFavorite }));
    } catch { /* keep state */ } finally { setFavBusy(false); }
  };

  const close = () => {
    if (sending) return;
    NFCService.cancelScan().catch(() => {});
    if (result?.status === 'locked') onLockedSignOut && onLockedSignOut();
    else onClose();
  };

  const stepIndex = STEPS.indexOf(step);
  const peerLine = (p) => `${p.displayId || displayId(p.schoolUId)} • ${p.accountType === 'employee' ? 'Employee' : 'Student'}`;

  const Avatar = ({ peer, size = 44 }) => (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.34 }]}>{initials(peer)}</Text>
    </View>
  );
  const Row = ({ label, children, last }) => (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
  const Primary = ({ label, onPress, disabled, Icon, flex = true }) => (
    <TouchableOpacity style={[s.primary, flex && { flex: 1 }, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      {Icon ? <Icon size={18} color={t.onAccent} /> : null}
      <Text style={s.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
  const Ghost = ({ label, onPress, disabled }) => (
    <TouchableOpacity style={[s.ghost, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <ArrowLeft size={16} color={t.text} />
      <Text style={s.ghostText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={s.headerIcon}><Send size={18} color={t.accent} /></View>
              <View>
                <Text style={s.title}>Send Money</Text>
                <Text style={s.subtitle}>{step === 'result' ? 'Transfer summary' : `Balance ${peso(balance)}`}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={close} disabled={sending} hitSlop={10}><X size={22} color={t.textSecondary} /></TouchableOpacity>
          </View>
          {step !== 'result' && (
            <View style={s.progress}>
              {STEPS.map((k, i) => (
                <View key={k} style={{ flex: 1 }}>
                  <View style={[s.bar, { backgroundColor: i <= stepIndex ? t.accent : t.accentSoft }]} />
                  <Text style={[s.barLabel, i === stepIndex && { color: t.accent }]}>{STEP_LABELS[k]}</Text>
                </View>
              ))}
            </View>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12 }}>
            {/* ---------- 1. RECIPIENT ---------- */}
            {step === 'recipient' && (scanning ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 14 }}>
                <View style={s.scanRing}><SmartphoneNfc size={40} color={t.accent} /></View>
                <Text style={s.scanTitle}>Hold their school ID to the back of your phone</Text>
                <Text style={s.hint}>Keep it still until the phone vibrates or their name appears.</Text>
                <ActivityIndicator color={t.accent} />
                <TouchableOpacity style={s.ghostFull} onPress={cancelScan}><Text style={s.ghostText}>Cancel</Text></TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 18 }}>
                <TouchableOpacity style={s.tapCard} onPress={tapCard} activeOpacity={0.85}>
                  <View style={s.tapIcon}><SmartphoneNfc size={24} color={t.onAccent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tapTitle}>Tap their card</Text>
                    <Text style={s.tapSub}>Hold their school ID to your phone</Text>
                  </View>
                  <ChevronRight size={20} color={t.accent} />
                </TouchableOpacity>

                {loadingOverview && <ActivityIndicator color={t.accent} />}

                {overview?.favorites?.length > 0 && (
                  <View>
                    <View style={s.sectionHead}><Star size={13} color={t.accent} fill={t.accent} /><Text style={s.sectionLabel}>Favorites</Text></View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                      {overview.favorites.map((p) => (
                        <TouchableOpacity key={p.schoolUId} onPress={() => pickSaved(p)} style={{ alignItems: 'center', width: 62, gap: 6 }}>
                          <Avatar peer={p} size={48} />
                          <Text style={s.favName} numberOfLines={1}>{p.firstName}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {overview?.recents?.length > 0 && (
                  <View>
                    <View style={s.sectionHead}><Clock size={13} color={t.textSecondary} /><Text style={s.sectionLabel}>Recent</Text></View>
                    <View style={s.list}>
                      {overview.recents.map((p, i) => (
                        <TouchableOpacity key={p.schoolUId} onPress={() => pickSaved(p)} style={[s.listRow, i > 0 && s.listDivider]}>
                          <Avatar peer={p} size={36} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.listName} numberOfLines={1}>{p.fullName}{p.isFavorite ? ' ★' : ''}</Text>
                            <Text style={s.listMeta}>{p.displayId} • last sent {peso(p.lastAmount)}</Text>
                          </View>
                          <ArrowRight size={16} color={t.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ gap: 8 }}>
                  <View style={s.idHead}>
                    <Text style={s.sectionLabel}>Or enter their school ID</Text>
                    <View style={s.pills}>
                      {Object.entries(ID_FORMATS).map(([k, f]) => (
                        <TouchableOpacity key={k} onPress={() => { setIdFmt(k); setIdDigits((d) => d.slice(0, idLength(k))); }} style={[s.pill, idFmt === k && { backgroundColor: t.accent }]}>
                          <Text style={[s.pillText, idFmt === k && { color: t.onAccent }]}>{f.example}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TextInput
                    style={[s.idInput, lookup.state === 'error' && { borderColor: t.danger }]}
                    value={formatId(idDigits, idFmt)}
                    onChangeText={onIdChange}
                    placeholder={ID_FORMATS[idFmt].example}
                    placeholderTextColor={t.textMuted}
                    keyboardType="numbers-and-punctuation"
                    autoCorrect={false}
                  />
                  {lookup.state === 'loading' && <View style={s.inline}><ActivityIndicator size="small" color={t.accent} /><Text style={s.hint}>Looking up…</Text></View>}
                  {lookup.state === 'error' && <View style={s.inline}><AlertOctagon size={15} color={t.danger} /><Text style={[s.hint, { color: t.danger, flex: 1 }]}>{lookup.message}</Text></View>}
                  {lookup.state === 'idle' && <Text style={s.hint}>Enter all {idLength(idFmt)} digits — we'll show who it belongs to before you send.</Text>}
                  {lookup.state === 'found' && (
                    <TouchableOpacity style={s.found} onPress={() => chooseRecipient(lookup.peer)} activeOpacity={0.85}>
                      <Avatar peer={lookup.peer} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.listName}>{lookup.peer.fullName}</Text>
                        <Text style={s.listMeta}>{peerLine(lookup.peer)}</Text>
                      </View>
                      <Text style={s.nextText}>Next</Text>
                      <ArrowRight size={16} color={t.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* ---------- 2. AMOUNT ---------- */}
            {step === 'amount' && recipient && (
              <View style={{ gap: 14 }}>
                <View style={s.recipRow}>
                  <Avatar peer={recipient} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.smallCaps}>Sending to</Text>
                    <Text style={s.listName} numberOfLines={1}>{recipient.fullName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setStep('recipient')}><Text style={s.nextText}>Change</Text></TouchableOpacity>
                </View>

                <View>
                  <Text style={s.sectionLabel}>Amount</Text>
                  <View style={[s.amtBox, !!amountError && { borderColor: t.danger }]}>
                    <Text style={s.amtPeso}>₱</Text>
                    <TextInput style={s.amtInput} value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} placeholder="0.00" placeholderTextColor={t.textMuted} keyboardType="decimal-pad" autoFocus />
                  </View>
                  <View style={s.quickRow}>
                    {QUICK.map((q) => (
                      <TouchableOpacity key={q} onPress={() => setAmount(String(q))} disabled={q > maxSendable} style={[s.quick, amt === q && { backgroundColor: t.accent }, q > maxSendable && { opacity: 0.3 }]}>
                        <Text style={[s.quickText, amt === q && { color: t.onAccent }]}>₱{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {!!amountError && <View style={[s.inline, { marginTop: 8 }]}><AlertOctagon size={15} color={t.danger} /><Text style={[s.hint, { color: t.danger, flex: 1 }]}>{amountError}</Text></View>}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={s.balBox}><Text style={s.smallCaps}>Balance now</Text><Text style={s.balValue}>{peso(balance)}</Text></View>
                  <View style={s.balBox}><Text style={s.smallCaps}>Balance after</Text><Text style={[s.balValue, { color: balanceAfter < 0 ? t.danger : t.success }]}>{peso(balanceAfter)}</Text></View>
                </View>

                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={s.tiny}>Sent today {peso(dailyLimit - remainingToday)}</Text>
                    <Text style={s.tiny}>Daily limit {peso(dailyLimit)}</Text>
                  </View>
                  <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, ((dailyLimit - remainingToday + (amountError ? 0 : amt)) / dailyLimit) * 100)}%` }]} /></View>
                </View>

                <View style={s.btnRow}>
                  <Ghost label="Back" onPress={() => setStep('recipient')} />
                  <Primary label="Review" Icon={ArrowRight} onPress={() => setStep('review')} disabled={!(amt > 0) || !!amountError} />
                </View>
              </View>
            )}

            {/* ---------- 3. REVIEW ---------- */}
            {step === 'review' && recipient && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.smallCaps}>You're sending</Text>
                  <Text style={s.bigAmount}>{peso(amt)}</Text>
                </View>
                <View style={s.card}>
                  <Row label="To"><Text style={s.rowValue}>{recipient.fullName}</Text><Text style={s.rowSub}>{peerLine(recipient)}</Text></Row>
                  <Row label="From"><Text style={s.rowValue}>{overview?.me?.fullName || 'You'}</Text><Text style={s.rowSub}>{overview?.me?.displayId || ''}</Text></Row>
                  <Row label="Arrives"><View style={s.inline}><Zap size={14} color={t.success} /><Text style={s.rowValue}>Immediately</Text></View></Row>
                  <Row label="Your balance after" last><Text style={s.rowValue}>{peso(balanceAfter)}</Text></Row>
                </View>
                <View style={s.warn}>
                  <AlertOctagon size={16} color={t.pending} />
                  <Text style={s.warnText}>The money moves the moment you confirm and can't be undone. Make sure <Text style={{ fontWeight: '800' }}>{recipient.fullName}</Text> is the right person.</Text>
                </View>
                <View style={s.btnRow}>
                  <Ghost label="Back" onPress={() => setStep('amount')} />
                  <Primary label="Transfer now" Icon={Send} onPress={() => { setPin(''); setPinError(''); setStep('pin'); }} />
                </View>
              </View>
            )}

            {/* ---------- 4. PIN ---------- */}
            {step === 'pin' && recipient && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <View style={s.shield}><ShieldCheck size={28} color={t.accent} /></View>
                  <Text style={s.scanTitle}>Enter your 6-digit PIN</Text>
                  <Text style={s.hint}>to send <Text style={{ color: t.text, fontWeight: '800' }}>{peso(amt)}</Text> to <Text style={{ color: t.text, fontWeight: '800' }}>{recipient.fullName}</Text></Text>
                </View>
                <TouchableOpacity activeOpacity={1} onPress={() => pinRef.current?.focus()}>
                  <View style={s.pinRow}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <View key={i} style={[s.pinBox, { borderColor: pinError ? t.danger : i === pin.length && !sending ? t.accent : t.border }]}>
                        <Text style={s.pinDot}>{pin[i] ? '•' : ''}</Text>
                      </View>
                    ))}
                  </View>
                  <TextInput
                    ref={pinRef}
                    value={pin}
                    onChangeText={onPinChange}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    editable={!sending}
                    caretHidden
                    style={s.hiddenInput}
                  />
                </TouchableOpacity>
                <View style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
                  {sending && <View style={s.inline}><ActivityIndicator size="small" color={t.accent} /><Text style={s.hint}>Sending…</Text></View>}
                  {!sending && !!pinError && <Text style={[s.hint, { color: t.danger, fontWeight: '700', textAlign: 'center' }]}>{pinError}</Text>}
                  {!sending && !pinError && attemptsLeft < 3 && <Text style={[s.hint, { color: t.pending, textAlign: 'center' }]}>{attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left before your account is locked for 30 minutes.</Text>}
                </View>
                <Ghost label="Back" onPress={() => setStep('review')} disabled={sending} />
              </View>
            )}

            {/* ---------- 5. RESULT ---------- */}
            {step === 'result' && result?.status === 'success' && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[s.resultIcon, { backgroundColor: `${t.success}22` }]}><CheckCircle2 size={36} color={t.success} /></View>
                  <Text style={[s.smallCaps, { color: t.success }]}>Transfer successful</Text>
                  <Text style={s.bigAmount}>{peso(result.amount)}</Text>
                </View>
                <View style={s.card}>
                  <Row label="To"><Text style={s.rowValue}>{result.to?.fullName}</Text><Text style={s.rowSub}>{result.to?.displayId}</Text></Row>
                  <Row label="From"><Text style={s.rowValue}>{result.from?.fullName}</Text><Text style={s.rowSub}>{result.from?.displayId}</Text></Row>
                  <Row label="Reference no."><Text style={[s.rowValue, s.mono]} selectable>{result.referenceNo}</Text></Row>
                  <Row label="Date & time"><Text style={s.rowValue}>{when(result.sentAt)}</Text></Row>
                  <Row label="New balance" last><Text style={s.rowValue}>{peso(result.newBalance)}</Text></Row>
                </View>
                <TouchableOpacity style={[s.favBtn, result.isFavorite && { backgroundColor: t.accentSoft }]} onPress={toggleFavorite} disabled={favBusy}>
                  <Star size={16} color={t.accent} fill={result.isFavorite ? t.accent : 'transparent'} />
                  <Text style={s.favText}>{result.isFavorite ? `${result.to?.firstName} is in your favorites` : `Add ${result.to?.firstName} to favorites`}</Text>
                </TouchableOpacity>
                <View style={[s.inline, { justifyContent: 'center' }]}><Mail size={14} color={t.textSecondary} /><Text style={s.hint}>We emailed a receipt to you and {result.to?.firstName}.</Text></View>
                <Primary label="Close" onPress={onClose} flex={false} />
              </View>
            )}

            {step === 'result' && result?.status === 'failed' && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[s.resultIcon, { backgroundColor: `${t.danger}22` }]}><XCircle size={36} color={t.danger} /></View>
                  <Text style={[s.smallCaps, { color: t.danger }]}>Transfer failed</Text>
                  <Text style={s.bigAmount}>{peso(amt)}</Text>
                </View>
                <View style={[s.card, { padding: 14 }]}><Text style={[s.rowValue, { textAlign: 'center' }]}>{result.message}</Text></View>
                <View style={s.card}>
                  <Row label="To"><Text style={s.rowValue}>{recipient?.fullName}</Text></Row>
                  <Row label="From" last><Text style={s.rowValue}>{overview?.me?.fullName || 'You'}</Text></Row>
                </View>
                <Text style={[s.hint, { textAlign: 'center' }]}>No money was moved.</Text>
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.ghost} onPress={() => { setResult(null); setStep('amount'); }}><Text style={s.ghostText}>Try again</Text></TouchableOpacity>
                  <Primary label="Close" onPress={onClose} />
                </View>
              </View>
            )}

            {step === 'result' && result?.status === 'locked' && (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={[s.resultIcon, { backgroundColor: `${t.danger}22` }]}><Lock size={32} color={t.danger} /></View>
                  <Text style={s.scanTitle}>Account locked</Text>
                </View>
                <View style={[s.card, { padding: 14 }]}><Text style={s.rowValue}>{result.message}</Text></View>
                <Text style={s.hint}>No money was sent. If this wasn't you, report it to ITSO and change your PIN once you can sign in again.</Text>
                <Primary label="Close" onPress={close} flex={false} />
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: t.isDark ? t.cardSolid : t.headerBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', borderTopWidth: 2, borderColor: `${t.accent}55` },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: t.accent, fontSize: 19, fontWeight: '800' },
  subtitle: { color: t.textSecondary, fontSize: 12 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 6 },
  bar: { height: 5, borderRadius: 3 },
  barLabel: { color: t.textMuted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4 },
  tapCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: t.accentSoft, borderWidth: 1.5, borderColor: t.accent },
  tapIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
  tapTitle: { color: t.text, fontSize: 16, fontWeight: '800' },
  tapSub: { color: t.textSecondary, fontSize: 12.5 },
  scanRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: t.accent, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: t.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionLabel: { color: t.textSecondary, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  favName: { color: t.text, fontSize: 12, fontWeight: '600' },
  avatar: { backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: t.onAccent, fontWeight: '800' },
  list: { borderRadius: 14, borderWidth: 1, borderColor: t.border, overflow: 'hidden', backgroundColor: t.card },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  listDivider: { borderTopWidth: 1, borderTopColor: t.border },
  listName: { color: t.text, fontSize: 14.5, fontWeight: '700' },
  listMeta: { color: t.textSecondary, fontSize: 12 },
  idHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  pills: { flexDirection: 'row', backgroundColor: t.card, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: t.border },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { color: t.textSecondary, fontSize: 11, fontWeight: '800' },
  idInput: { borderWidth: 1.5, borderColor: t.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: t.text, fontSize: 18, fontWeight: '800', letterSpacing: 1, backgroundColor: t.card },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { color: t.textSecondary, fontSize: 12.5 },
  tiny: { color: t.textSecondary, fontSize: 11 },
  found: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: t.accent, backgroundColor: t.accentSoft },
  nextText: { color: t.accent, fontWeight: '800', fontSize: 13.5 },
  recipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
  smallCaps: { color: t.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  amtBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: t.border, borderRadius: 14, paddingHorizontal: 14, marginTop: 8, backgroundColor: t.card },
  amtPeso: { color: t.textSecondary, fontSize: 24, fontWeight: '800', marginRight: 4 },
  amtInput: { flex: 1, color: t.text, fontSize: 26, fontWeight: '800', paddingVertical: 10 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quick: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: 'center' },
  quickText: { color: t.text, fontWeight: '800', fontSize: 13 },
  balBox: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
  balValue: { color: t.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: t.accentSoft, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: t.accent },
  btnRow: { flexDirection: 'row', gap: 10 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: t.accent, borderRadius: 14, paddingVertical: 14 },
  primaryText: { color: t.onAccent, fontWeight: '800', fontSize: 15 },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
  ghostFull: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 14, paddingVertical: 13, backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
  ghostText: { color: t.text, fontWeight: '700', fontSize: 14.5 },
  bigAmount: { color: t.text, fontSize: 34, fontWeight: '900', marginTop: 2 },
  card: { borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.border },
  rowLabel: { color: t.textSecondary, fontSize: 13.5 },
  rowValue: { color: t.text, fontSize: 13.5, fontWeight: '700', textAlign: 'right' },
  rowSub: { color: t.textSecondary, fontSize: 12, textAlign: 'right' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 12.5 },
  warn: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: `${t.pending}1F`, borderWidth: 1, borderColor: `${t.pending}55` },
  warnText: { color: t.text, fontSize: 12.5, flex: 1, lineHeight: 18 },
  shield: { width: 56, height: 56, borderRadius: 16, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pinBox: { width: 44, height: 54, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card },
  pinDot: { color: t.text, fontSize: 26, fontWeight: '900' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resultIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  favBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: t.accent },
  favText: { color: t.accent, fontWeight: '800', fontSize: 14 },
});

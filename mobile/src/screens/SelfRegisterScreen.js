// src/screens/SelfRegisterScreen.js
// "Register with your school ID" — the registration kiosk
// (client/src/pages/kiosk/Kiosk.jsx) on the student's own phone, same look
// and steps: tap your ID -> not registered yet? -> details -> review ->
// a temporary PIN is emailed -> sign in here to set your own PIN.
// Uses the kiosk endpoints with source: 'phone' (same checks: the account email
// rule, one account per card / school ID / email).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing,
  KeyboardAvoidingView, Platform, AppState, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import NfcManager from 'react-native-nfc-manager';
import {
  Nfc, CreditCard, Bus, Store, Send, ShieldCheck, CheckCircle2, XCircle,
  ArrowRight, ArrowLeft, Mail, User, GraduationCap, Sparkles, AlertCircle,
} from 'lucide-react-native';
import api from '../services/api';
import NFCService from '../services/NFCService';
import maskCard from '../utils/maskCard';

const NAVY = '#0F1227';
const NAVY2 = '#181D40';
const YELLOW = '#FFD41C';
const TEXT = '#FBFBFB';
const MUTED = 'rgba(251,251,251,0.6)';
const FAINT = 'rgba(251,251,251,0.35)';
const GREEN = '#22C55E';
const RED = '#F87171';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_RE = /^[A-Za-zÀ-ÿÑñ' .-]{1,40}$/;
const TAGLINES = [
  'Tap. Pay. Go.',
  'Your campus wallet — on your ID.',
  'Ride the NU Shuttle cashless.',
  'Pay campus merchants in a tap.',
  'Send money to schoolmates instantly.',
];
const EMPTY_FORM = { email: '', firstName: '', middleName: '', lastName: '', schoolId: '' };

const fmtSchoolId = (digits) => (digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4, 10)}` : digits);

// ---- background -------------------------------------------------------------
// Gradient + two drifting glows, like the kiosk. Svg sits in an absolute View
// (an Svg given position:absolute directly still takes part in layout on Android).
function Backdrop() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const drift = (dx, dy) => ({ transform: [
    { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
    { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
  ] });
  const glow = (id, color, opacity) => (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50%" cy="50%" r="50%" fill={`url(#${id})`} />
    </Svg>
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="regBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={NAVY} />
            <Stop offset="1" stopColor={NAVY2} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#regBg)" />
      </Svg>
      <Animated.View style={[s.glow, { width: 360, height: 360, top: -90, left: -110 }, drift(28, 30)]}>
        {glow('glowY', YELLOW, 0.16)}
      </Animated.View>
      <Animated.View style={[s.glow, { width: 420, height: 420, bottom: -140, right: -150 }, drift(-34, -22)]}>
        {glow('glowB', '#3B82F6', 0.14)}
      </Animated.View>
    </View>
  );
}

// Fade + rise when a new step appears (the kiosk's card entrance)
function Enter({ children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
      ],
    }]}>
      {children}
    </Animated.View>
  );
}

function Card({ children }) {
  return (
    <Enter style={s.cardShadow}>
      <View style={s.card}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="regCard" x1="0.2" y1="0" x2="0.8" y2="1">
                <Stop offset="0" stopColor="rgb(30,35,71)" stopOpacity={0.97} />
                <Stop offset="1" stopColor="rgb(24,29,64)" stopOpacity={0.97} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#regCard)" />
          </Svg>
        </View>
        {children}
      </View>
    </Enter>
  );
}

function Badge({ Icon, color, bg }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View style={[s.badge, { backgroundColor: bg, transform: [{ scale: pop }] }]}>
      <Icon size={44} color={color} />
    </Animated.View>
  );
}

function Btn({ onPress, children, ghost, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[s.btn, ghost ? s.btnGhost : s.btnPrimary, disabled && { opacity: 0.5 }]}
    >
      {children}
    </TouchableOpacity>
  );
}
const BtnText = ({ ghost, children }) => <Text style={[s.btnText, { color: ghost ? MUTED : NAVY2 }]}>{children}</Text>;

function Field({ label, Icon, err, ...input }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 4 }}>
      <View style={s.labelRow}>
        {Icon && <Icon size={13} color={YELLOW} />}
        <Text style={s.label}>{label.toUpperCase()}</Text>
      </View>
      <TextInput
        {...input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor="rgba(251,251,251,0.28)"
        autoCorrect={false}
        style={[s.input, focused && s.inputFocus, !!err && s.inputErr]}
      />
      <View style={s.errRow}>
        {!!err && <><AlertCircle size={13} color={RED} /><Text style={s.errText}>{err}</Text></>}
      </View>
    </View>
  );
}

// The kiosk's "tap your ID" target: two rings expanding out of the NFC circle
function TapTarget() {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ring = (v, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const a = ring(r1, 0); const b = ring(r2, 700);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [r1, r2]);
  const ringStyle = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.7] }) }],
  });
  return (
    <View style={s.tapWrap}>
      <Animated.View style={[s.tapRing, ringStyle(r1)]} />
      <Animated.View style={[s.tapRing, ringStyle(r2)]} />
      <View style={s.tapCore}><Nfc size={48} color={YELLOW} /></View>
    </View>
  );
}

export default function SelfRegisterScreen({ navigation }) {
  // idle|checking|registered|prompt|form|review|submitting|success|error
  const [stage, setStage] = useState('idle');
  const [card, setCard] = useState('');
  const [known, setKnown] = useState(null); // { firstName, activated }
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  // Which emails can register ([] = any) — the server's account email rule
  const [emailDomains, setEmailDomains] = useState([]);
  useEffect(() => {
    api.get('/system/email-policy').then((r) => setEmailDomains(r?.data?.domains || [])).catch(() => {});
  }, []);
  const emailWord = emailDomains.length ? 'school email' : 'email';
  const [fieldErr, setFieldErr] = useState({});
  const [nfc, setNfc] = useState('checking'); // checking | on | off | missing
  const [emailSent, setEmailSent] = useState(true);
  const [tagline, setTagline] = useState(0);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const mounted = useRef(true);

  const pulse = useRef(new Animated.Value(1)).current;
  const taglineFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    const t = setInterval(() => {
      taglineFade.setValue(0);
      setTagline((i) => (i + 1) % TAGLINES.length);
      Animated.timing(taglineFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 4000);
    return () => { loop.stop(); clearInterval(t); };
  }, [pulse, taglineFade]);

  const reset = useCallback(() => {
    setStage('idle'); setCard(''); setKnown(null); setErrorMsg('');
    setForm(EMPTY_FORM); setFieldErr({});
  }, []);

  const handleScan = useCallback(async (uid) => {
    setCard(uid);
    setStage('checking');
    try {
      const r = await api.post('/kiosk/check-card', { rfid: uid, source: 'phone' });
      if (!mounted.current) return;
      if (r.data?.registered) {
        setKnown({ firstName: r.data.firstName, activated: r.data.activated });
        setStage('registered');
      } else {
        setStage('prompt');
      }
    } catch (e) {
      if (!mounted.current) return;
      setErrorMsg(e?.response?.data?.error || "Couldn't reach NUCash. Check your internet and try again.");
      setStage('error');
    }
  }, []);

  // Like the kiosk, the phone is always ready for a tap on the first screen.
  const checkNfc = useCallback(async () => {
    if (!(await NFCService.init())) { setNfc('missing'); return; }
    setNfc((await NFCService.isEnabled()) ? 'on' : 'off');
  }, []);
  useEffect(() => {
    checkNfc();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') checkNfc(); });
    return () => { sub.remove(); };
  }, [checkNfc]);

  useEffect(() => {
    if (stage !== 'idle' || nfc !== 'on') return undefined;
    let active = true;
    const listen = async () => {
      while (active && mounted.current && stageRef.current === 'idle') {
        const read = await NFCService.readRFIDCard();
        if (!active || !mounted.current || stageRef.current !== 'idle') return;
        if (read.success && read.uid) { handleScan(read.uid); return; }
        await new Promise((r) => setTimeout(r, 700)); // lost the card mid-read: listen again
      }
    };
    listen();
    return () => { active = false; NFCService.cancelScan().catch(() => {}); };
  }, [stage, nfc, handleScan]);

  useEffect(() => () => { mounted.current = false; NFCService.cancelScan().catch(() => {}); }, []);

  const validate = () => {
    const errs = {};
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address.';
    else if (emailDomains.length && !emailDomains.includes(email.split('@')[1])) errs.email = `Use your school email (…@${emailDomains.join(' or …@')}).`;
    if (!form.firstName.trim() || !NAME_RE.test(form.firstName.trim())) errs.firstName = 'Enter your first name (letters only).';
    if (form.middleName.trim() && !NAME_RE.test(form.middleName.trim())) errs.middleName = 'Letters only.';
    if (!form.lastName.trim() || !NAME_RE.test(form.lastName.trim())) errs.lastName = 'Enter your last name (letters only).';
    if (form.schoolId.replace(/\D/g, '').length !== 10) errs.schoolId = 'School ID must be 10 digits, e.g. 2023-121235.';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    setStage('submitting');
    try {
      const r = await api.post('/kiosk/register', {
        source: 'phone',
        rfid: card,
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        schoolUId: form.schoolId.replace(/\D/g, ''),
      });
      setEmailSent(r.data?.emailSent !== false);
      setStage('success');
    } catch (e) {
      setErrorMsg(e?.response?.data?.error || 'Registration failed. Please try again or visit the Treasury Office.');
      setStage('form');
    }
  };

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: k === 'schoolId' ? fmtSchoolId(v.replace(/\D/g, '').slice(0, 10)) : v }));
    if (fieldErr[k]) setFieldErr((fe) => ({ ...fe, [k]: undefined }));
  };

  const toLogin = () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  const busy = stage === 'checking' || stage === 'submitting';
  const goBack = () => {
    if (stage === 'form') setStage('prompt');
    else if (stage === 'review') setStage('form');
    else if (stage === 'idle') navigation.goBack();
    else reset();
  };

  return (
    <View style={s.root}>
      <Backdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topBar}>
            <TouchableOpacity style={s.back} onPress={goBack} disabled={busy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ArrowLeft size={18} color={YELLOW} />
              <Text style={s.backText}>{stage === 'idle' ? 'Back to sign in' : 'Back'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ============ IDLE / ATTRACT ============ */}
            {stage === 'idle' && (
              <Enter style={{ alignItems: 'center' }}>
                <Animated.View style={[s.logoHalo, { transform: [{ scale: pulse }] }]}>
                  <View style={s.logo}><Text style={s.logoText}>NU</Text></View>
                </Animated.View>
                <Text style={s.brand}>NUCash</Text>
                <Animated.Text style={[s.tagline, { opacity: taglineFade }]}>{TAGLINES[tagline]}</Animated.Text>

                <View style={s.features}>
                  {[{ I: Bus, t: 'Shuttle rides' }, { I: Store, t: 'Campus stores' }, { I: Send, t: 'Send money' }].map(({ I, t }) => (
                    <View key={t} style={s.feature}>
                      <View style={s.featureIcon}><I size={26} color={YELLOW} /></View>
                      <Text style={s.featureText}>{t}</Text>
                    </View>
                  ))}
                </View>

                <TapTarget />
                <Text style={s.tapTitle}>Tap your School ID to get started</Text>
                {nfc === 'on' && (
                  <Text style={s.tapSub}>Hold your ID flat against the back of your phone. Check your registration or sign up — right here.</Text>
                )}
                {nfc === 'checking' && <ActivityIndicator color={YELLOW} style={{ marginTop: 12 }} />}
                {nfc === 'off' && (
                  <>
                    <Text style={s.tapSub}>Turn on NFC so your phone can read your ID.</Text>
                    <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
                      <Btn onPress={() => NfcManager.goToNfcSetting?.().catch(() => {})}><BtnText>Turn on NFC</BtnText></Btn>
                    </View>
                  </>
                )}
                {nfc === 'missing' && (
                  <Text style={[s.tapSub, { color: RED }]}>This phone can't read cards (no NFC). Please register at the kiosk or the Treasury Office.</Text>
                )}
              </Enter>
            )}

            {/* ============ CHECKING ============ */}
            {stage === 'checking' && (
              <Card>
                <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                  <ActivityIndicator size="large" color={YELLOW} />
                  <Text style={[s.h3, { marginTop: 18 }]}>Reading your card…</Text>
                  <Text style={s.muted}>{maskCard(card)}</Text>
                </View>
              </Card>
            )}

            {/* ============ ALREADY REGISTERED ============ */}
            {stage === 'registered' && (
              <Card>
                <View style={{ alignItems: 'center' }}>
                  <Badge Icon={CheckCircle2} color={GREEN} bg="rgba(34,197,94,0.15)" />
                  <Text style={s.h2}>{known?.firstName ? `Hi ${known.firstName}, you're registered!` : "You're already registered!"}</Text>
                  <Text style={s.body}>
                    {known?.activated
                      ? `This ID is active and ready to use. Sign in with your ${emailWord} and PIN.`
                      : `Your account exists but isn't activated yet. Check your ${emailWord} for the temporary PIN, then sign in here — you'll set your own PIN right after.`}
                  </Text>
                  <View style={s.btnCol}>
                    <Btn onPress={toLogin}><BtnText>Go to sign in</BtnText><ArrowRight size={20} color={NAVY2} /></Btn>
                  </View>
                  <Text style={s.fine}>Not your ID? Report it at the Treasury Office.</Text>
                </View>
              </Card>
            )}

            {/* ============ REGISTER? PROMPT ============ */}
            {stage === 'prompt' && (
              <Card>
                <View style={{ alignItems: 'center' }}>
                  <Badge Icon={CreditCard} color={YELLOW} bg="rgba(255,212,28,0.15)" />
                  <Text style={s.h2}>This ID isn't registered yet</Text>
                  <Text style={[s.muted, { marginBottom: 6 }]}>Card {maskCard(card)}</Text>
                  <Text style={s.body}>Would you like to register for NUCash now? It takes about a minute.</Text>
                  <View style={s.btnRow}>
                    <Btn ghost onPress={reset}><BtnText ghost>Not now</BtnText></Btn>
                    <Btn onPress={() => { setErrorMsg(''); setStage('form'); }}><BtnText>Yes, register</BtnText><ArrowRight size={20} color={NAVY2} /></Btn>
                  </View>
                </View>
              </Card>
            )}

            {/* ============ FORM ============ */}
            {stage === 'form' && (
              <Card>
                <Text style={s.h2Left}>Create your NUCash account</Text>
                <Text style={[s.muted, s.left, { marginBottom: 20 }]}>
                  Card <Text style={{ color: YELLOW, fontWeight: '800' }}>{maskCard(card)}</Text> — kept hidden for your security.
                </Text>

                {!!errorMsg && (
                  <View style={s.alert}>
                    <AlertCircle size={16} color={RED} />
                    <Text style={s.alertText}>{errorMsg}</Text>
                  </View>
                )}

                <Field label="School Email" Icon={Mail} err={fieldErr.email} value={form.email} onChangeText={set('email')}
                  keyboardType="email-address" autoCapitalize="none" placeholder="e.g. delacruzjp@students.nu-laguna.edu.ph" />
                <Field label="First Name" Icon={User} err={fieldErr.firstName} value={form.firstName} onChangeText={set('firstName')}
                  autoCapitalize="words" placeholder="e.g. Juan" />
                <Field label="Middle Name (optional)" err={fieldErr.middleName} value={form.middleName} onChangeText={set('middleName')}
                  autoCapitalize="words" placeholder="e.g. Ponce" />
                <Field label="Last Name" err={fieldErr.lastName} value={form.lastName} onChangeText={set('lastName')}
                  autoCapitalize="words" placeholder="e.g. Dela Cruz" />
                <Field label="School ID Number" Icon={GraduationCap} err={fieldErr.schoolId} value={form.schoolId} onChangeText={set('schoolId')}
                  keyboardType="number-pad" placeholder="e.g. 2023-121235" />

                <View style={s.note}>
                  <ShieldCheck size={24} color={YELLOW} />
                  <Text style={s.noteText}>
                    Use your real name{emailDomains.length ? ' and school-issued email' : ''} exactly as they appear in school records. Your temporary PIN is sent only
                    to your {emailWord}, and your details help keep shuttle rides and payments safe and traceable.
                  </Text>
                </View>

                <View style={s.btnRow}>
                  <Btn ghost onPress={() => setStage('prompt')}><ArrowLeft size={20} color={MUTED} /><BtnText ghost>Back</BtnText></Btn>
                  <Btn onPress={() => { if (validate()) { setErrorMsg(''); setStage('review'); } }}><BtnText>Review</BtnText><ArrowRight size={20} color={NAVY2} /></Btn>
                </View>
                <Text style={[s.fine, { marginTop: 14 }]}>Employees register at the Treasury Office.</Text>
              </Card>
            )}

            {/* ============ REVIEW ============ */}
            {stage === 'review' && (
              <Card>
                <Text style={s.h2Left}>Is everything correct?</Text>
                <Text style={[s.muted, s.left, { marginBottom: 20 }]}>Double-check — your account details must match your school records.</Text>
                <View style={s.table}>
                  {[
                    ['ID Card', maskCard(card)],
                    ['Name', `${form.firstName.trim()} ${form.middleName.trim() ? `${form.middleName.trim()} ` : ''}${form.lastName.trim()}`],
                    ['School Email', form.email.trim().toLowerCase()],
                    ['School ID', form.schoolId],
                  ].map(([k, v], i, arr) => (
                    <View key={k} style={[s.tableRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={s.tableKey}>{k}</Text>
                      <Text style={s.tableVal}>{v}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.btnRow}>
                  <Btn ghost onPress={() => setStage('form')}><ArrowLeft size={20} color={MUTED} /><BtnText ghost>Edit</BtnText></Btn>
                  <Btn onPress={submit}><BtnText>Register</BtnText><CheckCircle2 size={20} color={NAVY2} /></Btn>
                </View>
              </Card>
            )}

            {/* ============ SUBMITTING ============ */}
            {stage === 'submitting' && (
              <Card>
                <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                  <ActivityIndicator size="large" color={YELLOW} />
                  <Text style={[s.h3, { marginTop: 18 }]}>Creating your account…</Text>
                </View>
              </Card>
            )}

            {/* ============ SUCCESS ============ */}
            {stage === 'success' && (
              <Card>
                <View style={{ alignItems: 'center' }}>
                  <Badge Icon={Sparkles} color={GREEN} bg="rgba(34,197,94,0.15)" />
                  <Text style={s.h2}>You're registered!</Text>
                  {emailSent ? (
                    <>
                      <Text style={s.body}>
                        A <Text style={s.hl}>temporary PIN</Text> has been sent to
                        <Text style={{ color: TEXT, fontWeight: '700' }}> {form.email.trim().toLowerCase()}</Text>.
                      </Text>
                      <Text style={s.body}>
                        <Text style={s.hl}>Sign in here</Text> with that PIN — you'll set your own PIN right after.
                      </Text>
                    </>
                  ) : (
                    <Text style={s.body}>Your account was created, but the email didn't go through. Visit the Treasury Office to get your temporary PIN.</Text>
                  )}
                  <View style={s.btnCol}>
                    <Btn onPress={toLogin}><BtnText>Go to sign in</BtnText><ArrowRight size={20} color={NAVY2} /></Btn>
                  </View>
                  <Text style={s.fine}>Your balance starts at ₱0. Load it at the Treasury Office.</Text>
                </View>
              </Card>
            )}

            {/* ============ ERROR ============ */}
            {stage === 'error' && (
              <Card>
                <View style={{ alignItems: 'center' }}>
                  <Badge Icon={XCircle} color="#EF4444" bg="rgba(239,68,68,0.15)" />
                  <Text style={s.h2}>Hmm, that didn't work</Text>
                  <Text style={s.body}>{errorMsg}</Text>
                  <View style={s.btnCol}>
                    <Btn onPress={reset}><BtnText>Try again</BtnText></Btn>
                  </View>
                </View>
              </Card>
            )}
          </ScrollView>

          <Text style={s.footer}>NUCash Registration • Need help? Visit the Treasury Office</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  glow: { position: 'absolute' },
  topBar: { paddingHorizontal: 20, paddingTop: 6 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: YELLOW, fontWeight: '700', fontSize: 15 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  // attract screen
  logoHalo: { padding: 9, borderRadius: 34, backgroundColor: 'rgba(255,212,28,0.15)', marginBottom: 22 },
  logo: {
    width: 92, height: 92, borderRadius: 26, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    elevation: 12, shadowColor: YELLOW, shadowOpacity: 0.35, shadowRadius: 24,
  },
  logoText: { fontSize: 38, fontWeight: '900', color: NAVY2 },
  brand: { color: TEXT, fontSize: 46, fontWeight: '900', letterSpacing: 1 },
  tagline: { color: YELLOW, fontSize: 18, fontWeight: '700', marginTop: 6, marginBottom: 30, textAlign: 'center', minHeight: 24 },
  features: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 36 },
  feature: { alignItems: 'center', width: 86 },
  featureIcon: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,212,28,0.25)',
  },
  featureText: { color: MUTED, fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  tapWrap: { width: 124, height: 124, marginBottom: 18 },
  tapRing: { ...StyleSheet.absoluteFillObject, borderRadius: 62, borderWidth: 3, borderColor: YELLOW },
  tapCore: { position: 'absolute', top: 13, left: 13, right: 13, bottom: 13, borderRadius: 49, backgroundColor: 'rgba(255,212,28,0.12)', alignItems: 'center', justifyContent: 'center' },
  tapTitle: { color: TEXT, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  tapSub: { color: FAINT, fontSize: 13.5, textAlign: 'center', marginTop: 8, lineHeight: 19, paddingHorizontal: 10 },

  // cards
  cardShadow: { borderRadius: 24, elevation: 16, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 24 } },
  card: { borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,212,28,0.35)', padding: 22, overflow: 'hidden', backgroundColor: 'rgb(27,32,68)' },
  badge: { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  h2: { color: TEXT, fontSize: 23, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  h2Left: { color: TEXT, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  h3: { color: TEXT, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { color: MUTED, fontSize: 15.5, lineHeight: 23, textAlign: 'center', marginBottom: 8 },
  muted: { color: MUTED, fontSize: 14, textAlign: 'center' },
  left: { textAlign: 'left' },
  hl: { color: YELLOW, fontWeight: '800' },
  fine: { color: FAINT, fontSize: 12.5, textAlign: 'center', marginTop: 12 },

  // buttons
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 14, borderRadius: 14 },
  btnPrimary: { backgroundColor: YELLOW, elevation: 5, shadowColor: YELLOW, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 2, borderColor: 'rgba(251,251,251,0.25)' },
  btnText: { fontSize: 16, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 18, alignSelf: 'stretch' },
  btnCol: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 18 },

  // form
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  label: { color: YELLOW, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  input: {
    borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,212,28,0.22)', backgroundColor: 'rgba(15,18,39,0.7)',
    color: TEXT, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11,
  },
  inputFocus: { borderColor: YELLOW },
  inputErr: { borderColor: 'rgba(239,68,68,0.65)' },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20, marginTop: 4 },
  errText: { color: RED, fontSize: 12, flex: 1 },
  alert: {
    flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  alertText: { color: RED, fontSize: 14, flex: 1 },
  note: { flexDirection: 'row', gap: 10, marginTop: 6 },
  noteText: { color: FAINT, fontSize: 12.5, lineHeight: 19, flex: 1 },

  // review
  table: { backgroundColor: 'rgba(15,18,39,0.6)', borderWidth: 1, borderColor: 'rgba(255,212,28,0.2)', borderRadius: 16, paddingHorizontal: 16 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(251,251,251,0.07)' },
  tableKey: { color: MUTED, fontSize: 14, fontWeight: '600' },
  tableVal: { color: TEXT, fontSize: 14.5, fontWeight: '800', textAlign: 'right', flex: 1, flexWrap: 'wrap' },

  footer: { color: FAINT, fontSize: 11.5, textAlign: 'center', paddingVertical: 10 },
});

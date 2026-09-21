// src/screens/ActivationScreen.js
// First sign-in with the emailed temporary PIN: the same activation flow as the
// website (client/src/pages/account/AccountActivation.jsx), same look.
// Steps: Terms → New PIN → Verify email code → signed in (or Done).
// Every call carries the short-lived activation pass the login returned.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  FileText, ChevronDown, AlertTriangle, ArrowRight, LockKeyhole, Eye, EyeOff,
  Check, X, Lightbulb, Mail, ArrowLeft,
} from 'lucide-react-native';
import api from '../services/api';
import { startSession } from '../services/session';

const C = {
  bg1: '#0F1227',
  bg2: '#181D40',
  card: 'rgba(30,35,71,0.95)',
  inset: 'rgba(15,18,39,0.5)',
  yellow: '#FFD41C',
  blue: '#3B82F6',
  green: '#22C55E',
  red: '#EF4444',
  text: '#FBFBFB',
  text70: 'rgba(251,251,251,0.7)',
  text60: 'rgba(251,251,251,0.6)',
  text50: 'rgba(251,251,251,0.5)',
  text40: 'rgba(251,251,251,0.4)',
};

const WEAK_PINS = ['123456', '654321', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '000000'];

// Same wording as the website
const TERMS_CONTENT = {
  admin: {
    title: 'Administrator Terms and Conditions',
    sections: [
      { title: '1. Administrative Responsibilities', content: 'As an administrator of the NUCash system, you are entrusted with managing financial transactions, user accounts, and system configurations. You agree to perform your duties with utmost integrity and professionalism.' },
      { title: '2. Data Privacy and Confidentiality', content: 'You acknowledge that you will have access to sensitive user information including personal data and financial records. You agree to maintain strict confidentiality and comply with the Data Privacy Act of 2012 (Republic Act No. 10173).' },
      { title: '3. Security Protocols', content: 'You agree to follow all security protocols including: keeping your PIN confidential, logging out after each session, reporting any suspicious activities immediately, and never sharing your credentials with others.' },
      { title: '4. Transaction Handling', content: 'All financial transactions must be processed accurately and recorded properly. Any discrepancies must be reported immediately to your supervisor. Unauthorized transactions or fund manipulation is strictly prohibited and may result in disciplinary action.' },
      { title: '5. System Usage', content: 'The NUCash administrative system is to be used solely for authorized purposes. Personal use, unauthorized access to other accounts, or any form of system abuse is prohibited.' },
      { title: '6. Liability', content: 'You understand that any violation of these terms may result in suspension of access, disciplinary action, and potential legal consequences. National University reserves the right to audit all administrative activities.' },
    ],
  },
  user: {
    title: 'NUCash User Agreement',
    sections: [
      { title: '1. Account Registration', content: 'By activating your NUCash account, you confirm that all information provided during registration is accurate and complete. You agree to keep your account information up to date.' },
      { title: '2. PIN Security', content: 'Your 6-digit PIN is your primary authentication method. You are responsible for keeping your PIN confidential. Never share your PIN with anyone, including NUCash staff. We will never ask for your PIN.' },
      { title: '3. RFID Card Usage', content: 'Your NUCash account is linked to your RFID card. Report any lost or stolen cards immediately to the Treasury Office. You are responsible for all transactions made with your card until it is reported lost.' },
      { title: '4. Transaction Terms', content: 'All transactions are final once processed. Your NUCash balance can be used for shuttle fare payments, merchant purchases, and other campus services. Negative balances up to the allowed limit may be permitted.' },
      { title: '5. Privacy Policy', content: 'National University collects and processes your personal data in accordance with the Data Privacy Act of 2012. Your transaction history and account information are kept confidential and used only for system operations.' },
      { title: '6. Account Deactivation', content: 'You may request to deactivate your account at any time. Any remaining balance will be refunded according to university policy. Inactive accounts may be automatically suspended after extended periods of non-use.' },
    ],
  },
};

const STEPS = ['terms', 'pin', 'otp', 'success'];
const STEP_LABELS = ['Terms', 'PIN', 'Verify', 'Done'];

function Background() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="actBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={C.bg1} />
            <Stop offset="1" stopColor={C.bg2} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#actBg)" />
      </Svg>
    </View>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <View style={s.errorBox}>
      <AlertTriangle size={16} color={C.red} />
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

function PrimaryButton({ label, busyLabel, busy, disabled, color, textColor, onPress }) {
  const off = disabled || busy;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={off}
      onPress={onPress}
      style={[s.button, { backgroundColor: color, opacity: off ? 0.35 : 1, shadowColor: color, elevation: off ? 0 : 6 }]}
    >
      {busy ? (
        <View style={s.buttonRow}>
          <ActivityIndicator size="small" color={textColor} />
          <Text style={[s.buttonText, { color: textColor }]}>{busyLabel}</Text>
        </View>
      ) : (
        <View style={s.buttonRow}>
          <Text style={[s.buttonText, { color: textColor }]}>{label}</Text>
          <ArrowRight size={18} color={textColor} strokeWidth={2.5} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function CardHeader({ Icon, color, title, subtitle }) {
  return (
    <View style={[s.cardHeader, { backgroundColor: `${color}1F`, borderBottomColor: `${color}33` }]}>
      <View style={s.cardHeaderRow}>
        <Icon size={22} color={color} />
        <Text style={[s.cardTitle, { color }]}>{title}</Text>
      </View>
      {subtitle}
    </View>
  );
}

export default function ActivationScreen({ navigation, route }) {
  const { accountId, accountType = 'user', email = '', fullName = '', activationToken } = route.params || {};
  const isAdmin = accountType === 'admin';
  const terms = TERMS_CONTENT[isAdmin ? 'admin' : 'user'];

  const [step, setStep] = useState('terms');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const termsBoxHeight = useRef(0);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [otp, setOtp] = useState('');
  const otpRef = useRef(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const t = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const backToLogin = () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] });

  // Every step sends the activation pass. An expired pass or an account that's
  // already active means starting over from sign-in.
  const post = async (path, body = {}) => {
    try {
      const res = await api.post(`/activation/${path}`, { accountId, accountType, activationToken, ...body });
      return res.data;
    } catch (e) {
      const data = e.response?.data || {};
      if (data.restart || data.alreadyActive || data.deactivated) {
        setError('');
        setNotice(data.error);
      }
      throw new Error(data.error || (e.message?.includes('Network') ? 'Network error. Please check your connection.' : 'Something went wrong. Please try again.'));
    }
  };

  const run = async (fn) => {
    setLoading(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = () => run(async () => {
    await post('accept-terms');
    setStep('pin');
  });

  const handleSetPin = () => {
    if (newPin.length !== 6) return setError('PIN must be exactly 6 digits');
    if (newPin !== confirmPin) return setError('PINs do not match');
    if (WEAK_PINS.includes(newPin)) return setError('Please choose a stronger PIN');
    return run(async () => {
      await post('set-new-pin', { newPin });
      setStep('otp');
      setOtp('');
      setResendCooldown(60);
      setTimeout(() => otpRef.current?.focus(), 350);
    });
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return setError('Please enter the complete 6-digit code');
    return run(async () => {
      await post('verify-otp', { otp });
      // Signed in straight away with the PIN just set
      try {
        const res = await api.post('/login', { emailOrUsername: email, password: newPin });
        if (res.data?.token && await startSession(navigation, res.data)) return;
      } catch (loginErr) {
        console.log('Auto sign-in after activation failed:', loginErr?.message);
      }
      setStep('success');
    });
  };

  const handleResendOtp = () => {
    if (resendCooldown > 0 || loading) return;
    run(async () => {
      await post('resend-otp');
      setResendCooldown(60);
      setOtp('');
    });
  };

  const onTermsScroll = ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 10) setScrolledToBottom(true);
  };

  const currentIndex = STEPS.indexOf(step);
  const pinsMatch = newPin === confirmPin;

  // Pass expired / already active / deactivated: explain and go back to sign-in
  if (notice) {
    return (
      <View style={s.root}>
        <Background />
        <SafeAreaView style={s.center}>
          <View style={[s.card, { padding: 24, alignItems: 'center', width: '100%' }]}>
            <AlertTriangle size={40} color={C.yellow} />
            <Text style={[s.successTitle, { color: C.yellow, fontSize: 20, marginTop: 12 }]}>Please sign in again</Text>
            <Text style={[s.successText, { marginBottom: 20 }]}>{notice}</Text>
            <PrimaryButton label="Go to Login" color={C.yellow} textColor={C.bg2} onPress={backToLogin} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Background />
      <View style={[s.blob, { top: '22%', left: -90 }]} />
      <View style={[s.blob, { bottom: '18%', right: -90 }]} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {step !== 'success' && (
              <TouchableOpacity style={s.back} onPress={backToLogin} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <ArrowLeft size={18} color={C.text50} />
                <Text style={s.backText}>Back to sign in</Text>
              </TouchableOpacity>
            )}

            {/* Header */}
            <View style={s.header}>
              <View style={s.logo}><Text style={s.logoText}>NU</Text></View>
              <Text style={s.title}>Account Activation</Text>
              <Text style={s.welcome}>
                Welcome, <Text style={{ color: C.yellow, fontWeight: '600' }}>{fullName || email}</Text>
              </Text>
            </View>

            {/* Progress steps */}
            <View style={s.steps}>
              {STEP_LABELS.map((label, i) => {
                const done = currentIndex > i;
                const current = currentIndex === i;
                const color = current ? C.yellow : done ? C.green : C.text40;
                return (
                  <React.Fragment key={label}>
                    <View style={s.stepItem}>
                      <View style={[s.stepCircle, {
                        backgroundColor: current ? C.yellow : done ? C.green : 'rgba(255,255,255,0.1)',
                        borderColor: current ? 'rgba(255,212,28,0.5)' : done ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)',
                      }]}>
                        {done
                          ? <Check size={17} color="#FFFFFF" strokeWidth={3} />
                          : <Text style={[s.stepNum, { color: current ? C.bg2 : C.text40 }]}>{i + 1}</Text>}
                      </View>
                      <Text style={[s.stepLabel, { color }]}>{label.toUpperCase()}</Text>
                    </View>
                    {i < 3 && <View style={[s.stepLine, { backgroundColor: done ? C.green : 'rgba(255,255,255,0.1)' }]} />}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={s.card}>
              {/* STEP 1: Terms */}
              {step === 'terms' && (
                <>
                  <CardHeader
                    Icon={FileText}
                    color={C.yellow}
                    title={terms.title}
                    subtitle={<Text style={s.cardSub}>Please read carefully before proceeding</Text>}
                  />
                  <View style={s.cardBody}>
                    <ScrollView
                      style={s.termsBox}
                      nestedScrollEnabled
                      onScroll={onTermsScroll}
                      scrollEventThrottle={64}
                      onLayout={(e) => { termsBoxHeight.current = e.nativeEvent.layout.height; }}
                      onContentSizeChange={(_, h) => { if (termsBoxHeight.current && h <= termsBoxHeight.current + 10) setScrolledToBottom(true); }}
                    >
                      {terms.sections.map((sec) => (
                        <View key={sec.title} style={{ marginBottom: 18 }}>
                          <Text style={s.termTitle}>{sec.title}</Text>
                          <Text style={s.termText}>{sec.content}</Text>
                        </View>
                      ))}
                    </ScrollView>

                    {!scrolledToBottom && (
                      <View style={s.scrollHint}>
                        <ChevronDown size={14} color={C.text40} />
                        <Text style={s.scrollHintText}>Scroll to the bottom to enable acceptance</Text>
                      </View>
                    )}

                    <Pressable
                      disabled={!scrolledToBottom}
                      onPress={() => setTermsAccepted((v) => !v)}
                      style={[s.checkRow, termsAccepted && s.checkRowOn]}
                    >
                      <View style={[s.checkbox, termsAccepted && s.checkboxOn, !scrolledToBottom && { opacity: 0.4 }]}>
                        {termsAccepted && <Check size={14} color={C.bg2} strokeWidth={3.5} />}
                      </View>
                      <Text style={[s.checkText, { color: scrolledToBottom ? C.text : C.text40 }]}>
                        I have read and agree to the {isAdmin ? 'Administrator' : 'User'} Terms and Conditions
                      </Text>
                    </Pressable>

                    <ErrorBox message={error} />
                    <PrimaryButton
                      label="ACCEPT & CONTINUE" busyLabel="PROCESSING..." busy={loading}
                      disabled={!termsAccepted} color={C.yellow} textColor={C.bg2} onPress={handleAcceptTerms}
                    />
                  </View>
                </>
              )}

              {/* STEP 2: New PIN */}
              {step === 'pin' && (
                <>
                  <CardHeader
                    Icon={LockKeyhole}
                    color={C.blue}
                    title="Set Your New PIN"
                    subtitle={<Text style={s.cardSub}>Create a secure 6-digit PIN for your account</Text>}
                  />
                  <View style={s.cardBody}>
                    <Text style={s.fieldLabel}>NEW PIN</Text>
                    <View style={{ justifyContent: 'center', marginBottom: 18 }}>
                      <TextInput
                        value={newPin}
                        onChangeText={(v) => { setNewPin(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                        keyboardType="number-pad"
                        secureTextEntry={!showPin}
                        maxLength={6}
                        placeholder="••••••"
                        placeholderTextColor={C.text40}
                        style={s.pinInput}
                      />
                      <TouchableOpacity style={s.eye} onPress={() => setShowPin((v) => !v)} accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}>
                        {showPin ? <EyeOff size={20} color={C.text50} /> : <Eye size={20} color={C.text50} />}
                      </TouchableOpacity>
                    </View>

                    <Text style={s.fieldLabel}>CONFIRM PIN</Text>
                    <TextInput
                      value={confirmPin}
                      onChangeText={(v) => { setConfirmPin(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      keyboardType="number-pad"
                      secureTextEntry={!showPin}
                      maxLength={6}
                      placeholder="••••••"
                      placeholderTextColor={C.text40}
                      style={[s.pinInput, { marginBottom: 18 }]}
                    />

                    {!!confirmPin && (
                      <View style={[s.matchBox, {
                        backgroundColor: pinsMatch ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        borderColor: pinsMatch ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                      }]}>
                        {pinsMatch ? <Check size={16} color={C.green} strokeWidth={3} /> : <X size={16} color={C.red} strokeWidth={3} />}
                        <Text style={[s.matchText, { color: pinsMatch ? C.green : C.red }]}>{pinsMatch ? 'PINs match' : 'PINs do not match'}</Text>
                      </View>
                    )}

                    <View style={s.tips}>
                      <View style={s.tipsHead}>
                        <Lightbulb size={16} color={C.yellow} />
                        <Text style={s.tipsTitle}>PIN Tips</Text>
                      </View>
                      {[
                        'Use 6 digits that are easy for you to remember',
                        'Avoid simple patterns like 123456 or 111111',
                        "Don't use your birthday or phone number",
                        'Never share your PIN with anyone',
                      ].map((tip) => (
                        <View key={tip} style={s.tipRow}>
                          <View style={s.tipDot} />
                          <Text style={s.tipText}>{tip}</Text>
                        </View>
                      ))}
                    </View>

                    <ErrorBox message={error} />
                    <PrimaryButton
                      label="SET PIN & CONTINUE" busyLabel="SETTING PIN..." busy={loading}
                      disabled={newPin.length !== 6 || !pinsMatch} color={C.blue} textColor="#FFFFFF" onPress={handleSetPin}
                    />
                  </View>
                </>
              )}

              {/* STEP 3: Email code */}
              {step === 'otp' && (
                <>
                  <CardHeader
                    Icon={Mail}
                    color={C.green}
                    title="Verify Your Email"
                    subtitle={(
                      <Text style={s.cardSub}>
                        Enter the 6-digit code sent to <Text style={{ color: C.yellow, fontWeight: '700' }}>{email}</Text>
                      </Text>
                    )}
                  />
                  <View style={s.cardBody}>
                    {/* One real input behind six boxes, so paste and autofill work */}
                    <Pressable style={s.otpRow} onPress={() => otpRef.current?.focus()}>
                      {Array.from({ length: 6 }).map((_, i) => {
                        const digit = otp[i] || '';
                        const active = i === Math.min(otp.length, 5);
                        return (
                          <View key={i} style={[s.otpBox, {
                            borderColor: digit ? C.green : active ? C.yellow : 'rgba(255,212,28,0.3)',
                            backgroundColor: digit ? 'rgba(34,197,94,0.1)' : C.inset,
                          }]}>
                            <Text style={s.otpDigit}>{digit}</Text>
                          </View>
                        );
                      })}
                      <TextInput
                        ref={otpRef}
                        value={otp}
                        onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        caretHidden
                        style={s.otpHidden}
                      />
                    </Pressable>

                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <Text style={s.resendPrompt}>Didn't receive the code?</Text>
                      <TouchableOpacity onPress={handleResendOtp} disabled={resendCooldown > 0 || loading}>
                        <Text style={[s.resendLink, { color: resendCooldown > 0 || loading ? 'rgba(251,251,251,0.3)' : C.yellow }]}>
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <ErrorBox message={error} />
                    <PrimaryButton
                      label="VERIFY & ACTIVATE" busyLabel="VERIFYING..." busy={loading}
                      disabled={otp.length !== 6} color={C.green} textColor="#FFFFFF" onPress={handleVerifyOtp}
                    />
                  </View>
                </>
              )}

              {/* STEP 4: Done (only if the automatic sign-in didn't go through) */}
              {step === 'success' && (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <View style={s.successCircle}><Check size={52} color="#FFFFFF" strokeWidth={3} /></View>
                  <Text style={s.successTitle}>Account Activated!</Text>
                  <Text style={s.successText}>Your account is now active. You can now log in with your new PIN.</Text>
                  <View style={s.detailBox}>
                    <Text style={s.detailLabel}>ACCOUNT DETAILS</Text>
                    <Text style={s.detailName}>{fullName || 'User'}</Text>
                    <Text style={s.detailEmail}>{email}</Text>
                  </View>
                  <PrimaryButton label="GO TO LOGIN" color={C.yellow} textColor={C.bg2} onPress={backToLogin} />
                </View>
              )}
            </View>

            <Text style={s.footer}>National University - Laguna Campus{'\n'}© 2026 NUCash Digital Campus Wallet</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg1 },
  center: { flex: 1, justifyContent: 'center', padding: 20 },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: C.yellow, opacity: 0.04 },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: C.text50, fontSize: 13, fontWeight: '600' },

  header: { alignItems: 'center', marginTop: 4, marginBottom: 24 },
  logo: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, elevation: 10, shadowColor: C.yellow, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  logoText: { fontSize: 40, fontWeight: '800', color: C.bg2 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 6, letterSpacing: -0.5 },
  welcome: { color: C.text60, fontSize: 14, textAlign: 'center' },

  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 14, fontWeight: '700' },
  stepLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  stepLine: { width: 28, height: 3, borderRadius: 2, marginHorizontal: 6, marginBottom: 20 },

  card: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,212,28,0.3)', overflow: 'hidden',
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 20 },
  },
  cardHeader: { paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  cardSub: { color: C.text60, fontSize: 13, marginTop: 8, lineHeight: 19 },
  cardBody: { padding: 20 },

  termsBox: {
    height: 280, backgroundColor: C.inset, borderRadius: 12, padding: 18, marginBottom: 14,
    borderWidth: 2, borderColor: 'rgba(255,212,28,0.15)',
  },
  termTitle: { color: C.yellow, fontWeight: '700', fontSize: 14, marginBottom: 6 },
  termText: { color: C.text70, fontSize: 13, lineHeight: 22 },
  scrollHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  scrollHintText: { color: C.text40, fontSize: 12 },
  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginBottom: 20, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  checkRowOn: { backgroundColor: 'rgba(255,212,28,0.1)', borderColor: 'rgba(255,212,28,0.3)' },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: 'rgba(251,251,251,0.5)', marginTop: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.yellow, borderColor: C.yellow },
  checkText: { flex: 1, fontSize: 14, lineHeight: 21 },

  fieldLabel: { color: C.yellow, fontWeight: '700', fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  pinInput: {
    borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,212,28,0.3)', backgroundColor: C.inset, color: C.text,
    fontSize: 26, letterSpacing: 12, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 44,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  eye: { position: 'absolute', right: 14, padding: 4 },
  matchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 2, marginBottom: 18 },
  matchText: { fontSize: 14, fontWeight: '600' },
  tips: { backgroundColor: 'rgba(255,212,28,0.08)', borderRadius: 12, padding: 16, marginBottom: 18, borderWidth: 2, borderColor: 'rgba(255,212,28,0.15)' },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tipsTitle: { color: C.yellow, fontWeight: '700', fontSize: 13 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  tipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.text60, marginTop: 9 },
  tipText: { flex: 1, color: C.text60, fontSize: 12, lineHeight: 21 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 },
  otpBox: { width: 44, height: 56, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  otpDigit: { color: C.text, fontSize: 26, fontWeight: '700' },
  otpHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  resendPrompt: { color: C.text50, fontSize: 13, marginBottom: 6 },
  resendLink: { fontWeight: '700', fontSize: 14, textDecorationLine: 'underline', padding: 6 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2, borderColor: 'rgba(239,68,68,0.3)', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 16,
  },
  errorText: { flex: 1, color: C.red, fontSize: 14 },

  button: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },

  successCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    elevation: 10, shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 16,
  },
  successTitle: { color: C.green, fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  successText: { color: C.text70, fontSize: 15, textAlign: 'center', lineHeight: 23, marginBottom: 20 },
  detailBox: {
    width: '100%', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 18,
    marginBottom: 20, borderWidth: 2, borderColor: 'rgba(34,197,94,0.3)',
  },
  detailLabel: { color: C.text50, fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  detailName: { color: C.text, fontWeight: '700', fontSize: 17, marginBottom: 2 },
  detailEmail: { color: C.text60, fontSize: 14 },

  footer: { textAlign: 'center', color: 'rgba(251,251,251,0.3)', fontSize: 12, marginTop: 24, lineHeight: 19 },
});

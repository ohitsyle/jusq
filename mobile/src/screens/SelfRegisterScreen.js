// src/screens/SelfRegisterScreen.js
// "Register with your school ID" — the kiosk's self-registration, on the
// student's own phone. Tap your school ID -> fill in your details -> a
// temporary PIN is emailed to your school email -> sign in to set your own PIN.
// Uses the kiosk endpoints with source: 'phone' (same checks: school email
// only, one account per card / school ID / email).
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NfcManager from 'react-native-nfc-manager';
import { SmartphoneNfc, ArrowLeft, CheckCircle2, AlertOctagon, Mail, IdCard } from 'lucide-react-native';
import api from '../services/api';
import NFCService from '../services/NFCService';

const C = { bg: '#181D40', card: '#222A5C', field: '#1B2150', border: 'rgba(255,212,28,0.25)', gold: '#FFD41C', text: '#FBFBFB', sub: 'rgba(251,251,251,0.65)', muted: 'rgba(251,251,251,0.4)', danger: '#F87171', ok: '#22C55E' };
const SCHOOL_DOMAIN = 'students.nu-laguna.edu.ph';
const formatSchoolId = (d) => (d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4, 10)}` : d);

export default function SelfRegisterScreen({ navigation }) {
  const [step, setStep] = useState('tap'); // tap | scanning | form | done | exists
  const [uid, setUid] = useState('');
  const [existing, setExisting] = useState(null); // { firstName, activated }
  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', schoolId: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { email, emailSent }

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: k === 'schoolId' ? v.replace(/\D/g, '').slice(0, 10) : v })); setError(''); };

  const tapCard = async () => {
    setError('');
    if (!(await NFCService.init())) { setError("This phone can't read cards (no NFC). Please register at the kiosk or the Treasury Office."); return; }
    if (!(await NFCService.isEnabled())) {
      Alert.alert('Turn on NFC', 'Turn on NFC in your phone settings, then tap your school ID again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => NfcManager.goToNfcSetting?.().catch(() => {}) },
      ]);
      return;
    }
    setStep('scanning');
    const read = await NFCService.readRFIDCard();
    if (!read.success) {
      setStep('tap');
      if (!/cancel/i.test(read.error || '')) setError("Couldn't read your card. Hold it still against the back of your phone and try again.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post('/kiosk/check-card', { rfid: read.uid, source: 'phone' });
      setUid(read.uid);
      if (r.data?.registered) { setExisting({ firstName: r.data.firstName, activated: r.data.activated }); setStep('exists'); }
      else setStep('form');
    } catch (e) {
      setStep('tap');
      setError(e?.response?.data?.error || "Couldn't reach NUCash. Check your internet and try again.");
    } finally { setBusy(false); }
  };

  const cancelScan = async () => { await NFCService.cancelScan().catch(() => {}); setStep('tap'); };

  const submit = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.firstName.trim() || !form.lastName.trim()) return setError('Enter your first and last name as they appear on your ID.');
    if (form.schoolId.length !== 10) return setError('School ID must be 10 digits, e.g. 2023-121235.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter your school email address.');
    setBusy(true); setError('');
    try {
      const r = await api.post('/kiosk/register', {
        source: 'phone', rfid: uid, email,
        firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim(),
        schoolUId: form.schoolId,
      });
      setDone({ email, emailSent: r.data?.emailSent !== false });
      setStep('done');
    } catch (e) {
      setError(e?.response?.data?.error || "Couldn't register. Check your internet and try again.");
    } finally { setBusy(false); }
  };

  const toLogin = () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.back} onPress={() => (step === 'form' ? setStep('tap') : navigation.goBack())} disabled={busy}>
            <ArrowLeft size={18} color={C.gold} /><Text style={s.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={s.title}>Register with your school ID</Text>
          <Text style={s.lead}>Skip the kiosk line. You'll need your NU school ID and your school email.</Text>

          {!!error && (
            <View style={s.err}><AlertOctagon size={16} color={C.danger} /><Text style={s.errText}>{error}</Text></View>
          )}

          {(step === 'tap' || step === 'scanning') && (
            <View style={s.card}>
              <View style={s.ring}><SmartphoneNfc size={44} color={C.gold} /></View>
              {step === 'tap' ? (
                <>
                  <Text style={s.cardTitle}>Tap your school ID</Text>
                  <Text style={s.cardSub}>Press the button, then hold your ID flat against the back of your phone.</Text>
                  <TouchableOpacity style={s.primary} onPress={tapCard} disabled={busy}>
                    {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>Scan my school ID</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.cardTitle}>Hold your ID to the back of your phone</Text>
                  <Text style={s.cardSub}>Keep it still until the next screen appears.</Text>
                  <ActivityIndicator color={C.gold} style={{ marginVertical: 6 }} />
                  <TouchableOpacity style={s.ghost} onPress={cancelScan}><Text style={s.ghostText}>Cancel</Text></TouchableOpacity>
                </>
              )}
            </View>
          )}

          {step === 'exists' && existing && (
            <View style={s.card}>
              <View style={[s.ring, { borderColor: C.ok }]}><IdCard size={40} color={C.ok} /></View>
              <Text style={s.cardTitle}>This ID is already registered{existing.firstName ? ` to ${existing.firstName}` : ''}</Text>
              <Text style={s.cardSub}>
                {existing.activated
                  ? 'Sign in with your school email and PIN.'
                  : 'Check your school email for your temporary PIN, then sign in. You\'ll set your own PIN right after.'}
              </Text>
              <TouchableOpacity style={s.primary} onPress={toLogin}><Text style={s.primaryText}>Go to sign in</Text></TouchableOpacity>
              <Text style={s.fine}>Not your ID? Report it at the Treasury Office.</Text>
            </View>
          )}

          {step === 'form' && (
            <View style={{ gap: 14 }}>
              <View style={s.okRow}><CheckCircle2 size={16} color={C.ok} /><Text style={s.okText}>School ID scanned. Now fill in your details.</Text></View>
              <Field label="First name" value={form.firstName} onChangeText={set('firstName')} autoCapitalize="words" />
              <Field label="Middle name (optional)" value={form.middleName} onChangeText={set('middleName')} autoCapitalize="words" />
              <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} autoCapitalize="words" />
              <Field label="School ID number" value={formatSchoolId(form.schoolId)} onChangeText={set('schoolId')} keyboardType="number-pad" placeholder="2023-121235" />
              <Field label="School email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" placeholder={`yourname@${SCHOOL_DOMAIN}`} />
              <Text style={s.fine}>We'll email a temporary PIN to your school email. Only you can open it, so only you can activate this account.</Text>
              <TouchableOpacity style={s.primary} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>Register</Text>}
              </TouchableOpacity>
              <Text style={s.fine}>Employees register at the Treasury Office.</Text>
            </View>
          )}

          {step === 'done' && done && (
            <View style={s.card}>
              <View style={[s.ring, { borderColor: C.ok }]}><Mail size={40} color={C.ok} /></View>
              <Text style={s.cardTitle}>You're registered!</Text>
              <Text style={s.cardSub}>
                {done.emailSent
                  ? `We sent a temporary PIN to ${done.email}. Sign in with that email and PIN, and you'll set your own PIN next.`
                  : `Your account was created, but the email didn't go through. Visit the Treasury Office to get your temporary PIN.`}
              </Text>
              <TouchableOpacity style={s.primary} onPress={toLogin}><Text style={s.primaryText}>Go to sign in</Text></TouchableOpacity>
              <Text style={s.fine}>Your balance starts at ₱0. Load it at the Treasury Office.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={C.muted} autoCorrect={false} {...props} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 22, paddingBottom: 40, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: C.gold, fontWeight: '700', fontSize: 15 },
  title: { color: C.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  lead: { color: C.sub, fontSize: 14.5, lineHeight: 21 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 22, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  ring: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,212,28,0.08)' },
  cardTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  cardSub: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primary: { alignSelf: 'stretch', backgroundColor: C.gold, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryText: { color: C.bg, fontWeight: '800', fontSize: 16 },
  ghost: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  ghostText: { color: C.text, fontWeight: '700', fontSize: 15 },
  fine: { color: C.muted, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  err: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' },
  errText: { color: C.danger, fontSize: 13.5, flex: 1, lineHeight: 19 },
  okRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  okText: { color: C.ok, fontSize: 13.5, fontWeight: '600' },
  label: { color: C.sub, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { backgroundColor: C.field, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16 },
});

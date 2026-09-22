// src/screens/ScannerModeScreen.js
// SECRET testing tool: turns the phone into an RFID scanner for the web kiosk,
// a Treasury Cash-In window or System Admin's Add New User form. Reads a real
// card via NFC and relays its UID
// through the server; the page reacts as if the card was tapped on a USB
// reader.
// Reached by tapping the NUCash logo 7x on the login screen.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Nfc, ArrowLeft, CheckCircle2, XCircle, Send, Wifi, Monitor, Wallet, UserPlus } from 'lucide-react-native';
import NFCService from '../services/NFCService';
import api from '../services/api';
import maskCard from '../utils/maskCard';

const NAVY = '#0F1227';
const NAVY2 = '#181D40';
const YELLOW = '#FFD41C';
const TEXT = '#FBFBFB';
const MUTED = 'rgba(251,251,251,0.6)';
const PREFS_KEY = 'scanner_mode_prefs'; // { target }
const TARGETS = {
  kiosk: {
    label: 'Kiosk', Icon: Monitor, name: 'kiosk',
    ready: 'Open the kiosk page on your laptop, then tap the button and hold a card to the back of the phone.',
    sent: 'The kiosk should react within a second or two.',
    footer: 'Relays through the NUCash server — kiosk must be on its idle screen',
  },
  treasury: {
    label: 'Treasury', Icon: Wallet, name: 'Treasury',
    ready: 'On the laptop, open Treasury → Cash-In so it waits for a card, then tap the button and hold a card to the back of the phone.',
    sent: 'The Cash-In window should show the student within a second or two.',
    footer: 'Relays through the NUCash server — Cash-In must be waiting for a card',
  },
  sysad: {
    label: 'Sysad', Icon: UserPlus, name: 'Sysad',
    ready: 'On the laptop, open Manage Users → Add New User, then tap the button and hold the new user\'s card to the back of the phone.',
    sent: 'The card should fill in on the Add New User form within a second or two.',
    footer: 'Relays through the NUCash server — Add New User must be open',
  },
};

export default function ScannerModeScreen({ navigation }) {
  const [phase, setPhase] = useState('ready'); // ready | scanning | sending | sent | error
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const [target, setTarget] = useState('kiosk');
  const pulse = useRef(new Animated.Value(1)).current;
  const mounted = useRef(true);
  const dest = TARGETS[target];

  // Remember where scans go between visits
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((v) => {
      try {
        const p = JSON.parse(v || '{}');
        if (TARGETS[p.target]) setTarget(p.target);
      } catch { /* ignore */ }
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ target })).catch(() => {});
  }, [target]);

  const chooseTarget = (t) => {
    if (phase === 'scanning' || phase === 'sending') return;
    setTarget(t);
    setPhase('ready');
    setError('');
  };

  useEffect(() => {
    mounted.current = true;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { mounted.current = false; loop.stop(); NFCService.cleanup?.(); };
  }, [pulse]);

  const scan = async () => {
    setError('');
    setUid('');
    setPhase('scanning');
    try {
      const result = await NFCService.readRFIDCard();
      if (!mounted.current) return;
      if (!result?.success || !result?.uid) {
        setError(result?.error || 'Could not read the card. Try again.');
        setPhase('error');
        return;
      }
      setUid(result.uid);
      setPhase('sending');
      await api.post('/kiosk/relay', { uid: result.uid, target });
      if (!mounted.current) return;
      setPhase('sent');
    } catch (e) {
      if (!mounted.current) return;
      setError(e?.response?.data?.error || `Failed to send to the ${dest.name}. Check the connection.`);
      setPhase('error');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TEXT} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Scanner Mode</Text>
          <Text style={styles.subtitle}>Testing tool — relays card taps to the web</Text>
        </View>
      </View>

      {/* where taps go */}
      <View style={styles.targetWrap}>
        <Text style={styles.targetLabel}>SEND TAPS TO</Text>
        <View style={styles.segment}>
          {Object.entries(TARGETS).map(([key, t]) => {
            const on = key === target;
            return (
              <TouchableOpacity key={key} style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => chooseTarget(key)} activeOpacity={0.85}>
                <t.Icon size={16} color={on ? NAVY2 : MUTED} />
                <Text style={[styles.segText, on && styles.segTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.body}>
        {phase === 'ready' && (
          <>
            <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]}>
              <Nfc size={64} color={YELLOW} />
            </Animated.View>
            <Text style={styles.big}>Ready to scan</Text>
            <Text style={styles.hint}>{dest.ready}</Text>
          </>
        )}

        {phase === 'scanning' && (
          <>
            <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]}>
              <Nfc size={64} color={YELLOW} />
            </Animated.View>
            <Text style={styles.big}>Hold the card to the phone…</Text>
            <Text style={styles.hint}>Keep it steady until it reads.</Text>
          </>
        )}

        {phase === 'sending' && (
          <>
            <ActivityIndicator size="large" color={YELLOW} />
            <Text style={styles.big}>Sending to {dest.name}…</Text>
            <Text style={styles.uid}>{maskCard(uid)}</Text>
          </>
        )}

        {phase === 'sent' && (
          <>
            <View style={[styles.ring, { borderColor: 'rgba(34,197,94,0.4)' }]}>
              <CheckCircle2 size={64} color="#22C55E" />
            </View>
            <Text style={styles.big}>Sent to {dest.name}!</Text>
            <Text style={styles.uid}>{maskCard(uid)}</Text>
            <Text style={styles.hint}>{dest.sent}</Text>
          </>
        )}

        {phase === 'error' && (
          <>
            <View style={[styles.ring, { borderColor: 'rgba(239,68,68,0.4)' }]}>
              <XCircle size={64} color="#EF4444" />
            </View>
            <Text style={styles.big}>Scan failed</Text>
            <Text style={[styles.hint, { color: '#F87171' }]}>{error}</Text>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.scanBtn, phase === 'scanning' && { opacity: 0.6 }]}
          onPress={scan}
          disabled={phase === 'scanning' || phase === 'sending'}
          activeOpacity={0.85}
        >
          {phase === 'sent' ? <Send size={20} color={NAVY2} /> : <Nfc size={20} color={NAVY2} />}
          <Text style={styles.scanBtnText}>
            {phase === 'ready' ? 'Scan a card' : phase === 'sent' || phase === 'error' ? 'Scan another card' : 'Scanning…'}
          </Text>
        </TouchableOpacity>
        <View style={styles.netRow}>
          <Wifi size={12} color={MUTED} />
          <Text style={styles.netText}>{dest.footer}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: NAVY2, borderBottomWidth: 2, borderBottomColor: YELLOW },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  title: { color: TEXT, fontSize: 18, fontWeight: '800' },
  subtitle: { color: MUTED, fontSize: 12, marginTop: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  ring: {
    width: 170, height: 170, borderRadius: 85, borderWidth: 3, borderColor: 'rgba(255,212,28,0.4)',
    backgroundColor: 'rgba(255,212,28,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  big: { color: TEXT, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  uid: { color: YELLOW, fontSize: 18, fontWeight: '800', letterSpacing: 2, marginBottom: 10, fontFamily: 'monospace' },
  hint: { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  footer: { padding: 24, paddingBottom: 30 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: YELLOW, borderRadius: 16, paddingVertical: 17,
  },
  scanBtnText: { color: NAVY2, fontSize: 17, fontWeight: '800' },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  netText: { color: MUTED, fontSize: 11, textAlign: 'center', flexShrink: 1 },
  targetWrap: { paddingHorizontal: 18, paddingTop: 16 },
  targetLabel: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  segment: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,212,28,0.2)' },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10 },
  segBtnOn: { backgroundColor: YELLOW },
  segText: { color: MUTED, fontSize: 13.5, fontWeight: '700' },
  segTextOn: { color: NAVY2 },
});

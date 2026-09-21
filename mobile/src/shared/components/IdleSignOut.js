// src/shared/components/IdleSignOut.js
// Student/employee app only: after IDLE_MINUTES without a touch, a warning
// with a countdown appears; when it runs out the app signs out. Same rules as
// the website (client/src/components/shared/IdleTimeout.jsx). Drivers and
// merchants never mount this.
//
// React Native modals are separate windows, so touches inside them never
// reach the screen's root view. Screens use ActivityModal instead of Modal so
// typing in Send Money, Change PIN, etc. still counts as activity.

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, AppState, AccessibilityInfo } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Clock, LogOut } from 'lucide-react-native';

export const IDLE_MINUTES = 5;
const WARNING_SECONDS = 60;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const SIGN_OUT_MS = IDLE_MS + WARNING_SECONDS * 1000;

let lastActivity = Date.now();
export const markActive = () => { lastActivity = Date.now(); };

export function ActivityModal({ children, ...props }) {
  return (
    <Modal {...props}>
      <View style={{ flex: 1 }} onTouchStart={markActive}>{children}</View>
    </Modal>
  );
}

const formatClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// onSignOut(reason): 'idle' when the countdown ran out, 'manual' for "Sign out now"
export default function IdleSignOut({ theme, onSignOut }) {
  const [secondsLeft, setSecondsLeft] = useState(null); // null = no warning
  const warning = useRef(false);
  const done = useRef(false);
  const signOutRef = useRef(onSignOut);
  signOutRef.current = onSignOut;

  useEffect(() => {
    markActive(); // opening the dashboard counts
    // Timestamps, not timers: time spent with the app in the background or the
    // screen off still adds up, and is checked the moment the app comes back.
    const tick = () => {
      if (done.current) return;
      const idle = Date.now() - lastActivity;
      if (idle >= SIGN_OUT_MS) {
        done.current = true;
        setSecondsLeft(null);
        signOutRef.current('idle');
      } else if (idle >= IDLE_MS) {
        warning.current = true;
        setSecondsLeft(Math.ceil((SIGN_OUT_MS - idle) / 1000));
      } else if (warning.current) {
        warning.current = false;
        setSecondsLeft(null);
      }
    };
    const interval = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') tick(); });
    return () => { clearInterval(interval); sub.remove(); };
  }, []);

  useEffect(() => {
    if ([60, 30, 10].includes(secondsLeft)) {
      AccessibilityInfo.announceForAccessibility(`${secondsLeft} seconds until you are signed out`);
    }
  }, [secondsLeft]);

  const stay = () => {
    markActive();
    warning.current = false;
    setSecondsLeft(null);
  };
  const signOutNow = () => {
    done.current = true;
    setSecondsLeft(null);
    signOutRef.current('manual');
  };

  if (secondsLeft === null) return null;

  const urgent = secondsLeft <= 10;
  const ring = urgent ? theme.danger : theme.accent;
  const R = 50;
  const circumference = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(1, secondsLeft / WARNING_SECONDS));

  // Only the button counts while the warning is up (a plain Modal, not ActivityModal).
  // The back button means "stay".
  return (
    <Modal visible transparent animationType="fade" onRequestClose={stay} statusBarTranslucent>
      <View style={[s.overlay, { backgroundColor: theme.overlay }]}>
        <View
          accessibilityViewIsModal
          style={[s.card, { backgroundColor: theme.cardSolid, borderColor: urgent ? `${theme.danger}88` : theme.border }]}
        >
          <View style={s.ringWrap}>
            <Svg width={124} height={124}>
              <Circle cx={62} cy={62} r={R} strokeWidth={8} fill="none"
                stroke={theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,29,64,0.08)'} />
              <Circle cx={62} cy={62} r={R} strokeWidth={8} fill="none" strokeLinecap="round"
                stroke={ring} strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - progress)}
                rotation={-90} origin="62, 62" />
            </Svg>
            <View style={s.ringCenter}>
              <Clock size={18} color={ring} />
              <Text style={[s.clock, { color: urgent ? theme.danger : theme.text }]}>{formatClock(secondsLeft)}</Text>
            </View>
          </View>

          <Text style={[s.title, { color: theme.text }]}>Are you still there?</Text>
          <Text style={[s.body, { color: theme.textSecondary }]}>
            You haven't done anything for {IDLE_MINUTES} minutes. To keep your account safe, we'll sign you out when the timer runs out.
          </Text>

          <TouchableOpacity style={[s.primary, { backgroundColor: theme.accent }]} onPress={stay} activeOpacity={0.85}>
            <Text style={[s.primaryText, { color: theme.onAccent }]}>Stay signed in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.secondary, { borderColor: theme.border }]} onPress={signOutNow} activeOpacity={0.7}>
            <LogOut size={16} color={theme.textSecondary} />
            <Text style={[s.secondaryText, { color: theme.textSecondary }]}>Sign out now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, borderRadius: 22, borderWidth: 2, padding: 24, alignItems: 'center' },
  ringWrap: { width: 124, height: 124, marginBottom: 18 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  clock: { fontSize: 30, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 22 },
  primary: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  primaryText: { fontSize: 15, fontWeight: '800' },
  secondary: { width: '100%', paddingVertical: 13, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});

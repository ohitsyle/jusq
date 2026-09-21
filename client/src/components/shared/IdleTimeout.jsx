// src/components/shared/IdleTimeout.jsx
// Signs people out of the signed-in web app (students and every admin role)
// after IDLE_MINUTES without mouse, keyboard, touch or scrolling. A warning
// with a countdown comes first; only "Stay signed in" dismisses it.
// Activity in any open NUCash tab counts (shared through localStorage), so
// working in one tab keeps the others signed in. Background polling (live
// maps, dashboards) is not activity.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';

export const IDLE_MINUTES = 5;
const WARNING_SECONDS = 60;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const SIGN_OUT_MS = IDLE_MS + WARNING_SECONDS * 1000;
const SHARED_KEY = 'nucash_last_activity';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];

const isSignedInArea = (path) => /^\/(user|admin)(\/|$)/.test(path) || path === '/faq';
const hasSession = () => !!(localStorage.getItem('adminToken') || localStorage.getItem('userToken'));
const readShared = () => {
  const v = Number(localStorage.getItem(SHARED_KEY));
  return Number.isFinite(v) ? v : 0;
};
const formatClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function IdleTimeout() {
  const { pathname } = useLocation();
  const { theme, isDarkMode } = useTheme();
  const enabled = isSignedInArea(pathname) && hasSession();

  const [secondsLeft, setSecondsLeft] = useState(null); // null = no warning showing
  const lastLocal = useRef(Date.now());
  const lastWrite = useRef(0);
  const warning = useRef(false);
  const signingOut = useRef(false);
  const savedTitle = useRef(null);

  const markActive = useCallback((force = false) => {
    const now = Date.now();
    lastLocal.current = now;
    // Other tabs only need to hear about it every few seconds
    if (force || now - lastWrite.current > 5000) {
      lastWrite.current = now;
      try { localStorage.setItem(SHARED_KEY, String(now)); } catch { /* storage full / blocked */ }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    if (localStorage.getItem('adminToken')) {
      // Logged for the admin audit trail; don't hang if the server is slow
      await Promise.race([api.post('/admin/auth/logout').catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
    }
    try {
      sessionStorage.setItem('nucash_signout_notice', JSON.stringify({
        title: 'Signed out',
        message: `You were signed out after ${IDLE_MINUTES} minutes without activity. Please sign in again.`
      }));
    } catch { /* private mode */ }
    const themePref = localStorage.getItem('nucash-theme');
    localStorage.clear();
    if (themePref) localStorage.setItem('nucash-theme', themePref);
    window.location.assign('/login');
  }, []);

  const staySignedIn = useCallback(() => {
    warning.current = false;
    markActive(true);
    setSecondsLeft(null);
  }, [markActive]);

  useEffect(() => {
    if (!enabled) {
      warning.current = false;
      setSecondsLeft(null);
      return undefined;
    }
    signingOut.current = false;
    markActive(true); // opening or reloading a signed-in page counts

    // While the warning is up, only the button counts — a bumped mouse shouldn't.
    const onActivity = () => { if (!warning.current) markActive(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));

    // Timestamps, not timers: a sleeping laptop or background tab still adds up.
    const tick = () => {
      const idle = Date.now() - Math.max(lastLocal.current, readShared());
      if (idle >= SIGN_OUT_MS) {
        signOut();
      } else if (idle >= IDLE_MS) {
        warning.current = true;
        setSecondsLeft(Math.ceil((SIGN_OUT_MS - idle) / 1000));
      } else if (warning.current) {
        warning.current = false; // "Stay signed in" or activity in another tab
        setSecondsLeft(null);
      }
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
    };
  }, [enabled, markActive, signOut]);

  // Countdown in the tab title, so it's visible from another tab
  const showing = secondsLeft !== null;
  useEffect(() => {
    if (showing) {
      if (savedTitle.current === null) savedTitle.current = document.title;
      document.title = `(${formatClock(secondsLeft)}) Are you still there? · NUCash`;
    } else if (savedTitle.current !== null) {
      document.title = savedTitle.current;
      savedTitle.current = null;
    }
  }, [showing, secondsLeft]);

  useEffect(() => {
    if (!showing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') staySignedIn(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showing, staySignedIn]);

  if (!showing) return null;

  const accent = theme.accent.primary;
  const urgent = secondsLeft <= 10;
  const ringColor = urgent ? '#EF4444' : accent;
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(1, secondsLeft / WARNING_SECONDS));
  // Announce to screen readers at a few points only, not every second
  const announce = [60, 30, 10].includes(secondsLeft) ? `${secondsLeft} seconds until you are signed out` : '';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        className="w-full max-w-sm rounded-2xl border-2 p-6 sm:p-7 text-center"
        style={{
          background: isDarkMode ? '#1E2347' : '#FFFFFF',
          borderColor: urgent ? 'rgba(239,68,68,0.5)' : theme.border.hover,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)'
        }}
      >
        <div className="relative w-[128px] h-[128px] mx-auto mb-5">
          <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90" aria-hidden>
            <circle cx="64" cy="64" r={R} fill="none" strokeWidth="8"
              stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(24,29,64,0.08)'} />
            <circle cx="64" cy="64" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
              stroke={ringColor}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Clock className="w-5 h-5 mb-1" style={{ color: ringColor }} aria-hidden />
            <span className="text-3xl font-extrabold tabular-nums leading-none" style={{ color: urgent ? '#EF4444' : theme.text.primary }}>
              {formatClock(secondsLeft)}
            </span>
          </div>
        </div>

        <h2 id="idle-title" className="text-xl font-extrabold mb-2" style={{ color: theme.text.primary }}>
          Are you still there?
        </h2>
        <p id="idle-desc" className="text-sm leading-relaxed mb-6" style={{ color: theme.text.secondary }}>
          You haven't done anything for {IDLE_MINUTES} minutes. To keep your account safe, we'll sign you out when the timer runs out.
        </p>
        <span className="sr-only" aria-live="assertive">{announce}</span>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={staySignedIn}
            className="w-full py-3 rounded-xl font-bold text-sm transition-transform hover:-translate-y-0.5"
            style={{ background: accent, color: theme.accent.secondary, boxShadow: `0 6px 18px ${isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)'}` }}
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full py-3 rounded-xl font-semibold text-sm border flex items-center justify-center gap-2 transition-colors"
            style={{ color: theme.text.secondary, borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(24,29,64,0.15)', background: 'transparent' }}
          >
            <LogOut className="w-4 h-4" aria-hidden /> Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}

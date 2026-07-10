// src/components/shared/NotifyHost.jsx
// Themed pop-up replacement for react-toastify. vite.config aliases the
// 'react-toastify' module here, so every existing `toast.success(...)` call
// in the app renders this centered pop-up instead of a corner toast.
//
// Behavior: auto-dismisses on a quick timer (with a shrinking progress bar),
// on OK, on Escape, or on a click anywhere else on the screen.
// `toast.warn(msg, { autoClose: false })` sticks until dismissed.
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const DEFAULT_DURATION = { success: 2200, info: 2600, warning: 3500, error: 3800 };

let seq = 0;
const notify = (type, message, opts = {}) => {
  window.dispatchEvent(new CustomEvent('nucash:notify', {
    detail: { id: ++seq, type, message, ...opts }
  }));
};

// Drop-in surface for the react-toastify API used across the app.
export const toast = Object.assign((message, opts) => notify('info', message, opts), {
  success: (message, opts) => notify('success', message, opts),
  error: (message, opts) => notify('error', message, opts),
  info: (message, opts) => notify('info', message, opts),
  warn: (message, opts) => notify('warning', message, opts),
  warning: (message, opts) => notify('warning', message, opts),
  dismiss: () => window.dispatchEvent(new CustomEvent('nucash:notify-dismiss')),
});

const CONFIGS = {
  success: { color: '#10B981', bg: 'rgba(16,185,129,0.15)', Icon: CheckCircle, title: 'Success' },
  error: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', Icon: XCircle, title: 'Something went wrong' },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', Icon: AlertTriangle, title: 'Heads up' },
  info: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', Icon: Info, title: 'Notice' },
};

export default function NotifyHost() {
  const { theme, isDarkMode } = useTheme();
  const [note, setNote] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const onNotify = (e) => setNote(e.detail || null);
    const onDismiss = () => setNote(null);
    const onKey = (e) => { if (e.key === 'Escape') setNote(null); };
    window.addEventListener('nucash:notify', onNotify);
    window.addEventListener('nucash:notify-dismiss', onDismiss);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('nucash:notify', onNotify);
      window.removeEventListener('nucash:notify-dismiss', onDismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Auto-dismiss timer — restarts whenever a new notification arrives
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!note || note.autoClose === false) return;
    const ms = typeof note.autoClose === 'number' ? note.autoClose : DEFAULT_DURATION[note.type] || 2600;
    timerRef.current = setTimeout(() => setNote(null), ms);
    return () => clearTimeout(timerRef.current);
  }, [note]);

  if (!note) return null;

  const cfg = CONFIGS[note.type] || CONFIGS.info;
  const Icon = cfg.Icon;
  const duration = note.autoClose === false ? null
    : typeof note.autoClose === 'number' ? note.autoClose
    : DEFAULT_DURATION[note.type] || 2600;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4" onClick={() => setNote(null)}>
      {/* subtle click-catcher backdrop — clicking anywhere dismisses */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }} />
      <div
        key={note.id}
        onClick={(e) => e.stopPropagation()}
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: cfg.color }}
        className="relative rounded-2xl shadow-2xl border-2 w-full max-w-sm overflow-hidden animate-notifyPop"
      >
        <div style={{ background: cfg.bg }} className="p-6 flex flex-col items-center text-center">
          <div style={{ background: cfg.bg, color: cfg.color }} className="w-14 h-14 rounded-full flex items-center justify-center mb-3">
            <Icon className="w-7 h-7" />
          </div>
          <h3 style={{ color: cfg.color }} className="text-lg font-bold mb-1">{note.title || cfg.title}</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm">{note.message}</p>
        </div>
        <div className="px-4 pt-3 pb-4">
          <button
            onClick={() => setNote(null)}
            style={{ background: cfg.color, color: '#FFFFFF' }}
            className="w-full py-2.5 rounded-xl font-semibold transition-all hover:opacity-90"
          >
            OK
          </button>
        </div>
        {/* time-left bar */}
        {duration && (
          <div
            key={`bar-${note.id}`}
            className="absolute bottom-0 left-0 h-1 animate-notifyBar"
            style={{ background: cfg.color, animationDuration: `${duration}ms` }}
          />
        )}
      </div>
      <style>{`
        @keyframes notifyPop { from { opacity: 0; transform: scale(0.92) translateY(-14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-notifyPop { animation: notifyPop 0.22s cubic-bezier(0.34, 1.4, 0.64, 1); }
        @keyframes notifyBar { from { width: 100%; } to { width: 0%; } }
        .animate-notifyBar { animation-name: notifyBar; animation-timing-function: linear; animation-fill-mode: forwards; }
      `}</style>
    </div>
  );
}

// Compatibility export — App.jsx mounts <ToastContainer /> from 'react-toastify';
// with the alias in place that renders this host. Props are ignored.
export const ToastContainer = NotifyHost;

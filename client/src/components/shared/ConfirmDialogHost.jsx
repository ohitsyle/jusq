// src/components/shared/ConfirmDialogHost.jsx
// Global themed replacement for window.confirm().
//   import { confirmDialog } from '.../shared/ConfirmDialogHost';
//   if (!(await confirmDialog('Delete this?', { title: 'Delete Route', confirmText: 'Delete', type: 'danger' }))) return;
// One <ConfirmDialogHost/> is mounted in App; visuals mirror the sysad ConfirmModal.
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { AlertTriangle, Info } from 'lucide-react';

let resolver = null;

export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    resolver = resolve;
    window.dispatchEvent(new CustomEvent('nucash:confirm', { detail: { message, ...opts } }));
  });
}

export default function ConfirmDialogHost() {
  const { theme, isDarkMode } = useTheme();
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const onAsk = (e) => setDialog(e.detail || {});
    window.addEventListener('nucash:confirm', onAsk);
    return () => window.removeEventListener('nucash:confirm', onAsk);
  }, []);

  if (!dialog) return null;

  const configs = {
    danger: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: AlertTriangle },
    warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: AlertTriangle },
    info: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Info }
  };
  const config = configs[dialog.type || 'danger'] || configs.danger;
  const Icon = config.icon;

  const answer = (val) => {
    setDialog(null);
    if (resolver) { resolver(val); resolver = null; }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => answer(false)} />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: config.color }}
        className="relative rounded-2xl shadow-2xl border-2 w-full max-w-sm overflow-hidden animate-confirmSlide"
      >
        <div style={{ background: config.bg }} className="p-6 flex flex-col items-center text-center">
          <div style={{ background: config.bg, color: config.color }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Icon className="w-8 h-8" />
          </div>
          <h3 style={{ color: config.color }} className="text-xl font-bold mb-2">{dialog.title || 'Are you sure?'}</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm">{dialog.message}</p>
        </div>
        <div className="p-4 flex gap-3">
          <button
            onClick={() => answer(false)}
            style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
            className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-80"
          >
            {dialog.cancelText || 'Cancel'}
          </button>
          <button
            onClick={() => answer(true)}
            style={{ background: config.color, color: '#FFFFFF' }}
            className="flex-1 py-3 rounded-xl font-semibold transition-all hover:opacity-90"
          >
            {dialog.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirmSlide { from { opacity: 0; transform: scale(0.9) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-confirmSlide { animation: confirmSlide 0.25s ease-out; }
      `}</style>
    </div>
  );
}

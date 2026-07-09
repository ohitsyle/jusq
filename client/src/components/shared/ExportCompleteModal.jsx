// src/components/shared/ExportCompleteModal.jsx
// Global "Export Complete" dialog. Mounted ONCE in App; every page that calls
// exportToCSV() gets this modal automatically via the 'nucash:export-complete'
// window event — no per-page wiring. Visuals mirror the sysad NotificationModal.
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { CheckCircle } from 'lucide-react';

export default function ExportCompleteModal() {
  const { theme, isDarkMode } = useTheme();
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const onDone = (e) => setMessage(e.detail?.message || 'Data exported to CSV successfully.');
    window.addEventListener('nucash:export-complete', onDone);
    return () => window.removeEventListener('nucash:export-complete', onDone);
  }, []);

  if (!message) return null;

  const color = '#10B981';
  const bg = 'rgba(16,185,129,0.15)';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMessage(null)} />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: color }}
        className="relative rounded-2xl shadow-2xl border-2 w-full max-w-sm overflow-hidden animate-exportModalSlide"
      >
        <div style={{ background: bg }} className="p-6 flex flex-col items-center text-center">
          <div style={{ background: bg, color }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 style={{ color }} className="text-xl font-bold mb-2">Export Complete</h3>
          <p style={{ color: theme.text.secondary }} className="text-sm">{message}</p>
        </div>
        <div className="p-4">
          <button
            onClick={() => setMessage(null)}
            style={{ background: color, color: '#FFFFFF' }}
            className="w-full py-3 rounded-xl font-semibold transition-all hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
      <style>{`
        @keyframes exportModalSlide { from { opacity: 0; transform: scale(0.9) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-exportModalSlide { animation: exportModalSlide 0.25s ease-out; }
      `}</style>
    </div>
  );
}

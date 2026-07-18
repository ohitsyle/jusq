// src/components/shared/ModalShell.jsx
// The one modal chrome for the whole app, modeled on the sysad Add User
// modal: dimmed blurred backdrop, solid card, accent gradient header with
// bold accent title + X, scrollable body. Wrap any modal's content in this
// so every dialog looks the same in both themes.
//
//   <ModalShell title="New Campaign" icon={Plus} onClose={close} maxWidth="max-w-[600px]">
//     ...form...
//   </ModalShell>
import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { X } from 'lucide-react';

export default function ModalShell({ title, icon: Icon, onClose, children, maxWidth = 'max-w-lg', dismissable = true, bodyClassName = 'p-6 max-h-[75vh] overflow-y-auto' }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => dismissable && onClose && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', borderColor: theme.border.primary }}
        className={`relative rounded-2xl shadow-2xl border w-full ${maxWidth} overflow-hidden animate-modalShellIn`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent gradient header */}
        <div
          style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(255,212,28,0.3) 0%, rgba(255,212,28,0.1) 100%)' : 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 100%)' }}
          className="px-6 py-5 flex items-center justify-between"
        >
          <h3 style={{ color: theme.accent.primary }} className="text-xl font-bold flex items-center gap-2 m-0">
            {Icon && <Icon className="w-5 h-5" />} {title}
          </h3>
          {onClose && (
            <button onClick={onClose} style={{ color: theme.text.secondary }} className="hover:opacity-70">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className={bodyClassName}>{children}</div>
      </div>
      <style>{`
        @keyframes modalShellIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-modalShellIn { animation: modalShellIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

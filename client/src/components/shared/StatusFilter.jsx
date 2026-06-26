// src/admin/components/common/StatusFilter.jsx
// Pill-group (segmented control) status filter — matches the sysad filter-bar style.
import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function StatusFilter({ value, onChange, options }) {
  const { theme, isDarkMode } = useTheme();
  const allOptions = [{ value: '', label: 'All' }, ...options];

  return (
    <div
      className="flex gap-1 p-1 rounded-xl flex-wrap"
      style={{ background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F3F4F6' }}
    >
      {allOptions.map((option) => (
        <button
          key={option.value || 'all'}
          onClick={() => onChange(option.value)}
          style={{
            background: value === option.value ? theme.accent.primary : 'transparent',
            color: value === option.value ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 whitespace-nowrap"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

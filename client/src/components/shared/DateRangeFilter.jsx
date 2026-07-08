// src/admin/components/common/DateRangeFilter.jsx
// Inline date-range filter — matches the sysad filter-bar style (theme-aware).
import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemedDateInput } from './ThemedControls';

export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }) {
  const { theme, isDarkMode } = useTheme();

  const inputStyle = {
    padding: '8px 12px',
    border: `1px solid ${theme.border.primary}`,
    borderRadius: '12px',
    background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB',
    color: theme.text.primary,
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none'
  };

  return (
    <div className="flex gap-2 items-center">
      <ThemedDateInput
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        style={inputStyle}
                  max={endDate || new Date().toLocaleDateString('en-CA')}
                />
      <span style={{ color: theme.text.tertiary, fontSize: '12px' }}>to</span>
      <ThemedDateInput
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        style={inputStyle}
                  min={startDate || undefined} max={new Date().toLocaleDateString('en-CA')}
                />
      {(startDate || endDate) && (
        <button
          onClick={() => { onStartChange(''); onEndChange(''); }}
          style={{
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#EF4444',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

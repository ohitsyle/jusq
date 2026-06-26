// src/admin/components/common/SearchBar.jsx
// Reusable search bar — matches the sysad filter-bar style (theme-aware, rounded).

import React from 'react';
import { Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function SearchBar({ value, onChange, placeholder = "Search..." }) {
  const { theme, isDarkMode } = useTheme();

  return (
    <div className="relative flex-1 min-w-[200px] max-w-[320px]">
      <Search
        className="w-4 h-4"
        style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: theme.text.tertiary
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 16px 10px 40px',
          border: `1px solid ${theme.border.primary}`,
          borderRadius: '12px',
          background: isDarkMode ? 'rgba(30,35,71,0.8)' : '#F9FAFB',
          color: theme.text.primary,
          fontSize: '14px',
          transition: 'all 0.2s',
          outline: 'none',
          boxSizing: 'border-box'
        }}
        onFocus={(e) => { e.target.style.borderColor = theme.accent.primary; }}
        onBlur={(e) => { e.target.style.borderColor = theme.border.primary; }}
      />
    </div>
  );
}

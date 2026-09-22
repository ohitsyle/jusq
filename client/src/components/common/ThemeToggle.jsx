// src/components/common/ThemeToggle.jsx
// Theme toggle button component

import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: isDarkMode ? 'rgba(255, 212, 28, 0.15)' : 'rgba(24, 29, 64, 0.1)',
        border: isDarkMode ? '2px solid rgba(255, 212, 28, 0.3)' : '2px solid rgba(24, 29, 64, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDarkMode ? 'rgba(255, 212, 28, 0.25)' : 'rgba(24, 29, 64, 0.15)';
        e.currentTarget.style.transform = 'scale(1.05) rotate(15deg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDarkMode ? 'rgba(255, 212, 28, 0.15)' : 'rgba(24, 29, 64, 0.1)';
        e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
      }}
    >
      {isDarkMode
        ? <Sun style={{ width: 20, height: 20, color: '#FFD41C' }} />
        : <Moon style={{ width: 19, height: 19, color: '#181D40' }} />}
    </button>
  );
}

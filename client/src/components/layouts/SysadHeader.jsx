// src/components/layouts/SysadHeader.jsx
// System Admin header with gold/yellow accent theme (matching NU branding)

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../common/ThemeToggle';
import { Shield, User, LogOut } from 'lucide-react';
import SwitchAccountItem from './SwitchAccountItem';

export default function SysadHeader({ adminData, onLogout, onOpenProfile }) {
  const { theme, isDarkMode } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Use theme accent colors (gold in dark mode, blue in light mode)
  const sysadAccent = theme.accent.primary;
  const sysadAccentLight = isDarkMode ? 'rgba(255, 212, 28, 0.2)' : 'rgba(59, 130, 246, 0.2)';
  const sysadAccentBorder = isDarkMode ? 'rgba(255, 212, 28, 0.3)' : 'rgba(59, 130, 246, 0.3)';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = () => {
    if (!adminData) return 'SA';
    const first = adminData.firstName?.[0] || '';
    const last = adminData.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'SA';
  };

  const getFullName = () => {
    if (!adminData) return 'System Admin';
    return `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || 'System Admin';
  };

  return (
    <header className="px-4 md:px-10" style={{
      background: isDarkMode ? 'linear-gradient(135deg, #181D40 0%, #0f1227 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 100%)',
      paddingTop: '20px',
      paddingBottom: '20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `2px solid ${sysadAccent}`,
      boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(59, 130, 246, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      {/* Left Side - Logo & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{
          width: '45px',
          height: '45px',
          background: isDarkMode
            ? 'linear-gradient(135deg, #FFD41C 0%, #FFC700 100%)'
            : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '22px',
          color: isDarkMode ? '#181D40' : '#FFFFFF',
          boxShadow: isDarkMode ? '0 0 0 3px rgba(255, 212, 28, 0.2)' : '0 0 0 3px rgba(59, 130, 246, 0.2)'
        }}>
          NU
        </div>

        <div>
          <h1 className="text-lg md:text-2xl whitespace-nowrap" style={{ fontWeight: 700, color: theme.text.primary, letterSpacing: '0.5px', margin: 0 }}>
            NUCash System
          </h1>
          <p className="hidden sm:block" style={{ fontSize: '12px', color: sysadAccent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: '2px 0 0 0' }}>
            System Administration Dashboard
          </p>
        </div>
      </div>

      {/* Right Side - Live Indicator & Profile */}
      <div className="gap-3 md:gap-5" style={{ display: 'flex', alignItems: 'center' }}>
        {/* Live Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(34, 197, 94, 0.2)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(34, 197, 94, 0.3)'
        }}>
          <div style={{ width: '7px', height: '7px', background: '#22C55E', borderRadius: '50%', animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#22C55E' }}>LIVE</span>
        </div>

        {/* System Admin Badge (hidden on narrow windows — the profile menu shows the role) */}
        <div className="hidden lg:flex" style={{
          alignItems: 'center',
          gap: '6px',
          background: sysadAccentLight,
          padding: '6px 14px',
          borderRadius: '20px',
          border: `1px solid ${sysadAccentBorder}`
        }}>
          <Shield style={{ width: 13, height: 13, color: sysadAccent }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: sysadAccent }}>SYSTEM ADMIN</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: sysadAccentLight,
              border: `2px solid ${sysadAccent}`,
              borderRadius: '25px',
              padding: '4px 12px 4px 4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 212, 28, 0.3)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = sysadAccentLight;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              background: isDarkMode
                ? 'linear-gradient(135deg, #FFD41C 0%, #FFC700 100%)'
                : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '14px',
              color: isDarkMode ? '#181D40' : '#FFFFFF',
              flexShrink: 0
            }}>
              {getInitials()}
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
              <path d="M2 4L6 8L10 4" stroke={sysadAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '52px',
              right: 0,
              background: isDarkMode ? 'rgba(30, 35, 71, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              borderRadius: '12px',
              padding: '8px 0',
              minWidth: '220px',
              border: `2px solid ${theme.border.primary}`,
              boxShadow: isDarkMode ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.15)',
              animation: 'fadeIn 0.2s ease'
            }}>
              {/* Profile Info */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border.primary}`, marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: theme.text.primary, marginBottom: '4px' }}>{getFullName()}</div>
                <div style={{ fontSize: '12px', color: theme.text.secondary }}>{adminData?.email || 'sysad@nu.edu.ph'}</div>
                <div style={{ fontSize: '10px', color: sysadAccent, textTransform: 'uppercase', fontWeight: 600, marginTop: '6px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Shield style={{ width: 12, height: 12 }} /> System Administrator
                </div>
              </div>

              {/* Menu Items */}
              <SwitchAccountItem onDone={() => setShowDropdown(false)} />
              <button
                onClick={() => { setShowDropdown(false); onOpenProfile(); }}
                style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: theme.text.primary, fontSize: '14px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = sysadAccentLight; e.currentTarget.style.color = sysadAccent; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.text.primary; }}
              >
                <User style={{ width: 16, height: 16 }} />
                <span>Manage Profile</span>
              </button>

              <div style={{ height: '1px', background: theme.border.primary, margin: '8px 0' }} />

              <button
                onClick={() => { setShowDropdown(false); onLogout(); }}
                style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: '#EF4444', fontSize: '14px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut style={{ width: 16, height: 16 }} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}

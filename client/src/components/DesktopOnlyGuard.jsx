// src/components/DesktopOnlyGuard.jsx
// Shown when an admin tries to open a dashboard on a phone. Admin dashboards
// are desktop/laptop only.
import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';

export default function DesktopOnlyGuard() {
  const goLogin = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F1227 0%, #181D40 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: 400, width: '100%', textAlign: 'center',
        background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,212,28,0.3)',
        borderRadius: 20, padding: '36px 28px'
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: '#FFD41C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontWeight: 800, fontSize: 22, color: '#181D40'
        }}>NU</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
          <Smartphone style={{ width: 26, height: 26, color: '#EF4444' }} />
          <span style={{ color: 'rgba(251,251,251,0.4)', fontSize: 22 }}>→</span>
          <Monitor style={{ width: 30, height: 30, color: '#FFD41C' }} />
        </div>

        <h1 style={{ color: '#FBFBFB', fontSize: 20, fontWeight: 800, margin: '0 0 10px' }}>
          Desktop Access Only
        </h1>
        <p style={{ color: 'rgba(251,251,251,0.65)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
          The NUCash admin dashboard is only available on a desktop or laptop computer.
          Please open it on a computer to continue managing the system.
        </p>

        <button
          onClick={goLogin}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: '#FFD41C', color: '#181D40', fontWeight: 800, fontSize: 15, cursor: 'pointer'
          }}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

// src/admin/components/common/ExportButton.jsx
// Reusable CSV export button — green pill matching the sysad/Logs export style.

import React from 'react';
import { Download } from 'lucide-react';

export default function ExportButton({ onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 18px',
        background: disabled ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)',
        border: `1px solid ${disabled ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.3)'}`,
        borderRadius: '12px',
        color: disabled ? 'rgba(16,185,129,0.5)' : '#10B981',
        fontSize: '13px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.8'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      <Download className="w-4 h-4" />
      <span>Export CSV</span>
    </button>
  );
}

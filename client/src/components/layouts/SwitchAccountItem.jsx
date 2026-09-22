// Profile-menu item for admins with their own NUCash wallet:
// "Switch to My Wallet" on admin pages, "Switch to Admin Dashboard" in the wallet.
import React, { useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTheme } from '../../context/ThemeContext';
import { switchAccount, switchTarget } from '../../utils/accountSwitch';

export default function SwitchAccountItem({ onDone }) {
  const { theme, isDarkMode } = useTheme();
  const [busy, setBusy] = useState(false);
  const target = switchTarget();
  if (!target) return null;

  const go = async () => {
    setBusy(true);
    try {
      await switchAccount();
    } catch (e) {
      toast.error(e?.error || e?.message || 'Could not switch accounts. Please try again.');
      setBusy(false);
      onDone && onDone();
    }
  };

  return (
    <button
      onClick={go}
      disabled={busy}
      style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: theme.text.primary, fontSize: '14px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'rgba(255, 212, 28, 0.1)' : 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = theme.accent.primary; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.text.primary; }}
    >
      {busy ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <ArrowLeftRight style={{ width: 16, height: 16 }} />}
      <span>{target === 'wallet' ? 'Switch to My Wallet' : 'Switch to Admin Dashboard'}</span>
    </button>
  );
}

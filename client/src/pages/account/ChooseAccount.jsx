// src/pages/account/ChooseAccount.jsx
// After an admin with their own NUCash wallet signs in (or activates):
// pick the Admin Dashboard or My Wallet. The login already prepared both
// sessions (see utils/accountSwitch.js), so no second PIN is needed.
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowLeftRight, ChevronRight, LogOut } from 'lucide-react';
import { PENDING_KEY, startAdminSession, startWalletSession } from '../../utils/accountSwitch';

const ROLE_LABEL = {
  sysad: 'System Administrator',
  treasury: 'Treasury',
  accounting: 'Accounting',
  motorpool: 'Motorpool',
  merchant: 'Merchant',
  marketing: 'Marketing',
};

export default function ChooseAccount() {
  const navigate = useNavigate();
  const pending = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; }
  }, []);

  if (!pending?.admin?.token || !pending?.wallet?.token) {
    // Opened directly or the tab was reloaded after choosing: sign in again
    setTimeout(() => navigate('/login', { replace: true }), 0);
    return null;
  }

  const { admin, wallet } = pending;
  const firstName = admin.firstName || admin.name || 'there';

  const choose = (which) => {
    sessionStorage.removeItem(PENDING_KEY);
    const { token, linkedWallet, ...adminData } = admin;
    const path = which === 'admin' ? startAdminSession(adminData, token) : startWalletSession(wallet);
    window.location.assign(path);
  };
  const cancel = () => {
    sessionStorage.removeItem(PENDING_KEY);
    navigate('/login', { replace: true });
  };

  const Option = ({ onClick, Icon, title, subtitle }) => (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-[rgba(255,212,28,0.25)] bg-[rgba(15,18,39,0.55)] text-left transition-all hover:border-[#FFD41C] hover:bg-[rgba(255,212,28,0.08)] focus:outline-none focus-visible:border-[#FFD41C]"
    >
      <span className="w-12 h-12 rounded-xl bg-[rgba(255,212,28,0.15)] flex items-center justify-center flex-shrink-0">
        <Icon className="w-6 h-6 text-[#FFD41C]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[#FBFBFB] font-bold text-base">{title}</span>
        <span className="block text-[rgba(251,251,251,0.6)] text-sm mt-0.5">{subtitle}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-[rgba(251,251,251,0.4)] group-hover:text-[#FFD41C] transition-colors" />
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1227] to-[#181D40] relative overflow-hidden p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#FFD41C] opacity-5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#FFD41C] opacity-5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 bg-[rgba(30,35,71,0.95)] rounded-[20px] p-8 sm:p-10 w-full max-w-[480px] border-2 border-[rgba(255,212,28,0.3)] backdrop-blur-sm shadow-2xl">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FFD41C] rounded-full mb-5 shadow-lg shadow-[rgba(255,212,28,0.4)]">
            <span className="text-4xl font-extrabold text-[#181D40]">NU</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#FBFBFB] mb-1 tracking-tight">Welcome, {firstName}</h1>
          <p className="text-[rgba(251,251,251,0.6)] text-sm">Where would you like to go?</p>
        </div>

        <div className="space-y-3">
          <Option
            onClick={() => choose('admin')}
            Icon={LayoutDashboard}
            title="Admin Dashboard"
            subtitle={`${ROLE_LABEL[admin.role] || 'Admin'} tools`}
          />
          <Option
            onClick={() => choose('wallet')}
            Icon={Wallet}
            title="My Wallet"
            subtitle="Your NUCash employee account — balance, rides, Send Money"
          />
        </div>

        <p className="flex items-center justify-center gap-2 text-[rgba(251,251,251,0.5)] text-xs mt-6">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          You can switch any time from your profile menu.
        </p>
        <button onClick={cancel} className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-[rgba(251,251,251,0.45)] hover:text-[#FBFBFB] transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Not you? Sign out
        </button>
      </div>
    </div>
  );
}

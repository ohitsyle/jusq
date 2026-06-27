// src/components/modals/TransferModal.jsx
// Student-to-student balance transfer: search by school ID -> confirm recipient
// -> amount (with before/after balance) -> PIN -> send.
import React, { useState } from 'react';
import api from '../../utils/api';
import { Send, Search, User, ArrowRight, Loader2, CheckCircle2, X, Wallet, ShieldCheck, AlertCircle } from 'lucide-react';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function TransferModal({ onClose, theme, isDarkMode, balance, onSuccess }) {
  const accent = theme.accent.primary;
  const onAccent = isDarkMode ? '#181D40' : '#FFFFFF';
  const fieldBg = isDarkMode ? 'rgba(255,255,255,0.06)' : '#F4F7FB';

  const [step, setStep] = useState('search'); // search | amount | pin | success
  const [schoolId, setSchoolId] = useState('');
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100;
  const balanceAfter = Math.round((balance - amt) * 100) / 100;

  const handleSearch = async () => {
    setError('');
    const digits = schoolId.replace(/\D/g, '');
    if (digits.length < 4) { setError('Enter a valid school ID'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/user/lookup/${digits}`);
      if (res?.found) { setRecipient(res); setStep('amount'); }
      else if (res?.self) setError('You cannot send money to yourself.');
      else if (res?.inactive) setError('That account is not active.');
      else setError('No student found with that school ID.');
    } catch (e) { setError(e?.error || 'Lookup failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const proceedAmount = () => {
    setError('');
    if (!amt || amt <= 0) { setError('Enter an amount greater than 0.'); return; }
    if (amt > balance) { setError('Amount exceeds your available balance.'); return; }
    setStep('pin');
  };

  const handleSend = async () => {
    setError('');
    if (pin.replace(/\D/g, '').length < 4) { setError('Enter your PIN.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/user/transfer', { recipientSchoolId: recipient.schoolUId, amount: amt, pin });
      if (res?.success) { setResult(res); setStep('success'); onSuccess && onSuccess(res.newBalance); }
      else setError(res?.error || 'Transfer failed.');
    } catch (e) { setError(e?.error || 'Transfer failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const stepNum = { search: 1, amount: 2, pin: 3, success: 4 }[step];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <style>{`
        @keyframes nuOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nuModalIn { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes nuStepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} style={{ animation: 'nuOverlayIn 0.2s ease-out' }} />

      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{
          background: isDarkMode ? 'linear-gradient(135deg, #1E2347 0%, #181D40 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: `2px solid ${accent}55`,
          boxShadow: isDarkMode ? '0 25px 50px rgba(0,0,0,0.5)' : '0 25px 50px rgba(0,0,0,0.15)',
          animation: 'nuModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div
          style={{ background: `${accent}1A`, borderBottom: `2px solid ${accent}33` }}
          className="px-6 py-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div style={{ background: `${accent}33` }} className="w-12 h-12 rounded-xl flex items-center justify-center">
              <Send className="w-6 h-6" style={{ color: accent }} />
            </div>
            <div>
              <h2 style={{ color: accent }} className="text-xl font-bold">Send Money</h2>
              <p style={{ color: theme.text.secondary }} className="text-sm">
                {step === 'success' ? 'Complete' : `Step ${stepNum} of 3`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: theme.text.secondary }} className="p-2 hover:opacity-70 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6" key={step} style={{ animation: 'nuStepIn 0.28s ease-out' }}>
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
              <span className="text-sm" style={{ color: '#EF4444' }}>{error}</span>
            </div>
          )}

          {/* STEP 1: search */}
          {step === 'search' && (
            <>
              <label style={{ color: theme.text.secondary }} className="block text-xs font-bold uppercase tracking-wide mb-2">Recipient School ID</label>
              <div className="flex gap-2">
                <input
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g. 2023-121235"
                  autoFocus
                  style={{ background: fieldBg, color: theme.text.primary, borderColor: theme.border.primary }}
                  className="flex-1 p-3 rounded-xl border text-sm outline-none"
                />
                <button onClick={handleSearch} disabled={loading} style={{ background: accent, color: onAccent }} className="px-4 rounded-xl font-bold flex items-center gap-1 disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
              <p style={{ color: theme.text.tertiary }} className="text-xs mt-3">Enter your schoolmate's school ID to find them.</p>
            </>
          )}

          {/* STEP 2: confirm recipient + amount */}
          {step === 'amount' && recipient && (
            <>
              {/* Recipient card */}
              <div className="flex items-center gap-3 p-4 rounded-xl mb-5" style={{ background: fieldBg, border: `1px solid ${theme.border.primary}` }}>
                <div style={{ background: accent }} className="w-11 h-11 rounded-full flex items-center justify-center font-extrabold" >
                  <span style={{ color: onAccent }}>{(recipient.firstName?.[0] || '') + (recipient.lastName?.[0] || '')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: theme.text.primary }} className="font-bold truncate">{recipient.fullName}</div>
                  <div style={{ color: theme.text.secondary }} className="text-xs">{recipient.schoolUId} • {recipient.accountType === 'employee' ? 'Employee' : 'Student'}</div>
                </div>
                <button onClick={() => { setStep('search'); setRecipient(null); setAmount(''); setError(''); }} style={{ color: accent }} className="text-xs font-bold">Change</button>
              </div>

              {/* Balance before / after */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background: fieldBg }}>
                  <div style={{ color: theme.text.secondary }} className="text-[11px] font-semibold uppercase">Available</div>
                  <div style={{ color: theme.text.primary }} className="text-lg font-bold mt-0.5">{peso(balance)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: fieldBg }}>
                  <div style={{ color: theme.text.secondary }} className="text-[11px] font-semibold uppercase">Balance After</div>
                  <div className="text-lg font-bold mt-0.5" style={{ color: balanceAfter < 0 ? '#EF4444' : '#22C55E' }}>{peso(balanceAfter)}</div>
                </div>
              </div>

              <label style={{ color: theme.text.secondary }} className="block text-xs font-bold uppercase tracking-wide mb-2">Amount to Send</label>
              <div className="flex items-center rounded-xl border px-4" style={{ background: fieldBg, borderColor: theme.border.primary }}>
                <span style={{ color: theme.text.secondary }} className="text-xl font-bold mr-1">₱</span>
                <input
                  type="number" min="0" step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && proceedAmount()}
                  placeholder="0.00"
                  autoFocus
                  style={{ background: 'transparent', color: theme.text.primary }}
                  className="flex-1 py-3 text-xl font-bold outline-none"
                />
              </div>

              <button onClick={proceedAmount} style={{ background: accent, color: onAccent }} className="w-full mt-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition">
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* STEP 3: PIN */}
          {step === 'pin' && recipient && (
            <>
              <div className="text-center mb-5">
                <div style={{ background: `${accent}20` }} className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7" style={{ color: accent }} />
                </div>
                <p style={{ color: theme.text.secondary }} className="text-sm">
                  You're sending <span style={{ color: theme.text.primary }} className="font-bold">{peso(amt)}</span> to <span style={{ color: theme.text.primary }} className="font-bold">{recipient.fullName}</span>.
                </p>
              </div>

              <label style={{ color: theme.text.secondary }} className="block text-xs font-bold uppercase tracking-wide mb-2 text-center">Enter your PIN to confirm</label>
              <input
                type="password" inputMode="numeric" maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="••••••"
                autoFocus
                style={{ background: fieldBg, color: theme.text.primary, borderColor: theme.border.primary, letterSpacing: '10px' }}
                className="w-full p-3 rounded-xl border text-center text-2xl font-bold outline-none mb-5"
              />

              <div className="flex gap-3">
                <button onClick={() => { setStep('amount'); setPin(''); setError(''); }} disabled={loading} style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }} className="flex-1 py-3 rounded-xl font-semibold hover:opacity-80 transition disabled:opacity-50">Back</button>
                <button onClick={handleSend} disabled={loading} style={{ background: accent, color: onAccent }} className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Send
                </button>
              </div>
            </>
          )}

          {/* STEP 4: success */}
          {step === 'success' && result && (
            <div className="text-center py-4">
              <div style={{ background: 'rgba(34,197,94,0.15)' }} className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9" style={{ color: '#22C55E' }} />
              </div>
              <h3 style={{ color: theme.text.primary }} className="text-xl font-bold mb-1">Money Sent!</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm mb-5">{peso(amt)} sent to {result.recipientName}.</p>
              <div className="p-3 rounded-xl mb-5 inline-flex items-center gap-2" style={{ background: fieldBg }}>
                <Wallet className="w-4 h-4" style={{ color: theme.text.secondary }} />
                <span style={{ color: theme.text.secondary }} className="text-sm">New balance:</span>
                <span style={{ color: theme.text.primary }} className="text-sm font-bold">{peso(result.newBalance)}</span>
              </div>
              <button onClick={onClose} style={{ background: accent, color: onAccent }} className="w-full py-3 rounded-xl font-bold hover:opacity-90 transition">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

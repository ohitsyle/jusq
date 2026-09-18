// src/components/modals/TransferModal.jsx
// Send Money: recipient (favorites / recent / school ID) -> amount -> review ->
// PIN -> result (reference no., add to favorites). Server enforces the ₱5,000
// daily limit and locks the account after 3 wrong PINs (see /api/user/transfer).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/api';
import {
  Send, Star, Clock, ArrowRight, ArrowLeft, Loader2, CheckCircle2, XCircle, X, Lock,
  ShieldCheck, AlertCircle, Copy, Check, Zap, Mail, UserRound
} from 'lucide-react';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n) => Math.round(n * 100) / 100;
const when = (d) => new Date(d).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const initials = (p) => ((p?.firstName?.[0] || '') + (p?.lastName?.[0] || '')).toUpperCase() || '?';

// School ID formats: students ####-###### (default), employees ##-######
const ID_FORMATS = { long: { groups: [4, 6], example: '2023-123456' }, short: { groups: [2, 6], example: '23-123456' } };
const formatId = (digits, fmt) => {
  const [a] = ID_FORMATS[fmt].groups;
  return digits.length > a ? `${digits.slice(0, a)}-${digits.slice(a)}` : digits;
};
const idLength = (fmt) => ID_FORMATS[fmt].groups[0] + ID_FORMATS[fmt].groups[1];

const STEPS = ['recipient', 'amount', 'review', 'pin'];
const STEP_LABELS = { recipient: 'Recipient', amount: 'Amount', review: 'Review', pin: 'Confirm' };
const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function TransferModal({ onClose, theme, isDarkMode, balance: balanceProp, onSuccess }) {
  const accent = theme.accent.primary;
  const onAccent = isDarkMode ? '#181D40' : '#FFFFFF';
  const fieldBg = isDarkMode ? 'rgba(255,255,255,0.06)' : '#F4F7FB';
  const muted = theme.text.secondary;

  const [step, setStep] = useState('recipient');
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // recipient
  const [idFmt, setIdFmt] = useState('long');
  const [idDigits, setIdDigits] = useState('');
  const [lookup, setLookup] = useState({ state: 'idle' }); // idle | loading | found | error
  const [recipient, setRecipient] = useState(null);

  // amount / pin / result
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { status: 'success'|'failed'|'locked', ... }
  const [favBusy, setFavBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pinRef = useRef(null);

  const balance = overview?.balance ?? balanceProp ?? 0;
  const remainingToday = overview?.remainingToday ?? 5000;
  const dailyLimit = overview?.dailyLimit ?? 5000;
  const maxSendable = round2(Math.min(balance, remainingToday));
  const amt = round2(parseFloat(amount) || 0);
  const balanceAfter = round2(balance - amt);

  useEffect(() => {
    let alive = true;
    api.get('/user/transfer/overview')
      .then((res) => { if (alive) { setOverview(res); setAttemptsLeft(res.attemptsLeft ?? 3); } })
      .catch(() => {})
      .finally(() => alive && setLoadingOverview(false));
    return () => { alive = false; };
  }, []);

  // Look the school ID up as soon as it's complete
  useEffect(() => {
    if (idDigits.length !== idLength(idFmt)) { setLookup({ state: 'idle' }); return; }
    let alive = true;
    setLookup({ state: 'loading' });
    api.get(`/user/lookup/${idDigits}`)
      .then((res) => {
        if (!alive) return;
        if (res?.found) setLookup({ state: 'found', peer: { ...res, displayId: formatId(res.schoolUId, idFmt) } });
        else setLookup({ state: 'error', message: res?.self ? "That's your own school ID." : res?.inactive ? 'That account is not active.' : 'No one found with that school ID.' });
      })
      .catch((e) => alive && setLookup({ state: 'error', message: e?.error || 'Lookup failed. Please try again.' }));
    return () => { alive = false; };
  }, [idDigits, idFmt]);

  useEffect(() => { if (step === 'pin') setTimeout(() => pinRef.current?.focus(), 50); }, [step]);

  const amountError = useMemo(() => {
    if (!amount) return '';
    if (amt <= 0) return 'Enter an amount greater than ₱0.';
    if (amt > balance) return `That's more than your balance (${peso(balance)}).`;
    if (amt > remainingToday) return remainingToday > 0
      ? `Over your daily limit — you can send ${peso(remainingToday)} more today.`
      : `You've reached today's ${peso(dailyLimit)} sending limit.`;
    return '';
  }, [amount, amt, balance, remainingToday, dailyLimit]);

  const chooseRecipient = (peer) => { setRecipient(peer); setAmount(''); setStep('amount'); };

  const pickSaved = async (peer) => {
    // Re-check the saved person is still a valid recipient
    try {
      const res = await api.get(`/user/lookup/${peer.schoolUId}`);
      if (res?.found) chooseRecipient({ ...res, displayId: peer.displayId });
      else setLookup({ state: 'error', message: `${peer.fullName} can't receive money right now.` });
    } catch (e) { setLookup({ state: 'error', message: e?.error || 'Lookup failed. Please try again.' }); }
  };

  const onIdChange = (e) => {
    const raw = e.target.value;
    // Typing "23-" switches to the ##-###### format
    if (idFmt === 'long' && /^\d{2}-$/.test(raw)) { setIdFmt('short'); setIdDigits(raw.slice(0, 2)); return; }
    setIdDigits(raw.replace(/\D/g, '').slice(0, idLength(idFmt)));
  };

  const switchFmt = (fmt) => { setIdFmt(fmt); setIdDigits((d) => d.slice(0, idLength(fmt))); };

  const send = async (fullPin) => {
    if (sending) return;
    setSending(true);
    setPinError('');
    try {
      const res = await api.post('/user/transfer', { recipientSchoolId: recipient.schoolUId, amount: amt, pin: fullPin });
      if (res?.success) {
        setResult({ status: 'success', ...res });
        setStep('result');
        onSuccess && onSuccess(res.newBalance);
      } else {
        setResult({ status: 'failed', message: res?.error || 'Transfer failed.' });
        setStep('result');
      }
    } catch (e) {
      if (e?.locked) {
        // The lock also signs this browser out, and the dashboard's next refresh
        // bounces to /login — keep the explanation so the login page can show it.
        try { sessionStorage.setItem('nucash_lock_notice', JSON.stringify({ message: e.error, until: e.lockedUntil })); } catch { /* private mode */ }
        setResult({ status: 'locked', message: e.error, lockedUntil: e.lockedUntil });
        setStep('result');
      } else if (e?.attemptsLeft !== undefined) {
        setAttemptsLeft(e.attemptsLeft);
        setPinError(e.error);
        setPin('');
        setTimeout(() => pinRef.current?.focus(), 50);
      } else {
        setResult({ status: 'failed', message: e?.error || 'Transfer failed. Please try again.' });
        setStep('result');
      }
    } finally {
      setSending(false);
    }
  };

  const onPinChange = (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(d);
    setPinError('');
    if (d.length === 6) send(d);
  };

  const toggleFavorite = async () => {
    if (!result?.to || favBusy) return;
    setFavBusy(true);
    try {
      const res = result.isFavorite
        ? await api.delete(`/user/transfer/favorites/${result.to.schoolUId}`)
        : await api.post('/user/transfer/favorites', { schoolUId: result.to.schoolUId });
      setResult((r) => ({ ...r, isFavorite: !!res?.isFavorite }));
    } catch { /* keep current state */ }
    finally { setFavBusy(false); }
  };

  const copyRef = () => {
    navigator.clipboard?.writeText(result.referenceNo).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  const signOutAfterLock = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const close = () => { if (!sending) (result?.status === 'locked' ? signOutAfterLock() : onClose()); };
  const stepIndex = STEPS.indexOf(step);

  // ---------- small building blocks ----------
  const Avatar = ({ peer, size = 44 }) => (
    <div style={{ background: accent, width: size, height: size }} className="rounded-full flex items-center justify-center font-extrabold flex-shrink-0">
      <span style={{ color: onAccent, fontSize: size * 0.34 }}>{initials(peer)}</span>
    </div>
  );
  const Row = ({ label, children }) => (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: `1px solid ${theme.border.primary}` }}>
      <span style={{ color: muted }} className="text-sm flex-shrink-0">{label}</span>
      <div style={{ color: theme.text.primary }} className="text-sm font-semibold text-right min-w-0">{children}</div>
    </div>
  );
  const PrimaryBtn = ({ children, ...p }) => (
    <button {...p} style={{ background: accent, color: onAccent }} className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">{children}</button>
  );
  const GhostBtn = ({ children, ...p }) => (
    <button {...p} style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }} className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-80 transition disabled:opacity-40">{children}</button>
  );
  const peerLine = (p) => `${p.displayId || p.schoolUId} • ${p.accountType === 'employee' ? 'Employee' : 'Student'}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <style>{`
        @keyframes nuOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nuModalIn { from { opacity: 0; transform: translateY(18px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes nuStepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes nuShake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
      `}</style>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} style={{ animation: 'nuOverlayIn 0.2s ease-out' }} />

      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          background: isDarkMode ? 'linear-gradient(135deg, #1E2347 0%, #181D40 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: `2px solid ${accent}55`,
          animation: 'nuModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ background: `${accent}1A`, borderBottom: `2px solid ${accent}33` }} className="px-6 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ background: `${accent}33` }} className="w-11 h-11 rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div>
                <h2 style={{ color: accent }} className="text-xl font-bold leading-tight">Send Money</h2>
                <p style={{ color: muted }} className="text-xs">
                  {step === 'result' ? 'Transfer summary' : `Balance ${peso(balance)}`}
                </p>
              </div>
            </div>
            <button onClick={close} disabled={sending} aria-label="Close" style={{ color: muted }} className="p-2 hover:opacity-70 transition disabled:opacity-30">
              <X className="w-6 h-6" />
            </button>
          </div>
          {step !== 'result' && (
            <div className="grid grid-cols-4 gap-1.5 mt-4">
              {STEPS.map((s, i) => (
                <div key={s}>
                  <div className="h-1.5 rounded-full" style={{ background: i <= stepIndex ? accent : `${accent}30` }} />
                  <div className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: i === stepIndex ? accent : muted }}>{STEP_LABELS[s]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto" key={step} style={{ animation: 'nuStepIn 0.28s ease-out' }}>
          {/* ---------------- 1. RECIPIENT ---------------- */}
          {step === 'recipient' && (
            <>
              {loadingOverview ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} /></div>
              ) : (
                <>
                  {overview?.favorites?.length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center gap-1.5 mb-2"><Star className="w-3.5 h-3.5" style={{ color: accent }} fill={accent} /><span style={{ color: muted }} className="text-xs font-bold uppercase tracking-wide">Favorites</span></div>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {overview.favorites.map((p) => (
                          <button key={p.schoolUId} onClick={() => pickSaved(p)} className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0 hover:opacity-80 transition">
                            <Avatar peer={p} size={48} />
                            <span style={{ color: theme.text.primary }} className="text-xs font-semibold truncate w-full text-center">{p.firstName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {overview?.recents?.length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5" style={{ color: muted }} /><span style={{ color: muted }} className="text-xs font-bold uppercase tracking-wide">Recent</span></div>
                      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border.primary}` }}>
                        {overview.recents.map((p, i) => (
                          <button key={p.schoolUId} onClick={() => pickSaved(p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:opacity-80 transition" style={{ background: fieldBg, borderTop: i ? `1px solid ${theme.border.primary}` : 'none' }}>
                            <Avatar peer={p} size={36} />
                            <div className="flex-1 min-w-0">
                              <div style={{ color: theme.text.primary }} className="text-sm font-bold truncate flex items-center gap-1">{p.fullName}{p.isFavorite && <Star className="w-3 h-3 flex-shrink-0" style={{ color: accent }} fill={accent} />}</div>
                              <div style={{ color: muted }} className="text-xs">{p.displayId} • last sent {peso(p.lastAmount)}</div>
                            </div>
                            <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: muted }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="nu-send-id" style={{ color: muted }} className="text-xs font-bold uppercase tracking-wide">Recipient's school ID</label>
                    <div className="flex rounded-lg p-0.5" style={{ background: fieldBg }}>
                      {Object.entries(ID_FORMATS).map(([k, f]) => (
                        <button key={k} onClick={() => switchFmt(k)} className="px-2 py-0.5 rounded-md text-[11px] font-bold transition"
                          style={{ background: idFmt === k ? accent : 'transparent', color: idFmt === k ? onAccent : muted }}>
                          {f.example}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="nu-send-id"
                    value={formatId(idDigits, idFmt)}
                    onChange={onIdChange}
                    onKeyDown={(e) => e.key === 'Enter' && lookup.state === 'found' && chooseRecipient(lookup.peer)}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={ID_FORMATS[idFmt].example}
                    autoFocus={!overview?.favorites?.length && !overview?.recents?.length}
                    style={{ background: fieldBg, color: theme.text.primary, borderColor: lookup.state === 'error' ? '#EF4444' : theme.border.primary, letterSpacing: '1px' }}
                    className="w-full p-3 rounded-xl border text-lg font-bold outline-none"
                  />

                  <div className="mt-3 min-h-[64px]">
                    {lookup.state === 'loading' && <div className="flex items-center gap-2 text-sm" style={{ color: muted }}><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</div>}
                    {lookup.state === 'error' && <div className="flex items-center gap-2 text-sm" style={{ color: '#EF4444' }}><AlertCircle className="w-4 h-4 flex-shrink-0" /> {lookup.message}</div>}
                    {lookup.state === 'idle' && <p style={{ color: theme.text.tertiary }} className="text-xs">Enter all {idLength(idFmt)} digits — we'll show who it belongs to before you send.</p>}
                    {lookup.state === 'found' && (
                      <button onClick={() => chooseRecipient(lookup.peer)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:opacity-90 transition" style={{ background: `${accent}14`, border: `1.5px solid ${accent}` }}>
                        <Avatar peer={lookup.peer} />
                        <div className="flex-1 min-w-0">
                          <div style={{ color: theme.text.primary }} className="font-bold truncate">{lookup.peer.fullName}</div>
                          <div style={{ color: muted }} className="text-xs">{peerLine(lookup.peer)}</div>
                        </div>
                        <span style={{ color: accent }} className="text-sm font-bold flex items-center gap-1">Next <ArrowRight className="w-4 h-4" /></span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ---------------- 2. AMOUNT ---------------- */}
          {step === 'amount' && recipient && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ background: fieldBg, border: `1px solid ${theme.border.primary}` }}>
                <Avatar peer={recipient} size={40} />
                <div className="flex-1 min-w-0">
                  <div style={{ color: muted }} className="text-[11px] font-semibold uppercase">Sending to</div>
                  <div style={{ color: theme.text.primary }} className="font-bold truncate">{recipient.fullName}</div>
                </div>
                <button onClick={() => setStep('recipient')} style={{ color: accent }} className="text-xs font-bold">Change</button>
              </div>

              <label htmlFor="nu-send-amt" style={{ color: muted }} className="block text-xs font-bold uppercase tracking-wide mb-2">Amount</label>
              <div className="flex items-center rounded-xl border px-4" style={{ background: fieldBg, borderColor: amountError ? '#EF4444' : theme.border.primary }}>
                <span style={{ color: muted }} className="text-2xl font-bold mr-1">₱</span>
                <input
                  id="nu-send-amt"
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && amt > 0 && !amountError && setStep('review')}
                  placeholder="0.00"
                  autoFocus
                  style={{ background: 'transparent', color: theme.text.primary }}
                  className="flex-1 min-w-0 py-3 text-2xl font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button key={q} onClick={() => setAmount(String(q))} disabled={q > maxSendable}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-30"
                    style={{ background: amt === q ? accent : fieldBg, color: amt === q ? onAccent : theme.text.primary }}>
                    ₱{q}
                  </button>
                ))}
              </div>
              {amountError && <div className="flex items-center gap-2 text-sm mt-2" style={{ color: '#EF4444' }}><AlertCircle className="w-4 h-4 flex-shrink-0" /> {amountError}</div>}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 rounded-xl" style={{ background: fieldBg }}>
                  <div style={{ color: muted }} className="text-[11px] font-semibold uppercase">Balance now</div>
                  <div style={{ color: theme.text.primary }} className="text-lg font-bold mt-0.5">{peso(balance)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: fieldBg }}>
                  <div style={{ color: muted }} className="text-[11px] font-semibold uppercase">Balance after</div>
                  <div className="text-lg font-bold mt-0.5" style={{ color: balanceAfter < 0 ? '#EF4444' : '#22C55E' }}>{peso(balanceAfter)}</div>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-[11px] mb-1" style={{ color: muted }}>
                  <span>Sent today {peso(dailyLimit - remainingToday)}</span>
                  <span>Daily limit {peso(dailyLimit)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${accent}25` }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((dailyLimit - remainingToday + (amountError ? 0 : amt)) / dailyLimit) * 100)}%`, background: accent }} />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <GhostBtn onClick={() => setStep('recipient')}><ArrowLeft className="w-4 h-4" /> Back</GhostBtn>
                <PrimaryBtn onClick={() => setStep('review')} disabled={!(amt > 0) || !!amountError}>Review <ArrowRight className="w-4 h-4" /></PrimaryBtn>
              </div>
            </>
          )}

          {/* ---------------- 3. REVIEW ---------------- */}
          {step === 'review' && recipient && (
            <>
              <div className="text-center mb-4">
                <div style={{ color: muted }} className="text-xs font-bold uppercase tracking-wide">You're sending</div>
                <div style={{ color: theme.text.primary }} className="text-4xl font-extrabold mt-1">{peso(amt)}</div>
              </div>
              <div className="rounded-xl px-4 mb-4" style={{ background: fieldBg }}>
                <Row label="To">
                  <div>{recipient.fullName}</div>
                  <div style={{ color: muted }} className="text-xs font-normal">{peerLine(recipient)}</div>
                </Row>
                <Row label="From">
                  <div>{overview?.me?.fullName || 'You'}</div>
                  <div style={{ color: muted }} className="text-xs font-normal">{overview?.me?.displayId}</div>
                </Row>
                <Row label="Arrives"><span className="inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5" style={{ color: '#22C55E' }} /> Immediately</span></Row>
                <div className="flex items-start justify-between gap-4 py-2.5">
                  <span style={{ color: muted }} className="text-sm">Your balance after</span>
                  <span style={{ color: theme.text.primary }} className="text-sm font-semibold">{peso(balanceAfter)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl mb-5" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <span className="text-xs" style={{ color: theme.text.primary }}>The money moves the moment you confirm and can't be undone. Make sure <b>{recipient.fullName}</b> is the right person.</span>
              </div>
              <div className="flex gap-3">
                <GhostBtn onClick={() => setStep('amount')}><ArrowLeft className="w-4 h-4" /> Back</GhostBtn>
                <PrimaryBtn onClick={() => { setPin(''); setPinError(''); setStep('pin'); }}><Send className="w-4 h-4" /> Transfer now</PrimaryBtn>
              </div>
            </>
          )}

          {/* ---------------- 4. PIN ---------------- */}
          {step === 'pin' && recipient && (
            <>
              <div className="text-center mb-5">
                <div style={{ background: `${accent}20` }} className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7" style={{ color: accent }} />
                </div>
                <div style={{ color: theme.text.primary }} className="font-bold">Enter your 6-digit PIN</div>
                <p style={{ color: muted }} className="text-sm mt-1">to send <b style={{ color: theme.text.primary }}>{peso(amt)}</b> to <b style={{ color: theme.text.primary }}>{recipient.fullName}</b></p>
              </div>

              {/* One real input, shown as six boxes */}
              <label className="relative block cursor-text" style={pinError ? { animation: 'nuShake 0.35s' } : undefined}>
                <input
                  ref={pinRef}
                  value={pin}
                  onChange={onPinChange}
                  inputMode="numeric"
                  type="password"
                  autoComplete="one-time-code"
                  maxLength={6}
                  disabled={sending}
                  aria-label="6-digit PIN"
                  className="absolute inset-0 w-full h-full opacity-0"
                />
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-11 rounded-xl flex items-center justify-center text-2xl font-bold"
                      style={{ height: 52, background: fieldBg, border: `2px solid ${pinError ? '#EF4444' : i === pin.length && !sending ? accent : theme.border.primary}`, color: theme.text.primary }}>
                      {pin[i] ? '•' : ''}
                    </div>
                  ))}
                </div>
              </label>

              <div className="min-h-[44px] mt-3 text-center">
                {sending && <span className="inline-flex items-center gap-2 text-sm" style={{ color: muted }}><Loader2 className="w-4 h-4 animate-spin" /> Sending…</span>}
                {!sending && pinError && <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>{pinError}</span>}
                {!sending && !pinError && attemptsLeft < 3 && (
                  <span className="text-xs" style={{ color: '#F59E0B' }}>{attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left before your account is locked for 30 minutes.</span>
                )}
              </div>

              <div className="flex gap-3 mt-2">
                <GhostBtn onClick={() => setStep('review')} disabled={sending}><ArrowLeft className="w-4 h-4" /> Back</GhostBtn>
              </div>
            </>
          )}

          {/* ---------------- 5. RESULT ---------------- */}
          {step === 'result' && result && (
            <>
              {result.status === 'success' && (
                <>
                  <div className="text-center mb-4">
                    <div style={{ background: 'rgba(34,197,94,0.15)' }} className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-9 h-9" style={{ color: '#22C55E' }} />
                    </div>
                    <div style={{ color: '#22C55E' }} className="text-sm font-bold uppercase tracking-wide">Transfer successful</div>
                    <div style={{ color: theme.text.primary }} className="text-4xl font-extrabold mt-1">{peso(result.amount)}</div>
                  </div>
                  <div className="rounded-xl px-4 mb-4" style={{ background: fieldBg }}>
                    <Row label="To"><div>{result.to?.fullName}</div><div style={{ color: muted }} className="text-xs font-normal">{result.to?.displayId}</div></Row>
                    <Row label="From"><div>{result.from?.fullName}</div><div style={{ color: muted }} className="text-xs font-normal">{result.from?.displayId}</div></Row>
                    <Row label="Reference no.">
                      <button onClick={copyRef} className="inline-flex items-center gap-1.5 font-mono text-xs hover:opacity-80" title="Copy">
                        {result.referenceNo} {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#22C55E' }} /> : <Copy className="w-3.5 h-3.5" style={{ color: muted }} />}
                      </button>
                    </Row>
                    <Row label="Date & time">{when(result.sentAt)}</Row>
                    <div className="flex items-start justify-between gap-4 py-2.5">
                      <span style={{ color: muted }} className="text-sm">New balance</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold">{peso(result.newBalance)}</span>
                    </div>
                  </div>
                  <button onClick={toggleFavorite} disabled={favBusy} className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-3 transition hover:opacity-80 disabled:opacity-50"
                    style={{ border: `1.5px solid ${accent}`, color: accent, background: result.isFavorite ? `${accent}18` : 'transparent' }}>
                    <Star className="w-4 h-4" fill={result.isFavorite ? accent : 'none'} />
                    {result.isFavorite ? `${result.to?.firstName} is in your favorites` : `Add ${result.to?.firstName} to favorites`}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-xs mb-4" style={{ color: muted }}>
                    <Mail className="w-3.5 h-3.5" /> We emailed a receipt to you and {result.to?.firstName}.
                  </p>
                  <div className="flex"><PrimaryBtn onClick={onClose}>Close</PrimaryBtn></div>
                </>
              )}

              {result.status === 'failed' && (
                <>
                  <div className="text-center mb-4">
                    <div style={{ background: 'rgba(239,68,68,0.15)' }} className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <XCircle className="w-9 h-9" style={{ color: '#EF4444' }} />
                    </div>
                    <div style={{ color: '#EF4444' }} className="text-sm font-bold uppercase tracking-wide">Transfer failed</div>
                    <div style={{ color: theme.text.primary }} className="text-4xl font-extrabold mt-1">{peso(amt)}</div>
                  </div>
                  <div className="p-3 rounded-xl mb-4 text-sm text-center" style={{ background: 'rgba(239,68,68,0.10)', color: theme.text.primary }}>{result.message}</div>
                  <div className="rounded-xl px-4 mb-4" style={{ background: fieldBg }}>
                    <Row label="To"><div>{recipient?.fullName}</div><div style={{ color: muted }} className="text-xs font-normal">{recipient?.displayId}</div></Row>
                    <div className="flex items-start justify-between gap-4 py-2.5">
                      <span style={{ color: muted }} className="text-sm">From</span>
                      <span style={{ color: theme.text.primary }} className="text-sm font-semibold">{overview?.me?.fullName || 'You'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-center mb-4" style={{ color: muted }}>No money was moved.</p>
                  <div className="flex gap-3">
                    <GhostBtn onClick={() => { setResult(null); setStep('amount'); }}>Try again</GhostBtn>
                    <PrimaryBtn onClick={onClose}>Close</PrimaryBtn>
                  </div>
                </>
              )}

              {result.status === 'locked' && (
                <>
                  <div className="text-center mb-4">
                    <div style={{ background: 'rgba(239,68,68,0.15)' }} className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-8 h-8" style={{ color: '#EF4444' }} />
                    </div>
                    <div style={{ color: theme.text.primary }} className="text-xl font-extrabold">Account locked</div>
                  </div>
                  <div className="p-4 rounded-xl mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: theme.text.primary }}>{result.message}</div>
                  <p className="flex items-start gap-2 text-xs mb-5" style={{ color: muted }}>
                    <UserRound className="w-4 h-4 flex-shrink-0" /> No money was sent. If this wasn't you, report it to ITSO and change your PIN once you can sign in again.
                  </p>
                  <div className="flex"><PrimaryBtn onClick={signOutAfterLock}>Close</PrimaryBtn></div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

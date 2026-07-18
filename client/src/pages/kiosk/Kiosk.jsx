// src/pages/kiosk/Kiosk.jsx
// Self-service registration kiosk. Idle: animated NUCash attract screen.
// Tap a school ID (USB RFID reader = keyboard wedge) → checks registration →
// guided sign-up → temporary PIN emailed → activate on the website.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';
import {
  Nfc, CreditCard, Bus, Store, Send, ShieldCheck, CheckCircle2, XCircle,
  ArrowRight, ArrowLeft, Loader2, Mail, User, GraduationCap, Sparkles, AlertCircle
} from 'lucide-react';

const NAVY = '#0F1227';
const NAVY2 = '#181D40';
const YELLOW = '#FFD41C';
const TEXT = '#FBFBFB';
const MUTED = 'rgba(251,251,251,0.6)';
const FAINT = 'rgba(251,251,251,0.35)';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const SCHOOL_DOMAINS = ['students.nu-laguna.edu.ph', 'nu-laguna.edu.ph', 'nu.edu.ph'];
const NAME_RE = /^[A-Za-zÀ-ÿÑñ' .-]{1,40}$/;

const TAGLINES = [
  'Tap. Pay. Go.',
  'Your campus wallet — on your ID.',
  'Ride the NU Shuttle cashless.',
  'Pay campus merchants in a tap.',
  'Send money to schoolmates instantly.',
];

const maskCard = (raw) => (raw && raw.length > 4 ? '•••• •••• ' + raw.slice(-4) : '••••••••');
const fmtSchoolId = (digits) => (digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4, 10)}` : digits);

// ---- shared UI bits (module scope!) -----------------------------------------
// Defined OUTSIDE the Kiosk component so their identity is stable across
// renders — defining them inside made React remount the whole card on every
// keystroke (entrance animation replayed + inputs lost focus).
// Class-based styling (see <style> in Kiosk) gives real :hover/:focus/:active.
const Screen = ({ children, width = 560 }) => (
  <div className="kWrap" style={{ maxWidth: width }}>
    <div className="kCard">{children}</div>
  </div>
);

const Btn = ({ onClick, children, ghost, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={`kBtn ${ghost ? 'kBtn--ghost' : 'kBtn--primary'}`}>
    {children}
  </button>
);

const Field = ({ label, icon: Icon, err, children }) => (
  <div className="kField">
    <label className="kLabel">
      {Icon && <Icon style={{ width: 13, height: 13 }} />} {label}
    </label>
    {children}
    <div className={`kErr ${err ? 'kErr--show' : ''}`}>
      {err && <><AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />{err}</>}
    </div>
  </div>
);

const inputStyle = (hasErr) => ({}); // retained for compatibility; styling lives in .kInput

export default function Kiosk() {
  const [stage, setStage] = useState('idle'); // idle|checking|registered|prompt|form|review|submitting|success|error
  const [card, setCard] = useState('');
  const [known, setKnown] = useState(null); // { firstName, activated }
  const [errorMsg, setErrorMsg] = useState('');
  const [tagline, setTagline] = useState(0);
  const [countdown, setCountdown] = useState(null);

  const [form, setForm] = useState({ email: '', firstName: '', middleName: '', lastName: '', schoolId: '' });
  const [fieldErr, setFieldErr] = useState({});

  const bufRef = useRef({ chars: '', last: 0 });
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const idleTimer = useRef(null);

  const reset = useCallback(() => {
    setStage('idle'); setCard(''); setKnown(null); setErrorMsg(''); setCountdown(null);
    setForm({ email: '', firstName: '', middleName: '', lastName: '', schoolId: '' });
    setFieldErr({});
  }, []);

  // rotate taglines on the attract screen
  useEffect(() => {
    const t = setInterval(() => setTagline((i) => (i + 1) % TAGLINES.length), 4000);
    return () => clearInterval(t);
  }, []);

  // inactivity → back to attract screen (not while typing the form? yes even then, 120s)
  const pokeIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (stageRef.current !== 'idle') {
      idleTimer.current = setTimeout(() => reset(), 120000);
    }
  }, [reset]);
  useEffect(() => { pokeIdle(); }, [stage, pokeIdle]);
  useEffect(() => {
    const h = () => pokeIdle();
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, [pokeIdle]);

  // success/registered screens count down back to idle
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { reset(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, reset]);

  const handleScan = useCallback(async (raw) => {
    setCard(raw);
    setStage('checking');
    try {
      const res = await api.post('/kiosk/check-card', { rfid: raw });
      if (res?.registered) {
        setKnown({ firstName: res.firstName, activated: res.activated });
        setStage('registered');
        setCountdown(10);
      } else {
        setStage('prompt');
      }
    } catch (e) {
      setErrorMsg(e?.error || 'Card not recognized. Please tap your school ID.');
      setStage('error');
      setCountdown(8);
    }
  }, []);

  // USB RFID readers "type" the UID then press Enter — capture globally on the
  // attract screen only (so typing in the form is never intercepted).
  useEffect(() => {
    const onKey = (e) => {
      if (stageRef.current !== 'idle') return;
      const now = Date.now();
      const buf = bufRef.current;
      if (now - buf.last > 400) buf.chars = '';
      buf.last = now;
      if (e.key === 'Enter') {
        const scan = buf.chars;
        buf.chars = '';
        if (scan.length >= 7) handleScan(scan);
        return;
      }
      if (/^[0-9a-fA-F]$/.test(e.key)) buf.chars += e.key;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleScan]);

  // Phone-as-scanner relay: while idle, poll the server for a scan pushed from
  // a phone in scanner mode (fallback for testing without a USB reader).
  useEffect(() => {
    if (stage !== 'idle') return;
    const t = setInterval(async () => {
      if (stageRef.current !== 'idle') return;
      try {
        const res = await api.get('/kiosk/relay/latest');
        if (res?.uid) handleScan(res.uid);
      } catch (e) { /* ignore */ }
    }, 1200);
    return () => clearInterval(t);
  }, [stage, handleScan]);

  // ---- form validation --------------------------------------------------
  const validate = () => {
    const errs = {};
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address.';
    else if (!SCHOOL_DOMAINS.includes(email.split('@')[1])) errs.email = `Use your school email (…@${SCHOOL_DOMAINS[0]}).`;
    if (!NAME_RE.test(form.firstName.trim()) || !form.firstName.trim()) errs.firstName = 'Enter your first name (letters only).';
    if (form.middleName.trim() && !NAME_RE.test(form.middleName.trim())) errs.middleName = 'Letters only.';
    if (!NAME_RE.test(form.lastName.trim()) || !form.lastName.trim()) errs.lastName = 'Enter your last name (letters only).';
    if (form.schoolId.replace(/\D/g, '').length !== 10) errs.schoolId = 'School ID must be 10 digits, e.g. 2023-121235.';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    setStage('submitting');
    try {
      const res = await api.post('/kiosk/register', {
        rfid: card,
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        schoolUId: form.schoolId.replace(/\D/g, '')
      });
      if (res?.success) { setStage('success'); setCountdown(15); }
      else { setErrorMsg(res?.error || 'Registration failed.'); setStage('form'); }
    } catch (e) {
      const msg = e?.error || 'Registration failed. Please try again or visit the Treasury Office.';
      setErrorMsg(msg);
      setStage('form');
    }
  };

  // ---- stages ---------------------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh', background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 24px 52px',
      fontFamily: 'system-ui, -apple-system, sans-serif', overflowY: 'auto', overflowX: 'hidden',
      position: 'relative', cursor: 'default'
    }}>
      <style>{`
        @keyframes kioskUp { from { opacity: 0; transform: translateY(26px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes kioskFloat { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-30px) scale(1.15); } }
        @keyframes kioskFloat2 { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-40px,25px) scale(0.95); } }
        @keyframes kioskPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.85; } }
        @keyframes kioskRing { 0% { transform: scale(0.9); opacity: 0.7; } 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes kioskFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes kioskSpin { to { transform: rotate(360deg); } }
        @keyframes kioskPop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }

        /* ---- card: never taller than the viewport; scrolls inside instead ---- */
        .kWrap { position: relative; z-index: 2; width: 100%; animation: kioskUp 0.45s cubic-bezier(0.16,1,0.3,1); }
        .kCard {
          background: linear-gradient(160deg, rgba(30,35,71,0.97) 0%, rgba(24,29,64,0.97) 100%);
          border: 2px solid rgba(255,212,28,0.35); border-radius: 24; border-radius: 24px;
          padding: clamp(22px, 4vh, 38px) clamp(22px, 4vw, 40px);
          box-shadow: 0 30px 80px rgba(0,0,0,0.55);
          max-height: calc(100vh - 88px); overflow-y: auto;
        }
        .kCard::-webkit-scrollbar { width: 8px; }
        .kCard::-webkit-scrollbar-thumb { background: rgba(255,212,28,0.3); border-radius: 8px; }
        .kCard::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); }

        /* ---- buttons: real hover/active/focus states ---- */
        .kBtn {
          flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 15px 22px; border-radius: 14px; font-size: 16px; font-weight: 800;
          cursor: pointer; transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          font-family: inherit;
        }
        .kBtn--primary { background: ${YELLOW}; color: ${NAVY2}; border: none; box-shadow: 0 6px 18px rgba(255,212,28,0.25); }
        .kBtn--primary:hover:not(:disabled) { box-shadow: 0 8px 26px rgba(255,212,28,0.4); transform: translateY(-1px); }
        .kBtn--ghost { background: transparent; color: ${MUTED}; border: 2px solid rgba(251,251,251,0.25); }
        .kBtn--ghost:hover:not(:disabled) { border-color: rgba(251,251,251,0.5); color: ${TEXT}; }
        .kBtn:active:not(:disabled) { transform: scale(0.97); }
        .kBtn:disabled { opacity: 0.5; cursor: not-allowed; }
        .kBtnRow { display: flex; gap: 12px; margin-top: 4px; }

        /* ---- fields ---- */
        .kField { margin-bottom: 4px; }
        .kLabel {
          display: flex; align-items: center; gap: 7px; color: ${YELLOW};
          font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 7px;
        }
        .kInput {
          width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; font-size: 15px;
          background: rgba(15,18,39,0.7); color: ${TEXT}; outline: none; font-family: inherit;
          border: 2px solid rgba(255,212,28,0.22); transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .kInput::placeholder { color: rgba(251,251,251,0.28); }
        .kInput:hover { border-color: rgba(255,212,28,0.4); }
        .kInput:focus { border-color: ${YELLOW}; box-shadow: 0 0 0 3px rgba(255,212,28,0.15); }
        .kInput--err { border-color: rgba(239,68,68,0.65); }
        .kInput--err:focus { border-color: #EF4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
        .kErr {
          display: flex; align-items: center; gap: 6px; color: #F87171; font-size: 12px;
          min-height: 18px; margin-top: 4px; opacity: 0; transition: opacity 0.15s ease;
        }
        .kErr--show { opacity: 1; }

        .kGrid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
        @media (max-width: 640px) { .kGrid2 { grid-template-columns: 1fr; } }
        @media (max-height: 700px) { .kFootNote { display: none; } }
      `}</style>

      {/* floating background blobs (fixed so page scroll never moves them) */}
      <div style={{ position: 'fixed', width: 480, height: 480, top: '-10%', left: '-8%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,212,28,0.14) 0%, transparent 70%)', animation: 'kioskFloat 11s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 560, height: 560, bottom: '-15%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', animation: 'kioskFloat2 13s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* ============ IDLE / ATTRACT ============ */}
      {stage === 'idle' && (
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', animation: 'kioskFade 0.6s ease-out' }}>
          <div style={{
            width: 110, height: 110, margin: '0 auto 28px', borderRadius: 28, background: YELLOW,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, fontWeight: 900, color: NAVY2, boxShadow: `0 0 0 10px rgba(255,212,28,0.15), 0 20px 60px rgba(255,212,28,0.25)`,
            animation: 'kioskPulse 3s ease-in-out infinite'
          }}>NU</div>
          <h1 style={{ color: TEXT, fontSize: 64, fontWeight: 900, margin: 0, letterSpacing: 1 }}>NUCash</h1>
          <p key={tagline} style={{ color: YELLOW, fontSize: 26, fontWeight: 700, margin: '10px 0 44px', animation: 'kioskFade 0.6s ease-out' }}>
            {TAGLINES[tagline]}
          </p>

          <div style={{ display: 'flex', gap: 28, justifyContent: 'center', marginBottom: 56 }}>
            {[{ I: Bus, t: 'Shuttle rides' }, { I: Store, t: 'Campus stores' }, { I: Send, t: 'Send money' }].map(({ I, t }, i) => (
              <div key={t} style={{ color: MUTED, fontSize: 14, fontWeight: 600, animation: `kioskFade 0.6s ease-out ${0.15 * i}s both` }}>
                <div style={{ width: 62, height: 62, margin: '0 auto 10px', borderRadius: 18, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,212,28,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <I style={{ width: 28, height: 28, color: YELLOW }} />
                </div>
                {t}
              </div>
            ))}
          </div>

          {/* tap target */}
          <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto 18px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${YELLOW}`, animation: 'kioskRing 2s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${YELLOW}`, animation: 'kioskRing 2s ease-out 0.7s infinite' }} />
            <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', background: 'rgba(255,212,28,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Nfc style={{ width: 52, height: 52, color: YELLOW }} />
            </div>
          </div>
          <p style={{ color: TEXT, fontSize: 24, fontWeight: 800, margin: 0 }}>Tap your School ID to get started</p>
          <p style={{ color: FAINT, fontSize: 14, marginTop: 8 }}>Check your registration or sign up for NUCash — right here.</p>
        </div>
      )}

      {/* ============ CHECKING ============ */}
      {stage === 'checking' && (
        <Screen width={430}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Loader2 style={{ width: 54, height: 54, color: YELLOW, animation: 'kioskSpin 0.9s linear infinite', display: 'block', margin: '0 auto' }} />
            <p style={{ color: TEXT, fontSize: 20, fontWeight: 700, marginTop: 18 }}>Reading your card…</p>
            <p style={{ color: MUTED, fontSize: 14 }}>{maskCard(card)}</p>
          </div>
        </Screen>
      )}

      {/* ============ ALREADY REGISTERED ============ */}
      {stage === 'registered' && (
        <Screen width={520}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, margin: '0 auto 20px', borderRadius: 24, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kioskPop 0.5s ease-out' }}>
              <CheckCircle2 style={{ width: 46, height: 46, color: '#22C55E' }} />
            </div>
            <h2 style={{ color: TEXT, fontSize: 28, fontWeight: 900, margin: '0 0 10px' }}>
              {known?.firstName ? `Hi ${known.firstName}, you're registered!` : "You're already registered!"}
            </h2>
            <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.6, margin: '0 0 26px' }}>
              {known?.activated
                ? 'This ID is active and ready to use. Manage your wallet on the NUCash website.'
                : 'Your account exists but isn\'t activated yet — check your school email for the temporary PIN, then activate it on the NUCash website.'}
            </p>
            <Btn onClick={reset}>Done ({countdown ?? ''})</Btn>
          </div>
        </Screen>
      )}

      {/* ============ REGISTER? PROMPT ============ */}
      {stage === 'prompt' && (
        <Screen width={540}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, margin: '0 auto 20px', borderRadius: 24, background: 'rgba(255,212,28,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kioskPop 0.5s ease-out' }}>
              <CreditCard style={{ width: 44, height: 44, color: YELLOW }} />
            </div>
            <h2 style={{ color: TEXT, fontSize: 28, fontWeight: 900, margin: '0 0 8px' }}>This ID isn't registered yet</h2>
            <p style={{ color: MUTED, fontSize: 16, margin: '0 0 6px' }}>Card {maskCard(card)}</p>
            <p style={{ color: MUTED, fontSize: 17, margin: '0 0 30px' }}>Would you like to register for NUCash now? It takes about a minute.</p>
            <div className="kBtnRow">
              <Btn ghost onClick={reset}>Not now</Btn>
              <Btn onClick={() => { setErrorMsg(''); setStage('form'); }}>Yes, register <ArrowRight style={{ width: 20, height: 20 }} /></Btn>
            </div>
          </div>
        </Screen>
      )}

      {/* ============ FORM ============ */}
      {stage === 'form' && (
        <Screen width={620}>
          <h2 style={{ color: TEXT, fontSize: 26, fontWeight: 900, margin: '0 0 4px' }}>Create your NUCash account</h2>
          <p style={{ color: MUTED, fontSize: 14, margin: '0 0 22px' }}>
            Card <span style={{ color: YELLOW, fontWeight: 800 }}>{maskCard(card)}</span> — kept hidden for your security.
          </p>

          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '12px 14px', marginBottom: 18, color: '#F87171', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} /> {errorMsg}
            </div>
          )}

          <Field label="School Email" icon={Mail} err={fieldErr.email}>
            <input className={fieldErr.email ? 'kInput kInput--err' : 'kInput'} type="email" placeholder="e.g. delacruzjp@students.nu-laguna.edu.ph"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>

          <div className="kGrid2">
            <Field label="First Name" icon={User} err={fieldErr.firstName}>
              <input className={fieldErr.firstName ? 'kInput kInput--err' : 'kInput'} placeholder="e.g. Juan" value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Middle Name (optional)" err={fieldErr.middleName}>
              <input className={fieldErr.middleName ? 'kInput kInput--err' : 'kInput'} placeholder="e.g. Ponce" value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
            </Field>
          </div>

          <div className="kGrid2">
            <Field label="Last Name" err={fieldErr.lastName}>
              <input className={fieldErr.lastName ? 'kInput kInput--err' : 'kInput'} placeholder="e.g. Dela Cruz" value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label="School ID Number" icon={GraduationCap} err={fieldErr.schoolId}>
              <input className={fieldErr.schoolId ? 'kInput kInput--err' : 'kInput'} placeholder="e.g. 2023-121235" inputMode="numeric" value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: fmtSchoolId(e.target.value.replace(/\D/g, '').slice(0, 10)) })} />
            </Field>
          </div>

          <p style={{ color: FAINT, fontSize: 12.5, lineHeight: 1.55, margin: '4px 0 22px', display: 'flex', gap: 8 }}>
            <ShieldCheck style={{ width: 26, height: 26, color: YELLOW, flexShrink: 0 }} />
            Use your real name and school-issued email exactly as they appear in school records. Your temporary PIN is sent only
            to your school email, and your details help keep shuttle rides and payments safe and traceable.
          </p>

          <div className="kBtnRow">
            <Btn ghost onClick={() => setStage('prompt')}><ArrowLeft style={{ width: 20, height: 20 }} /> Back</Btn>
            <Btn onClick={() => { if (validate()) { setErrorMsg(''); setStage('review'); } }}>Review details <ArrowRight style={{ width: 20, height: 20 }} /></Btn>
          </div>
        </Screen>
      )}

      {/* ============ REVIEW ============ */}
      {stage === 'review' && (
        <Screen width={560}>
          <h2 style={{ color: TEXT, fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>Is everything correct?</h2>
          <p style={{ color: MUTED, fontSize: 15, margin: '0 0 24px' }}>Double-check — your account details must match your school records.</p>

          <div style={{ background: 'rgba(15,18,39,0.6)', border: '1px solid rgba(255,212,28,0.2)', borderRadius: 16, padding: '8px 20px', marginBottom: 26 }}>
            {[
              ['ID Card', maskCard(card)],
              ['Name', `${form.firstName} ${form.middleName ? form.middleName + ' ' : ''}${form.lastName}`],
              ['School Email', form.email.toLowerCase()],
              ['School ID', form.schoolId],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid rgba(251,251,251,0.07)' }}>
                <span style={{ color: MUTED, fontSize: 14, fontWeight: 600 }}>{k}</span>
                <span style={{ color: TEXT, fontSize: 15, fontWeight: 800, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="kBtnRow">
            <Btn ghost onClick={() => setStage('form')}><ArrowLeft style={{ width: 20, height: 20 }} /> Edit details</Btn>
            <Btn onClick={submit}>Confirm & Register <CheckCircle2 style={{ width: 20, height: 20 }} /></Btn>
          </div>
        </Screen>
      )}

      {/* ============ SUBMITTING ============ */}
      {stage === 'submitting' && (
        <Screen width={430}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Loader2 style={{ width: 54, height: 54, color: YELLOW, animation: 'kioskSpin 0.9s linear infinite', display: 'block', margin: '0 auto' }} />
            <p style={{ color: TEXT, fontSize: 20, fontWeight: 700, marginTop: 18 }}>Creating your account…</p>
          </div>
        </Screen>
      )}

      {/* ============ SUCCESS ============ */}
      {stage === 'success' && (
        <Screen width={580}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 92, height: 92, margin: '0 auto 22px', borderRadius: 26, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kioskPop 0.5s ease-out' }}>
              <Sparkles style={{ width: 48, height: 48, color: '#22C55E' }} />
            </div>
            <h2 style={{ color: TEXT, fontSize: 30, fontWeight: 900, margin: '0 0 14px' }}>You're registered! 🎉</h2>
            <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.65, margin: '0 0 8px' }}>
              A <span style={{ color: YELLOW, fontWeight: 800 }}>temporary PIN</span> has been sent to
              <span style={{ color: TEXT, fontWeight: 700 }}> {form.email.toLowerCase()}</span>.
            </p>
            <p style={{ color: MUTED, fontSize: 17, lineHeight: 1.65, margin: '0 0 28px' }}>
              Head to the <span style={{ color: YELLOW, fontWeight: 800 }}>NUCash website</span> to change your PIN and activate your account!
            </p>
            <Btn onClick={reset}>Finish ({countdown ?? ''})</Btn>
          </div>
        </Screen>
      )}

      {/* ============ ERROR ============ */}
      {stage === 'error' && (
        <Screen width={520}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, margin: '0 auto 20px', borderRadius: 24, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'kioskPop 0.5s ease-out' }}>
              <XCircle style={{ width: 44, height: 44, color: '#EF4444' }} />
            </div>
            <h2 style={{ color: TEXT, fontSize: 26, fontWeight: 900, margin: '0 0 10px' }}>Hmm, that didn't work</h2>
            <p style={{ color: MUTED, fontSize: 16, margin: '0 0 26px' }}>{errorMsg}</p>
            <Btn onClick={reset}>Try again ({countdown ?? ''})</Btn>
          </div>
        </Screen>
      )}

      {/* footer */}
      <div className="kFootNote" style={{ position: 'fixed', bottom: 14, left: 0, right: 0, textAlign: 'center', color: FAINT, fontSize: 12, zIndex: 1, pointerEvents: 'none' }}>
        NUCash Registration Kiosk • Need help? Visit the Treasury Office
      </div>
    </div>
  );
}

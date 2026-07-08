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

  // ---- shared UI bits -----------------------------------------------------
  const Screen = ({ children, width = 560 }) => (
    <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: width, animation: 'kioskUp 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{
        background: 'linear-gradient(160deg, rgba(30,35,71,0.95) 0%, rgba(24,29,64,0.95) 100%)',
        border: `2px solid rgba(255,212,28,0.35)`, borderRadius: 28, padding: '40px 44px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.55)'
      }}>
        {children}
      </div>
    </div>
  );

  const Btn = ({ onClick, children, ghost, danger, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '18px 24px', borderRadius: 16, fontSize: 18, fontWeight: 800, cursor: 'pointer',
      border: ghost ? '2px solid rgba(251,251,251,0.25)' : 'none',
      background: danger ? 'rgba(239,68,68,0.9)' : ghost ? 'transparent' : YELLOW,
      color: ghost ? MUTED : danger ? '#fff' : NAVY2,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      transition: 'transform 0.15s, opacity 0.15s', opacity: disabled ? 0.5 : 1
    }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >{children}</button>
  );

  const Field = ({ label, icon: Icon, err, children }) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: YELLOW, fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {Icon && <Icon style={{ width: 14, height: 14 }} />} {label}
      </label>
      {children}
      {err && <div style={{ color: '#F87171', fontSize: 13, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle style={{ width: 14, height: 14 }} />{err}</div>}
    </div>
  );

  const inputStyle = (hasErr) => ({
    width: '100%', boxSizing: 'border-box', padding: '15px 16px', borderRadius: 14, fontSize: 17,
    background: 'rgba(15,18,39,0.7)', color: TEXT, outline: 'none',
    border: `2px solid ${hasErr ? 'rgba(239,68,68,0.6)' : 'rgba(255,212,28,0.25)'}`,
    transition: 'border-color 0.2s'
  });

  // ---- stages ---------------------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh', background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', position: 'relative', cursor: 'default'
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
      `}</style>

      {/* floating background blobs */}
      <div style={{ position: 'absolute', width: 480, height: 480, top: '-10%', left: '-8%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,212,28,0.14) 0%, transparent 70%)', animation: 'kioskFloat 11s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 560, height: 560, bottom: '-15%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', animation: 'kioskFloat2 13s ease-in-out infinite' }} />

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
            <Loader2 style={{ width: 54, height: 54, color: YELLOW, animation: 'kioskSpin 0.9s linear infinite' }} />
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
            <div style={{ display: 'flex', gap: 14 }}>
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
            <input style={inputStyle(fieldErr.email)} type="email" placeholder="e.g. delacruzjp@students.nu-laguna.edu.ph"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="First Name" icon={User} err={fieldErr.firstName}>
              <input style={inputStyle(fieldErr.firstName)} placeholder="e.g. Juan" value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Middle Name (optional)" err={fieldErr.middleName}>
              <input style={inputStyle(fieldErr.middleName)} placeholder="e.g. Ponce" value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Last Name" err={fieldErr.lastName}>
              <input style={inputStyle(fieldErr.lastName)} placeholder="e.g. Dela Cruz" value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label="School ID Number" icon={GraduationCap} err={fieldErr.schoolId}>
              <input style={inputStyle(fieldErr.schoolId)} placeholder="e.g. 2023-121235" inputMode="numeric" value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: fmtSchoolId(e.target.value.replace(/\D/g, '').slice(0, 10)) })} />
            </Field>
          </div>

          <p style={{ color: FAINT, fontSize: 12.5, lineHeight: 1.55, margin: '4px 0 22px', display: 'flex', gap: 8 }}>
            <ShieldCheck style={{ width: 26, height: 26, color: YELLOW, flexShrink: 0 }} />
            Use your real name and school-issued email exactly as they appear in school records. Your temporary PIN is sent only
            to your school email, and your details help keep shuttle rides and payments safe and traceable.
          </p>

          <div style={{ display: 'flex', gap: 14 }}>
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

          <div style={{ display: 'flex', gap: 14 }}>
            <Btn ghost onClick={() => setStage('form')}><ArrowLeft style={{ width: 20, height: 20 }} /> Edit details</Btn>
            <Btn onClick={submit}>Confirm & Register <CheckCircle2 style={{ width: 20, height: 20 }} /></Btn>
          </div>
        </Screen>
      )}

      {/* ============ SUBMITTING ============ */}
      {stage === 'submitting' && (
        <Screen width={430}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Loader2 style={{ width: 54, height: 54, color: YELLOW, animation: 'kioskSpin 0.9s linear infinite' }} />
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
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', color: FAINT, fontSize: 12, zIndex: 2 }}>
        NUCash Registration Kiosk • Need help? Visit the Treasury Office
      </div>
    </div>
  );
}

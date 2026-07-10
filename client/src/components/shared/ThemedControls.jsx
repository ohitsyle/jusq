// src/components/shared/ThemedControls.jsx
// Fully custom, theme-aware replacements for native popup widgets:
//   <ThemedSelect>   — drop-in for <select> (parses <option> children)
//   <ThemedDateInput>— drop-in for <input type="date"> (value "YYYY-MM-DD", honors min/max)
//   <ThemedTimeInput>— drop-in for <input type="time"> (value "HH:MM" 24h)
// All fire onChange({ target: { value } }) so existing handlers keep working,
// and apply the caller's style/className to the trigger so each page keeps its look.

import React, { useState, useRef, useEffect, useMemo, Children } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ChevronDown, ChevronLeft, ChevronRight, Check, Calendar as CalendarIcon, Clock } from 'lucide-react';

// ---------- shared popup plumbing ------------------------------------------

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, onClose]);
}

function usePopupColors() {
  const { theme, isDarkMode } = useTheme();
  const accent = theme.accent.primary;
  return {
    theme, isDarkMode, accent,
    popupBg: isDarkMode ? 'linear-gradient(135deg, #1E2347 0%, #181D40 100%)' : '#FFFFFF',
    popupBorder: isDarkMode ? 'rgba(255,212,28,0.3)' : 'rgba(59,130,246,0.3)',
    popupShadow: isDarkMode ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(0,0,0,0.15)',
    hoverBg: isDarkMode ? 'rgba(255,212,28,0.12)' : 'rgba(59,130,246,0.1)',
    onAccent: isDarkMode ? '#181D40' : '#FFFFFF',
    mutedText: theme.text.tertiary,
  };
}

// Popups render with position:fixed (viewport coordinates) so they escape
// overflow/scroll containers like table wrappers; position recomputes on any
// scroll/resize and flips above the trigger when there's no room below.
function useFixedPopupPos(wrapRef, open, estHeight, estWidth) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < estHeight + 12 && r.top > spaceBelow;
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, estWidth) - 8)),
        width: r.width,
        top: openUp ? undefined : r.bottom + 6,
        bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]); // eslint-disable-line
  return pos;
}

const popupStyle = (c, pos, extra = {}) => ({
  position: 'fixed', top: pos?.top, bottom: pos?.bottom, left: pos?.left, zIndex: 10000,
  background: c.popupBg, border: `2px solid ${c.popupBorder}`, borderRadius: 12,
  boxShadow: c.popupShadow, overflow: 'hidden', ...extra
});

// ---------- ThemedSelect -----------------------------------------------------

export function ThemedSelect({ value, onChange, children, style = {}, className = '', disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const c = usePopupColors();
  useClickOutside(wrapRef, () => setOpen(false));
  const pos = useFixedPopupPos(wrapRef, open, 272, 240);

  // Parse <option> children (supports arrays from .map)
  const options = useMemo(() => {
    const out = [];
    const walk = (nodes) => Children.forEach(nodes, (node) => {
      if (!node) return;
      if (Array.isArray(node)) return walk(node);
      if (node.type === 'option') {
        out.push({
          value: node.props.value ?? String(node.props.children ?? ''),
          label: node.props.children,
          disabled: !!node.props.disabled
        });
      } else if (node.props?.children) {
        walk(node.props.children);
      }
    });
    walk(children);
    return out;
  }, [children]);

  const selected = options.find((o) => String(o.value) === String(value));

  const pick = (opt) => {
    if (opt.disabled) return;
    setOpen(false);
    onChange && onChange({ target: { value: opt.value } });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', width: style.width || undefined }} className={/w-full/.test(className) ? 'w-full' : ''}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
        className={className}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : <span style={{ color: c.mutedText }}>Select…</span>}
        </span>
        <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', color: c.accent }} />
      </button>

      {open && pos && (
        <div style={popupStyle(c, pos, { minWidth: pos.width, maxHeight: 260, overflowY: 'auto', padding: 4 })}>
          {options.map((opt, i) => {
            const isSel = String(opt.value) === String(value);
            return (
              <div
                key={`${opt.value}-${i}`}
                onClick={() => pick(opt)}
                onMouseEnter={(e) => { if (!isSel && !opt.disabled) e.currentTarget.style.background = c.hoverBg; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: opt.disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  background: isSel ? c.accent : 'transparent',
                  color: opt.disabled ? c.mutedText : isSel ? c.onAccent : c.theme.text.primary,
                  opacity: opt.disabled ? 0.5 : 1
                }}
              >
                <span>{opt.label}</span>
                {isSel && <Check style={{ width: 14, height: 14 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- ThemedDateInput --------------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseYMD = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export function ThemedDateInput({ value, onChange, min, max, style = {}, className = '', placeholder = 'Select date' }) {
  const [open, setOpen] = useState(false);
  const selDate = parseYMD(value);
  const [view, setView] = useState(() => selDate || new Date());
  const wrapRef = useRef(null);
  const c = usePopupColors();
  useClickOutside(wrapRef, () => setOpen(false));
  const pos = useFixedPopupPos(wrapRef, open, 360, 252);

  useEffect(() => { if (open) setView(parseYMD(value) || new Date()); }, [open]); // eslint-disable-line

  const minD = parseYMD(min), maxD = parseYMD(max);
  const inRange = (d) => (!minD || d >= minD) && (!maxD || d <= maxD);

  const year = view.getFullYear(), month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayYMD = toYMD(new Date());

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const display = selDate
    ? selDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const pick = (d) => {
    if (!inRange(d)) return;
    setOpen(false);
    onChange && onChange({ target: { value: toYMD(d) } });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }} className={/w-full/.test(className) ? 'w-full' : ''}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', ...style }}
        className={className}
      >
        <span style={{ whiteSpace: 'nowrap', color: display ? undefined : c.mutedText }}>{display || placeholder}</span>
        <CalendarIcon style={{ width: 14, height: 14, flexShrink: 0, color: c.accent }} />
      </button>

      {open && pos && (
        <div style={popupStyle(c, pos, { width: 252, padding: 12 })}>
          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))}
              style={{ padding: 4, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', color: c.accent }}
              onMouseEnter={(e) => e.currentTarget.style.background = c.hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 800, color: c.theme.text.primary }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))}
              style={{ padding: 4, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', color: c.accent }}
              onMouseEnter={(e) => e.currentTarget.style.background = c.hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Weekday row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: c.mutedText, padding: '4px 0', textTransform: 'uppercase' }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const ymd = toYMD(d);
              const isSel = value === ymd;
              const isToday = ymd === todayYMD;
              const enabled = inRange(d);
              return (
                <div
                  key={ymd}
                  onClick={() => pick(d)}
                  onMouseEnter={(e) => { if (enabled && !isSel) e.currentTarget.style.background = c.hoverBg; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                  style={{
                    textAlign: 'center', padding: '5px 0', fontSize: 12, fontWeight: 700, borderRadius: 8,
                    cursor: enabled ? 'pointer' : 'not-allowed',
                    background: isSel ? c.accent : 'transparent',
                    color: !enabled ? c.mutedText : isSel ? c.onAccent : c.theme.text.primary,
                    opacity: enabled ? 1 : 0.35,
                    outline: isToday && !isSel ? `1.5px solid ${c.accent}` : 'none',
                    outlineOffset: -1.5
                  }}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>

          {/* Footer: Today / Clear */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.popupBorder}` }}>
            <button type="button"
              onClick={() => { const t = new Date(); if (inRange(t)) pick(t); else setView(t); }}
              style={{ fontSize: 11, fontWeight: 800, color: c.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              Today
            </button>
            <button type="button"
              onClick={() => { setOpen(false); onChange && onChange({ target: { value: '' } }); }}
              style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- ThemedTimeInput --------------------------------------------------

export function ThemedTimeInput({ value, onChange, style = {}, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const c = usePopupColors();
  useClickOutside(wrapRef, () => setOpen(false));
  const pos = useFixedPopupPos(wrapRef, open, 200, 190);

  const [hh, mm] = (value || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;

  const emit = (h12, m, p) => {
    let h = h12 % 12;
    if (p === 'PM') h += 12;
    onChange && onChange({ target: { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` } });
  };

  const display = value
    ? `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`
    : null;

  const colStyle = { maxHeight: 180, overflowY: 'auto', padding: 4, minWidth: 56 };
  const itemStyle = (active) => ({
    textAlign: 'center', padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    background: active ? c.accent : 'transparent',
    color: active ? c.onAccent : c.theme.text.primary
  });

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }} className={/w-full/.test(className) ? 'w-full' : ''}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', ...style }}
        className={className}
      >
        <span style={{ whiteSpace: 'nowrap', color: display ? undefined : c.mutedText }}>{display || 'Select time'}</span>
        <Clock style={{ width: 14, height: 14, flexShrink: 0, color: c.accent }} />
      </button>

      {open && pos && (
        <div style={popupStyle(c, pos, { display: 'flex', gap: 2, padding: 6 })}>
          <div style={colStyle}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <div key={h} style={itemStyle(h === hour12)} onClick={() => emit(h, mm, period)}
                onMouseEnter={(e) => { if (h !== hour12) e.currentTarget.style.background = c.hoverBg; }}
                onMouseLeave={(e) => { if (h !== hour12) e.currentTarget.style.background = 'transparent'; }}>
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>
          <div style={colStyle}>
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <div key={m} style={itemStyle(m === mm)} onClick={() => emit(hour12, m, period)}
                onMouseEnter={(e) => { if (m !== mm) e.currentTarget.style.background = c.hoverBg; }}
                onMouseLeave={(e) => { if (m !== mm) e.currentTarget.style.background = 'transparent'; }}>
                {String(m).padStart(2, '0')}
              </div>
            ))}
          </div>
          <div style={{ ...colStyle, overflowY: 'visible' }}>
            {['AM', 'PM'].map((p) => (
              <div key={p} style={itemStyle(p === period)} onClick={() => emit(hour12, mm, p)}
                onMouseEnter={(e) => { if (p !== period) e.currentTarget.style.background = c.hoverBg; }}
                onMouseLeave={(e) => { if (p !== period) e.currentTarget.style.background = 'transparent'; }}>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

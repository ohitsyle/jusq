// src/components/layouts/TabStrip.jsx
// Tab row for the admin layouts. When the window is too narrow for every tab,
// the row scrolls sideways inside its bar instead of making the whole page
// scroll horizontally. Cues that there's more: a thin themed scrollbar under
// the tabs, and a fade on the side that has hidden tabs. A mouse wheel over the
// row scrolls it sideways (mice can't scroll horizontally otherwise). The
// active tab is kept in view. Tab buttons mark themselves with data-active.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const FADE = 28;      // px of fade on a side with hidden tabs
const BAR = 10;       // px reserved under the tabs for the scrollbar

export default function TabStrip({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const { isDarkMode } = useTheme();
  const [edges, setEdges] = useState({ left: false, right: false, overflow: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    const left = overflow && el.scrollLeft > 2;
    const right = overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right && e.overflow === overflow ? e : { left, right, overflow }));
  }, []);

  useEffect(() => {
    const strip = ref.current;
    const active = strip?.querySelector('[data-active="true"]');
    if (strip && active && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
    }
    measure();
  }, [pathname, measure]);

  useEffect(() => {
    const strip = ref.current;
    window.addEventListener('resize', measure);
    // Vertical wheel -> sideways scroll, but only while the row can still move
    // that way; at either end the page scrolls as usual.
    const onWheel = (e) => {
      if (!strip || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = strip.scrollWidth - strip.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, strip.scrollLeft + e.deltaY));
      if (next === strip.scrollLeft) return;
      e.preventDefault();
      strip.scrollLeft = next;
    };
    strip?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('resize', measure);
      strip?.removeEventListener('wheel', onWheel);
    };
  }, [measure]);

  const thumb = isDarkMode ? 'rgba(255,212,28,0.55)' : 'rgba(59,130,246,0.55)';
  const track = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Fade only the tabs, not the scrollbar strip beneath them.
  const fade = `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'} 0, #000 ${edges.left ? FADE : 0}px, #000 calc(100% - ${edges.right ? FADE : 0}px), ${edges.right ? 'transparent' : '#000'} 100%)`;
  const maskStyle = edges.left || edges.right ? {
    maskImage: `${fade}, linear-gradient(#000, #000)`,
    WebkitMaskImage: `${fade}, linear-gradient(#000, #000)`,
    maskSize: `100% calc(100% - ${BAR}px), 100% ${BAR}px`,
    WebkitMaskSize: `100% calc(100% - ${BAR}px), 100% ${BAR}px`,
    maskPosition: 'top, bottom',
    WebkitMaskPosition: 'top, bottom',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat'
  } : {};

  return (
    <div
      ref={ref}
      onScroll={measure}
      style={{
        '--nu-tab-thumb': thumb,
        '--nu-tab-track': track,
        paddingBottom: edges.overflow ? BAR : undefined,
        ...maskStyle
      }}
      className="nu-tab-strip relative flex items-center gap-2 overflow-x-auto p-1 -m-1 [&>*]:flex-shrink-0 [&>button]:whitespace-nowrap"
    >
      {children}
      <style>{`
        /* Standard properties only where ::-webkit-scrollbar isn't supported (Firefox):
           in Chrome they would override the styled bar with the OS default, which on
           macOS is an overlay that stays hidden until you scroll. */
        @supports not selector(::-webkit-scrollbar) {
          .nu-tab-strip { scrollbar-width: thin; scrollbar-color: var(--nu-tab-thumb) transparent; }
        }
        .nu-tab-strip::-webkit-scrollbar { height: 6px; }
        .nu-tab-strip::-webkit-scrollbar-track { background: var(--nu-tab-track); border-radius: 999px; margin: 0 6px; }
        .nu-tab-strip::-webkit-scrollbar-thumb { background: var(--nu-tab-thumb); border-radius: 999px; }
        .nu-tab-strip::-webkit-scrollbar-thumb:hover { background: ${isDarkMode ? 'rgba(255,212,28,0.85)' : 'rgba(59,130,246,0.85)'}; }
      `}</style>
    </div>
  );
}

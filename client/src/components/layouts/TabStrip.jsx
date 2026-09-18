// src/components/layouts/TabStrip.jsx
// Tab row for the admin layouts. When the window is too narrow for every tab,
// the row scrolls sideways inside its bar (scrollbar hidden) instead of making
// the whole page scroll horizontally. The edge that has more tabs beyond it
// fades out as a hint, and the active tab is kept in view.
// Tab buttons mark themselves with data-active.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const FADE = 28; // px

export default function TabStrip({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
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
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const mask = edges.left || edges.right
    ? `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'} 0, #000 ${edges.left ? FADE : 0}px, #000 calc(100% - ${edges.right ? FADE : 0}px), ${edges.right ? 'transparent' : '#000'} 100%)`
    : undefined;

  return (
    <div
      ref={ref}
      onScroll={measure}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="relative flex items-center gap-2 overflow-x-auto p-1 -m-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:flex-shrink-0 [&>button]:whitespace-nowrap"
    >
      {children}
    </div>
  );
}

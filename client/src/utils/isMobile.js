// src/utils/isMobile.js
// Detect phone-class devices so the admin dashboards can be restricted to
// desktop/laptop. Targets phones specifically — tablets and desktops pass.

export function isMobileDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';

  // Phone user agents (Android phones include "Mobile"; Android tablets do not).
  const phoneUA = /Android.+Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile.+Firefox/i;
  if (phoneUA.test(ua)) return true;

  // Fallback: a coarse-pointer (touch-primary) device with a small screen.
  try {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.screen?.width || 9999, window.screen?.height || 9999) < 500;
    if (coarse && small) return true;
  } catch (e) { /* ignore */ }

  return false;
}

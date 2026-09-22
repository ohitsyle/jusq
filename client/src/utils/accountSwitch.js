// client/src/utils/accountSwitch.js
// Admins can have their own NUCash employee wallet (one login opens both).
// Only one session is stored at a time — the API client sends whichever
// token it finds, so keeping both would send the admin token to wallet pages.
import api from './api';

export const ADMIN_HOME = {
  treasury: '/admin/treasury/dashboard',
  accounting: '/admin/accounting/home',
  marketing: '/admin/marketing/home',
  sysad: '/admin/sysad/dashboard',
};
export const adminHome = (role) => ADMIN_HOME[role] || `/admin/${role}`;

// After sign-in (or activation): { admin: login response, wallet: { token, user } }
export const PENDING_KEY = 'nucash_pending_choice';

const keepTheme = (fn) => {
  const theme = localStorage.getItem('nucash-theme');
  fn();
  if (theme) localStorage.setItem('nucash-theme', theme);
};

export function startAdminSession(adminData, token) {
  keepTheme(() => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminData', JSON.stringify(adminData));
  });
  return adminHome(adminData.role);
}

export function startWalletSession({ token, user }) {
  keepTheme(() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    localStorage.setItem('userToken', token);
    localStorage.setItem('userData', JSON.stringify(user));
  });
  return '/user/dashboard';
}

const readJSON = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

// What the profile menu can offer right now
export function switchTarget() {
  if (localStorage.getItem('adminToken')) return readJSON('adminData')?.linkedUserId ? 'wallet' : null;
  if (localStorage.getItem('userToken')) return readJSON('userData')?.linkedAdmin ? 'admin' : null;
  return null;
}

// Throws the server's message (e.g. wallet deactivated) for the caller to show
export async function switchAccount() {
  const target = switchTarget();
  if (target === 'wallet') {
    const r = await api.post('/admin/auth/switch-to-wallet');
    window.location.assign(startWalletSession(r));
  } else if (target === 'admin') {
    const r = await api.post('/user/switch-to-admin');
    window.location.assign(startAdminSession(r.admin, r.token));
  }
}

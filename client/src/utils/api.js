// Unified API configuration for all apps
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token and admin info
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken') ||
                localStorage.getItem('merchantToken') ||
                localStorage.getItem('userToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Add admin information to headers for logging
  const adminData = localStorage.getItem('adminData');
  if (adminData) {
    try {
      const admin = JSON.parse(adminData);
      config.headers['X-Admin-Id'] = admin.adminId || admin.schoolUId || '';
      const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email || 'Admin';
      config.headers['X-Admin-Name'] = adminName;
      config.headers['X-Admin-Role'] = admin.role || '';
      config.headers['X-Admin-Department'] = admin.role || '';
    } catch (e) {
      console.warn('Failed to parse adminData:', e);
    }
  }
  
  return config;
});

// Handle responses
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data || {};
    // The login page shows why (PIN changed on another device, account deactivated, lock).
    const endSession = (notice) => {
      try { if (notice) sessionStorage.setItem('nucash_signout_notice', JSON.stringify(notice)); } catch { /* private mode */ }
      localStorage.clear();
      window.location.href = '/login';
    };
    if (status === 401) {
      endSession(data.signedOut ? { title: data.locked ? 'Account locked' : 'Signed out', message: data.error } : null);
    } else if (status === 403 && data.deactivated && localStorage.getItem('userToken')) {
      endSession({ title: 'Account deactivated', message: data.error });
    }
    
    // Handle maintenance mode (503) - force logout and redirect to login
    if (error.response?.status === 503) {
      const data = error.response.data;
      if (data?.maintenanceMode && data?.forceLogout) {
        console.log('🔧 Maintenance mode detected - forcing logout');
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error.response?.data || { message: error.message });
  }
);

export default api;
export { API_BASE_URL };

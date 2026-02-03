// Unified API configuration for all apps
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://18.166.29.239:3000/api';

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
      config.headers['X-Admin-Id'] = admin.adminId;
      config.headers['X-Admin-Name'] = `${admin.firstName} ${admin.lastName}`;
      config.headers['X-Admin-Role'] = admin.role;
      config.headers['X-Admin-Department'] = admin.role;
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
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
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

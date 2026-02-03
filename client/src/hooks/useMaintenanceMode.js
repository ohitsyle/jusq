// client/src/hooks/useMaintenanceMode.js
// Hook to check maintenance mode status and handle force logout

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useMaintenanceMode() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const navigate = useNavigate();

  // Backend URL for API calls
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://18.166.29.239:3000';

  // Check if current user is sysadmin
  const isSysadmin = useCallback(() => {
    try {
      const adminData = localStorage.getItem('adminData');
      if (!adminData) return false;
      
      const parsed = JSON.parse(adminData);
      return parsed.role === 'sysad';
    } catch (error) {
      console.error('Error checking sysadmin status:', error);
      return false;
    }
  }, []);

  // Check maintenance mode status
  const checkMaintenanceStatus = useCallback(async () => {
    // Don't check maintenance status if on force-logout page
    if (window.location.pathname === '/force-logout') {
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/admin/sysad/maintenance-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.maintenanceMode) {
          setIsMaintenanceMode(true);
          setMaintenanceMessage(data.message || 'System is under maintenance.');
          
          // If not sysadmin and maintenance mode is enabled, force logout
          if (!isSysadmin()) {
            console.log('🔧 Maintenance mode detected - logging out non-sysadmin user');
            forceLogout();
          }
        } else {
          setIsMaintenanceMode(false);
          setMaintenanceMessage('');
        }
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error);
    }
  }, [backendUrl, isSysadmin]);

  // Force logout function
  const forceLogout = useCallback(() => {
    // Clear all auth data
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');

    // Redirect to force logout page
    window.location.href = '/force-logout';
  }, []);

  // Set up periodic checking
  useEffect(() => {
    // Don't run maintenance check on force-logout page to avoid infinite loop
    if (window.location.pathname === '/force-logout') {
      return;
    }

    // Check immediately on mount
    checkMaintenanceStatus();

    // Set up interval to check every 30 seconds
    const interval = setInterval(checkMaintenanceStatus, 30000);

    return () => clearInterval(interval);
  }, [checkMaintenanceStatus]);

  // Listen for maintenance mode events from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'maintenanceMode') {
        checkMaintenanceStatus();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkMaintenanceStatus]);

  return {
    isMaintenanceMode,
    maintenanceMessage,
    isSysadmin: isSysadmin(),
    checkMaintenanceStatus,
    forceLogout
  };
}

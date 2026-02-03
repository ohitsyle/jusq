// server/middlewares/maintenanceMode.js
// Maintenance mode middleware - logs out non-sysadmin users when maintenance is enabled

import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';

// In-memory maintenance mode state (in production, use Redis or database)
let maintenanceMode = false;
let maintenanceMessage = 'System is under maintenance. Please try again later.';

/**
 * Middleware to check maintenance mode and logout non-sysadmin users
 */
export async function checkMaintenanceMode(req, res, next) {
  try {
    // Skip maintenance check for login, logout, and static routes
    const publicRoutes = [
      '/login',
      '/logout', 
      '/activate',
      '/maintenance',
      '/force-logout',
      '/terms-and-conditions',
      '/privacy-policy'
    ];
    
    const isPublicRoute = req.path === '/force-logout' || publicRoutes.some(route => req.path === route || req.path.startsWith(route));
    
    if (isPublicRoute) {
      return next();
    }

    // If maintenance mode is not enabled, proceed normally
    if (!maintenanceMode) {
      return next();
    }

    // Only apply maintenance mode to API requests (except maintenance status endpoints)
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Skip maintenance check for maintenance status endpoints
    if (req.path.includes('/maintenance-status') || req.path.includes('/maintenance-mode')) {
      return next();
    }

    // Check if user is sysadmin
    let isAdmin = false;
    let isSysadmin = false;

    // Try to extract JWT token from request
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.role === 'sysad' || decoded.role === 'admin' || decoded.role === 'merchant') {
          isAdmin = true;
          isSysadmin = decoded.role === 'sysad';
        }
        
        console.log('🔍 Maintenance check - isAdmin:', isAdmin, 'decoded.role:', decoded.role, 'isSysadmin:', isSysadmin);
      } catch (error) {
        console.log('🔍 Invalid token - treating as non-admin');
      }
    } else {
      console.log('🔍 No auth token found - treating as non-admin');
    }

    // If maintenance mode is enabled and user is not sysadmin, force logout
    if (!isSysadmin) {
      console.log(`🔧 Maintenance mode active - forcing logout for non-sysadmin user`);
      
      // For API requests, return maintenance response
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({
          success: false,
          maintenanceMode: true,
          message: maintenanceMessage,
          forceLogout: true
        });
      }
      
      // For web requests, redirect to force logout page
      return res.redirect('/force-logout');
    }

    // Sysadmin can proceed during maintenance
    next();
  } catch (error) {
    console.error('❌ Maintenance mode middleware error:', error);
    next();
  }
}

/**
 * Get current maintenance mode status
 */
export function getMaintenanceStatus() {
  return {
    enabled: maintenanceMode,
    message: maintenanceMessage
  };
}

/**
 * Set maintenance mode status
 */
export function setMaintenanceMode(enabled, message = null) {
  maintenanceMode = enabled;
  if (message) {
    maintenanceMessage = message;
  }
  
  console.log(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  
  return {
    enabled: maintenanceMode,
    message: maintenanceMessage
  };
}

/**
 * Force logout endpoint - redirects to force-logout page
 */
export function forceLogout(req, res) {
  res.redirect('/force-logout');
}

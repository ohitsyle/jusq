// Admin authentication middleware.
//
// requireAdminAuth        — full guard: every request needs a valid admin JWT
//                           (verified signature + admin role + admin still exists).
// requireAdminAuthExcept  — same, but skips an allowlist of public sub-paths
//                           (e.g. /maintenance-status is read by the login page
//                           before anyone is authenticated).
// requireAdminAuthForMutations — legacy write-only guard, kept for the routers
//                           that already mount it (harmless now that the full
//                           guard runs at the app level).
//
// The token is the admin JWT issued by login.js / adminauth.js (signed with
// process.env.JWT_SECRET). The web admin client always sends it in the
// Authorization header; on 401 it auto-logs-out and returns to /login.

import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'nucash_secret_2025';

const ADMIN_ROLES = ['motorpool', 'merchant', 'treasury', 'accounting', 'sysad', 'marketing'];

async function verifyAdminRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), getJwtSecret());
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }

  if (!decoded.role || !ADMIN_ROLES.includes(decoded.role)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }

  // Confirm the admin still exists and is usable (kills tokens of deleted /
  // deactivated admins).
  try {
    const admin = await Admin.findById(decoded.id).select('role isActive isDeactivated').lean();
    if (!admin || admin.isDeactivated) {
      return res.status(401).json({ success: false, message: 'Account no longer active. Please log in again.' });
    }
    req.authAdmin = { id: decoded.id, role: admin.role, adminId: decoded.adminId };
    return next();
  } catch (err) {
    console.error('requireAdminAuth lookup failed:', err.message);
    return res.status(500).json({ success: false, message: 'Authentication check failed' });
  }
}

export function requireAdminAuth(req, res, next) {
  return verifyAdminRequest(req, res, next);
}

// Skip auth for specific public sub-paths of a router mount.
export function requireAdminAuthExcept(publicPaths = []) {
  return (req, res, next) => {
    if (publicPaths.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
      return next();
    }
    return verifyAdminRequest(req, res, next);
  };
}

export function requireAdminAuthForMutations(req, res, next) {
  if (req.method === 'GET') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), getJwtSecret());
    req.authAdmin = decoded; // { id, role, adminId }
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}

export default requireAdminAuthForMutations;

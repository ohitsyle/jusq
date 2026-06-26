// Middleware: require a valid admin JWT for state-changing (non-GET) requests.
//
// Why non-GET only:
//  - GET requests stay open so public reads keep working — notably the
//    pre-login maintenance-status / config checks and the various dashboards.
//  - The real risk we are closing is anonymous WRITES (create admin, delete
//    user, cash-in, refund, register, config change). Those are all non-GET.
//
// The token is the same admin JWT issued by login.js / adminauth.js (signed
// with process.env.JWT_SECRET). The web admin clients already send it in the
// Authorization header, so authenticated users are unaffected.

import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET || 'nucash_secret_2025';

export function requireAdminAuthForMutations(req, res, next) {
  // Reads pass through untouched.
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

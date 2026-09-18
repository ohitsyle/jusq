// Auth for the mobile app's driver/merchant endpoints (/api/shuttle, /api/shuttles,
// /api/trips, /api/merchant/pay). The app sends the JWT it got from /api/login
// on every request (mobile/src/services/api.js), so no app change is needed.
//
// Status codes matter to the app: it deletes its stored login on ANY 401, so
// 401 is only returned when the login itself is missing/invalid/expired.
import jwt from 'jsonwebtoken';
import Driver from '../models/Driver.js';
import Merchant from '../models/Merchant.js';

// Offline taps are queued on the phone and synced later. If the driver's 24h
// login expired in between, still accept a queued tap as long as it happened
// while that login was valid — the token's signature proves the server issued it.
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function tapDuringLogin(decoded, body) {
  if (body?.offlineMode !== true || !body.deviceTimestamp) return false;
  const tap = Date.parse(body.deviceTimestamp);
  const issued = (decoded.iat || 0) * 1000;
  const expired = decoded.exp * 1000;
  return Number.isFinite(tap)
    && tap >= issued - 60 * 1000
    && tap <= expired
    && Date.now() - expired <= OFFLINE_GRACE_MS;
}

export function requireDeviceAuth(roles = ['driver']) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please sign in on the NUCash app' });

    let decoded;
    let viaOfflineGrace = false;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name !== 'TokenExpiredError') return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
      decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
      if (!tapDuringLogin(decoded, req.body)) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
      viaOfflineGrace = true;
    }

    if (!roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'This account cannot do that' });
    }

    // The account must still exist; a deactivated one can only finish syncing
    // taps it took while it was still active.
    const Model = decoded.role === 'driver' ? Driver : Merchant;
    const account = await Model.findById(decoded.id).select('isActive driverId merchantId').lean().catch(() => null);
    if (!account) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    if (!account.isActive && !viaOfflineGrace) return res.status(403).json({ error: 'This account is inactive' });

    // A driver can only act as themselves. Queued offline taps keep the driver
    // who took them (the phone may have changed hands since).
    if (decoded.role === 'driver' && req.body?.driverId && req.body.driverId !== decoded.driverId && req.body.offlineMode !== true) {
      return res.status(403).json({ error: 'Driver ID does not match the signed-in driver' });
    }

    req.device = { role: decoded.role, id: decoded.id, driverId: decoded.driverId, merchantId: decoded.merchantId };
    next();
  };
}

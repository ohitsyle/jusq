// Throughput rate limiting for money endpoints. Same no-dependency
// fixed-window pattern as loginRateLimit, but counts every request (these are
// abuse/runaway-client guards, not brute-force guards). Limits are generous —
// a full shuttle boarding is ~60 taps in a couple of minutes from one phone.
//
// In-memory state resets on restart — acceptable for a single-instance deploy.

export function makeRateLimit({ windowMs, max, message, keyFn }) {
  const hits = new Map(); // key (default: ip) -> { count, windowStart }

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.windowStart > windowMs) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : (req.ip || req.connection?.remoteAddress || 'unknown');
    const now = Date.now();
    const entry = hits.get(key);

    if (entry && now - entry.windowStart <= windowMs) {
      entry.count += 1;
      if (entry.count > max) {
        return res.status(429).json({ error: message || 'Too many requests. Please slow down.' });
      }
    } else {
      hits.set(key, { count: 1, windowStart: now });
    }
    next();
  };
}

export const shuttlePayLimit = makeRateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many payment requests. Please wait a moment.'
});

export const merchantPayLimit = makeRateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many payment requests. Please wait a moment.'
});

// Students on campus Wi-Fi share one public IP, so count per account (on that
// IP) rather than per IP alone. The account id is read from the bearer token
// without verifying it — the route itself rejects bad tokens.
const accountKey = (req) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  let id = '';
  try { id = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString()).id || ''; } catch { /* no/odd token */ }
  return `${req.ip || 'unknown'}|${id}`;
};

export const transferLimit = makeRateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyFn: accountKey,
  message: 'Too many transfer attempts. Please wait a minute.'
});

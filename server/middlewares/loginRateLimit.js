// Brute-force protection for PIN/password logins. No external dependencies —
// a fixed-window in-memory counter keyed by IP + identifier.
//
// Only FAILED attempts count (4xx responses); a successful login clears the
// key. After MAX_FAILS failures within WINDOW_MS the caller gets 429 until the
// window expires. Memory is bounded by periodic pruning.
//
// Note: in-memory state resets on server restart — acceptable for a
// single-instance deployment; it still makes 6-digit PIN brute force
// impractical (8 tries / 10 min ≈ years to cover the keyspace).

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILS = 8;              // failures allowed per window per key

const attempts = new Map(); // key -> { count, windowStart }

// Prune stale entries so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
  }
}, WINDOW_MS).unref();

function keyFor(req) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const who = (req.body?.emailOrUsername || req.body?.email || '').toString().trim().toLowerCase();
  return `${ip}|${who}`;
}

export function loginRateLimit(req, res, next) {
  const key = keyFor(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && now - entry.windowStart <= WINDOW_MS && entry.count >= MAX_FAILS) {
    const retryMin = Math.ceil((entry.windowStart + WINDOW_MS - now) / 60000);
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${retryMin} minute${retryMin !== 1 ? 's' : ''}.`
    });
  }

  // Count the outcome after the handler responds.
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      attempts.delete(key); // successful login clears the slate
      return;
    }
    if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 429) {
      const cur = attempts.get(key);
      if (cur && now - cur.windowStart <= WINDOW_MS) {
        cur.count += 1;
      } else {
        attempts.set(key, { count: 1, windowStart: now });
      }
    }
  });

  next();
}

export default loginRateLimit;

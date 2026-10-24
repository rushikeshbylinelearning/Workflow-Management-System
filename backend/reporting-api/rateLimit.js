/**
 * Per-key rate and concurrency limits. These protect the DB — they are NOT row caps.
 */

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60_000;
  const maxPerWindow = options.maxPerWindow || Number(process.env.REPORTING_RATE_LIMIT_PER_MINUTE || 60);
  const maxConcurrent = options.maxConcurrent || Number(process.env.REPORTING_MAX_CONCURRENT_PER_KEY || 2);

  /** @type {Map<number, { count: number, resetAt: number, inflight: number }>} */
  const state = new Map();

  function get(keyId) {
    const now = Date.now();
    let entry = state.get(keyId);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs, inflight: entry ? entry.inflight : 0 };
      state.set(keyId, entry);
    }
    return entry;
  }

  function middleware(req, res, next) {
    const keyId = req.reportingKey?.id;
    if (!keyId) return next();

    const entry = get(keyId);
    if (entry.count >= maxPerWindow) {
      const retry = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: 'rate_limited', message: 'Too many requests' });
    }
    if (entry.inflight >= maxConcurrent) {
      res.setHeader('Retry-After', '5');
      return res.status(429).json({ error: 'rate_limited', message: 'Too many concurrent requests' });
    }

    entry.count += 1;
    entry.inflight += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const current = state.get(keyId);
      if (current) current.inflight = Math.max(0, current.inflight - 1);
    };
    res.on('finish', release);
    res.on('close', release);
    return next();
  }

  return { middleware, _state: state };
}

module.exports = { createRateLimiter };

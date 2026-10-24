function createRateLimiter(options = {}) {
  const buckets = new Map();
  const limit = options.limit || Number(process.env.POWERBI_RATE_LIMIT_PER_MINUTE || 60);
  const windowMs = options.windowMs || 60_000;
  const nowFn = options.now || (() => Date.now());

  function consume(keyId) {
    const now = nowFn();
    let bucket = buckets.get(keyId);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(keyId, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.start + windowMs - now) / 1000));
      return { ok: false, retryAfter };
    }
    return { ok: true };
  }

  function middleware(req, res, next) {
    const keyId = req.powerbiKey && req.powerbiKey.id;
    if (!keyId) return next();
    const result = consume(keyId);
    if (!result.ok) {
      res.set('Retry-After', String(result.retryAfter));
      return res.status(429).json({ error: 'rate_limited' });
    }
    return next();
  }

  return { consume, middleware, buckets };
}

module.exports = { createRateLimiter };

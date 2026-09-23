// A minimal fixed-window rate limiter, in-memory only. This backend runs as
// a single Railway service instance with no shared cache/Redis, so this is
// deliberately the same class of protection the pre-existing
// resend-verification limiter already used (server.mjs's old
// `_resendLimiter`) -- generalized so every route that needs one doesn't
// reinvent it. It blunts casual scripted abuse (credential stuffing, promo-
// code guessing, checkout spam); it is not a substitute for an edge/WAF
// rate limiter, resets on every redeploy, and would need a shared store to
// stay effective across more than one instance. Good enough for this
// launch's scale; documented here so it isn't mistaken for more than it is.
export function createRateLimiter({ max, windowMs }) {
  const buckets = new Map();

  // Without this, a limiter that sees many distinct keys (e.g. one per
  // attacking IP) would grow forever. Sweeping every windowMs keeps memory
  // bounded; unref() so a dangling interval never keeps the process (or a
  // test run) alive.
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of buckets) {
      if (entry.windowStart < cutoff) buckets.delete(key);
    }
  }, windowMs);
  if (typeof timer.unref === "function") timer.unref();

  return function checkRateLimit(key) {
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  };
}

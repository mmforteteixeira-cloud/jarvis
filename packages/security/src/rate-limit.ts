/**
 * In-memory fixed-window rate limiter. Deliberately simple — JARVIS runs as
 * a single local process per user, not a multi-instance service, so there's
 * no need for a shared store (Redis etc.) here. This exists to stop a
 * runaway client loop or a misbehaving script from hammering the AI
 * provider or the task engine, not to defend a multi-tenant public API.
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - entry.windowStart) };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

/** Test-only: clears all buckets so tests don't interfere with each other. */
export function __resetRateLimitsForTests(): void {
  buckets.clear();
}

// Bounds memory from keys that stop being used (e.g. a client that changed
// IP). Unref'd so it never keeps the process alive on its own.
const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now - entry.windowStart > 10 * 60_000) buckets.delete(key);
    }
  },
  5 * 60_000,
);
cleanupTimer.unref?.();

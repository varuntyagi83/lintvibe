// In-memory sliding window rate limiter.
// Resets on server restart — acceptable for MVP.

const store = new Map<string, number[]>();

// Evict entries for users who haven't made a request in more than 2x the window.
// Called periodically to prevent unbounded memory growth.
let lastEviction = Date.now();
function maybeEvict(windowMs: number) {
  const now = Date.now();
  if (now - lastEviction < windowMs * 2) return;
  lastEviction = now;
  const cutoff = now - windowMs * 2;
  for (const [key, timestamps] of store.entries()) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  userId: string,
  limit: number,
  windowMs: number,
  bypass = false
): { allowed: boolean; retryAfter?: number } {
  if (bypass) return { allowed: true };
  const now = Date.now();
  const windowStart = now - windowMs;

  maybeEvict(windowMs);

  // Get existing timestamps and discard those outside the window
  const timestamps = (store.get(userId) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    // Oldest timestamp in window tells us when a slot opens
    const oldestInWindow = timestamps[0];
    const retryAfter = oldestInWindow + windowMs - now;
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  store.set(userId, timestamps);
  return { allowed: true };
}

// In-memory sliding window rate limiter.
// Resets on server restart — acceptable for MVP.

const store = new Map<string, number[]>();

export function checkRateLimit(
  userId: string,
  limit: number,
  windowMs: number,
  bypass = false
): { allowed: boolean; retryAfter?: number } {
  if (bypass) return { allowed: true };
  const now = Date.now();
  const windowStart = now - windowMs;

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

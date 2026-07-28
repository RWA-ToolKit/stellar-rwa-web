/**
 * SlidingWindowRateLimiter
 *
 * Tracks per-connection inbound WS message rates using a sliding-window
 * algorithm.  Each call to `hit()` records the current timestamp; the window
 * is purged of entries older than `windowMs` on every call so memory stays
 * bounded to at most `limit` entries.
 *
 * Usage:
 *   const limiter = new SlidingWindowRateLimiter({ limit: 20, windowMs: 1000 });
 *   if (!limiter.hit()) {
 *     // over limit — close the connection
 *   }
 */

export interface RateLimiterOptions {
  /** Maximum number of messages allowed within the window. */
  limit: number;
  /** Sliding window duration in milliseconds. */
  windowMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  /** Timestamps (ms) of messages seen within the current window. */
  private readonly timestamps: number[] = [];

  constructor(options: RateLimiterOptions) {
    if (options.limit <= 0) throw new RangeError("limit must be > 0");
    if (options.windowMs <= 0) throw new RangeError("windowMs must be > 0");
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  /**
   * Record one message hit.
   * @returns `true` when the hit is within the allowed rate; `false` when it
   *          exceeds the limit and the caller should disconnect the client.
   */
  hit(now = Date.now()): boolean {
    const windowStart = now - this.windowMs;

    // Evict timestamps that have fallen outside the window.
    while (this.timestamps.length > 0 && this.timestamps[0] < windowStart) {
      this.timestamps.shift();
    }

    this.timestamps.push(now);

    return this.timestamps.length <= this.limit;
  }

  /** Current message count inside the sliding window (for testing/metrics). */
  get count(): number {
    return this.timestamps.length;
  }

  /** Remaining allowed hits in the current window (for testing/metrics). */
  get remaining(): number {
    return Math.max(0, this.limit - this.timestamps.length);
  }

  /** Reset state (e.g. when reusing an instance after a partial reset). */
  reset(): void {
    this.timestamps.length = 0;
  }
}

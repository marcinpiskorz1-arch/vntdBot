import { config } from "../../config.js";
import { logger } from "../../logger.js";

interface ProxyState {
  url: string;
  requestCount: number;
  consecutiveErrors: number;
  blockedUntil: number;   // Date.now() timestamp — skip until this time
}

/**
 * Round-robin proxy pool with per-proxy request tracking,
 * blacklisting (skip after repeated 429s), and stats.
 */
export class ProxyPool {
  private states: ProxyState[];
  private index = 0;
  private readonly maxRequestsPerProxy = 200;
  private readonly blockDurationMs = 5 * 60 * 1000; // 5 min
  private readonly blockAfterErrors = 3;

  // Cumulative stats (reset via resetStats)
  stats = { requests: 0, errors429: 0, blocked: 0 };

  constructor() {
    this.states = config.proxyUrls.map((url) => ({
      url,
      requestCount: 0,
      consecutiveErrors: 0,
      blockedUntil: 0,
    }));
    if (this.states.length === 0) {
      logger.warn("No proxies configured — running without proxy rotation");
    }
  }

  /** Get next available proxy URL (round-robin, skipping blocked). Returns undefined if none available. */
  next(): string | undefined {
    if (this.states.length === 0) return undefined;

    const now = Date.now();
    // Try each proxy once — if all blocked, return undefined
    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[this.index % this.states.length]!;
      this.index++;

      // Unblock if cooldown expired
      if (state.blockedUntil > 0 && now >= state.blockedUntil) {
        state.blockedUntil = 0;
        state.consecutiveErrors = 0;
        logger.info({ proxy: redact(state.url) }, "Proxy unblocked after cooldown");
      }

      if (state.blockedUntil > 0) continue; // Still blocked — skip

      state.requestCount++;
      this.stats.requests++;

      if (state.requestCount >= this.maxRequestsPerProxy) {
        state.requestCount = 0;
      }

      return state.url;
    }

    // All proxies blocked
    logger.warn("All proxies blocked — returning undefined");
    return undefined;
  }

  /** Mark proxy as having returned an error (429/403). Blocks after repeated failures. */
  markBad(proxyUrl: string): void {
    const state = this.states.find((s) => s.url === proxyUrl);
    if (!state) return;

    state.consecutiveErrors++;
    this.stats.errors429++;

    if (state.consecutiveErrors >= this.blockAfterErrors) {
      state.blockedUntil = Date.now() + this.blockDurationMs;
      this.stats.blocked++;
      logger.warn(
        { proxy: redact(state.url), errors: state.consecutiveErrors, blockMinutes: this.blockDurationMs / 60000 },
        "Proxy blocked after consecutive errors",
      );
    }
  }

  /** Mark proxy as successful — resets consecutive error counter */
  markGood(proxyUrl: string): void {
    const state = this.states.find((s) => s.url === proxyUrl);
    if (state) state.consecutiveErrors = 0;
  }

  /** Reset cumulative stats (called by heartbeat) */
  resetStats(): void {
    this.stats = { requests: 0, errors429: 0, blocked: 0 };
  }

  hasProxies(): boolean {
    return this.states.length > 0;
  }

  get size(): number {
    return this.states.length;
  }

  /** Count of currently blocked proxies */
  get blockedCount(): number {
    const now = Date.now();
    return this.states.filter((s) => s.blockedUntil > now).length;
  }
}

function redact(url: string): string {
  return url.replace(/\/\/.*@/, "//<redacted>@");
}

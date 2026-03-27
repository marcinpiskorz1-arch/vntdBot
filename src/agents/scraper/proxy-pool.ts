import { config } from "../../config.js";
import { logger } from "../../logger.js";

type ProxyTier = "datacenter" | "residential";

interface ProxyState {
  url: string;
  tier: ProxyTier;
  requestCount: number;
  consecutiveErrors: number;
  blockedUntil: number;   // Date.now() timestamp — skip until this time
}

export interface ProxyPoolStats {
  dcRequests: number;
  dcErrors: number;
  dcBlocked: number;
  resRequests: number;
  resErrors: number;
  resBlocked: number;
}

/**
 * Two-tier proxy pool: datacenter primary, residential fallback.
 * Residential proxies are only used when ALL datacenter proxies are blocked.
 */
export class ProxyPool {
  private dcStates: ProxyState[];
  private resStates: ProxyState[];
  private dcIndex = 0;
  private resIndex = 0;
  private readonly maxRequestsPerProxy = 200;
  private readonly dcBlockDurationMs = 2 * 60 * 1000; // 2 min for datacenter
  private readonly resBlockDurationMs = 5 * 60 * 1000; // 5 min for residential
  private readonly dcBlockAfterErrors = 1;  // block DC fast — they get 403 easily
  private readonly resBlockAfterErrors = 3; // residential is more reliable

  stats: ProxyPoolStats = {
    dcRequests: 0, dcErrors: 0, dcBlocked: 0,
    resRequests: 0, resErrors: 0, resBlocked: 0,
  };

  constructor() {
    this.dcStates = config.proxyUrls.map((url) => ({
      url, tier: "datacenter" as const, requestCount: 0, consecutiveErrors: 0, blockedUntil: 0,
    }));
    this.resStates = config.residentialProxyUrls.map((url) => ({
      url, tier: "residential" as const, requestCount: 0, consecutiveErrors: 0, blockedUntil: 0,
    }));

    logger.info(
      { datacenter: this.dcStates.length, residential: this.resStates.length },
      "Proxy pool initialized",
    );
    if (this.dcStates.length === 0 && this.resStates.length === 0) {
      logger.warn("No proxies configured — running without proxy rotation");
    }
  }

  /** Get next available proxy URL. Tries datacenter first, falls back to residential. */
  next(): string | undefined {
    return this.nextFromTier(this.dcStates, "dc")
      ?? this.nextFromTier(this.resStates, "res");
  }

  private nextFromTier(states: ProxyState[], prefix: "dc" | "res"): string | undefined {
    if (states.length === 0) return undefined;

    const now = Date.now();
    const indexRef = prefix === "dc" ? "dcIndex" : "resIndex";

    for (let i = 0; i < states.length; i++) {
      const state = states[this[indexRef] % states.length]!;
      this[indexRef]++;

      if (state.blockedUntil > 0 && now >= state.blockedUntil) {
        state.blockedUntil = 0;
        state.consecutiveErrors = 0;
        logger.info({ proxy: redact(state.url), tier: state.tier }, "Proxy unblocked after cooldown");
      }

      if (state.blockedUntil > 0) continue;

      state.requestCount++;
      if (prefix === "dc") this.stats.dcRequests++;
      else this.stats.resRequests++;

      if (state.requestCount >= this.maxRequestsPerProxy) {
        state.requestCount = 0;
      }

      return state.url;
    }

    return undefined;
  }

  /** Mark proxy as having returned an error (429/403). Blocks after repeated failures. */
  markBad(proxyUrl: string): void {
    const state = this.findState(proxyUrl);
    if (!state) return;

    state.consecutiveErrors++;
    if (state.tier === "datacenter") this.stats.dcErrors++;
    else this.stats.resErrors++;

    const threshold = state.tier === "datacenter" ? this.dcBlockAfterErrors : this.resBlockAfterErrors;
    const duration = state.tier === "datacenter" ? this.dcBlockDurationMs : this.resBlockDurationMs;
    if (state.consecutiveErrors >= threshold) {
      state.blockedUntil = Date.now() + duration;
      if (state.tier === "datacenter") this.stats.dcBlocked++;
      else this.stats.resBlocked++;
      logger.warn(
        { proxy: redact(state.url), tier: state.tier, errors: state.consecutiveErrors },
        "Proxy blocked after consecutive errors",
      );
    }
  }

  /** Mark proxy as successful — resets consecutive error counter */
  markGood(proxyUrl: string): void {
    const state = this.findState(proxyUrl);
    if (state) state.consecutiveErrors = 0;
  }

  /** Reset cumulative stats (called by heartbeat) */
  resetStats(): void {
    this.stats = {
      dcRequests: 0, dcErrors: 0, dcBlocked: 0,
      resRequests: 0, resErrors: 0, resBlocked: 0,
    };
  }

  hasProxies(): boolean {
    return this.dcStates.length > 0 || this.resStates.length > 0;
  }

  get size(): number {
    return this.dcStates.length + this.resStates.length;
  }

  get dcSize(): number { return this.dcStates.length; }
  get resSize(): number { return this.resStates.length; }

  get blockedCount(): number {
    const now = Date.now();
    return [...this.dcStates, ...this.resStates].filter((s) => s.blockedUntil > now).length;
  }

  get dcBlockedCount(): number {
    const now = Date.now();
    return this.dcStates.filter((s) => s.blockedUntil > now).length;
  }

  get resBlockedCount(): number {
    const now = Date.now();
    return this.resStates.filter((s) => s.blockedUntil > now).length;
  }

  private findState(proxyUrl: string): ProxyState | undefined {
    return this.dcStates.find((s) => s.url === proxyUrl)
      ?? this.resStates.find((s) => s.url === proxyUrl);
  }
}

function redact(url: string): string {
  return url.replace(/\/\/.*@/, "//<redacted>@");
}

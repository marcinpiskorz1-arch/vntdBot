import { config } from "../../config.js";
import { logger } from "../../logger.js";

/**
 * Round-robin proxy pool with per-proxy request tracking.
 * One session per proxy — don't mix cookies between IPs.
 */
export class ProxyPool {
  private proxies: string[];
  private index = 0;
  private requestCounts = new Map<string, number>();
  private readonly maxRequestsPerProxy = 50;

  constructor() {
    this.proxies = config.proxyUrls;
    if (this.proxies.length === 0) {
      logger.warn("No proxies configured — running without proxy rotation");
    }
  }

  /** Get next proxy URL (round-robin), or undefined if no proxies configured */
  next(): string | undefined {
    if (this.proxies.length === 0) return undefined;

    const proxy = this.proxies[this.index % this.proxies.length]!;
    this.index++;

    const count = (this.requestCounts.get(proxy) || 0) + 1;
    this.requestCounts.set(proxy, count);

    if (count >= this.maxRequestsPerProxy) {
      logger.info({ proxy: proxy.replace(/\/\/.*@/, "//<redacted>@") }, "Proxy reached max requests, rotating");
      this.requestCounts.set(proxy, 0);
    }

    return proxy;
  }

  /** Check if any proxies are available */
  hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  /** How many proxies in the pool */
  get size(): number {
    return this.proxies.length;
  }
}

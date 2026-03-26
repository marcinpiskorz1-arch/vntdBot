import { logger } from "../../logger.js";
import { config } from "../../config.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import type { RawItem, ScanConfig } from "../../types.js";
import { resolveItemType } from "../../item-classifier.js";
import { extractModel } from "../../model-extractor.js";
import { createSession, type VintedSession } from "./session-manager.js";
import { fetchCatalogItems } from "./vinted-api.js";
import { ProxyPool } from "./proxy-pool.js";

/** Random delay between min and max ms */
function jitter(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ScraperAgent {
  private session: VintedSession | null = null;
  readonly proxyPool = new ProxyPool();
  private sessionCreatedAt = 0;
  private readonly sessionMaxAgeMs = 20 * 60 * 1000; // 20 min (local session lives longer)
  private consecutiveErrors = 0;
  private lastAlertTime = 0;
  onAlert?: (message: string) => void;

  /**
   * Ensure we have a valid session, refresh if stale.
   * Sessions created LOCALLY (no proxy) to save bandwidth.
   * Sessions created through proxy when available to avoid exposing home IP.
   */
  private async ensureSession(): Promise<VintedSession> {
    const isStale =
      !this.session ||
      Date.now() - this.sessionCreatedAt > this.sessionMaxAgeMs;

    if (isStale) {
      const proxy = this.proxyPool.next();
      logger.info({ proxy: proxy ? "via proxy" : "local" }, "Refreshing Vinted session via Playwright...");
      this.session = await createSession(proxy);
      this.sessionCreatedAt = Date.now();
    }

    return this.session!;
  }

  /** Expose session for external use (e.g., favorites sold checker) */
  async getSession(): Promise<VintedSession> {
    return this.ensureSession();
  }

  /**
   * Scan a single config: fetch pages, dedup, persist to DB.
   * Each API call goes through a different proxy from the pool.
   */
  private async scanSingleConfig(session: VintedSession, scanConfig: ScanConfig): Promise<RawItem[]> {
    const proxy = this.proxyPool.next();
    try {
      const items = await fetchCatalogItems(session, scanConfig, 1, 96, proxy);

      logger.info(
        { query: scanConfig.searchText || scanConfig.categoryIds, count: items.length },
        "Fetched items from Vinted"
      );

      // Deduplicate: skip items already in DB
      const newItems = items.filter(
        (item) => !stmts.itemExists.get({ vinted_id: item.vintedId })
      );

      // Persist new items to DB
      for (const item of newItems) {
        item.category = resolveItemType(item.title, item.category);
        item.model = item.model || extractModel(item.brand, item.title);

        stmts.insertItem.run({
          vinted_id: item.vintedId,
          title: item.title,
          brand: item.brand,
          model: item.model,
          price: item.price,
          currency: item.currency,
          size: item.size || "",
          category: item.category,
          condition: item.condition,
          description: item.description,
          photo_urls: JSON.stringify(item.photoUrls),
          seller_rating: item.sellerRating,
          seller_transactions: item.sellerTransactions,
          favourite_count: item.favouriteCount,
          view_count: item.viewCount,
          listed_at: item.listedAt,
          url: item.url,
        });
      }

      logger.info(
        { new: newItems.length, total: items.length },
        "New items saved"
      );

      if (proxy) this.proxyPool.markGood(proxy);
      this.consecutiveErrors = 0;
      return newItems;
    } catch (err) {
      logger.error({ err, scanConfig }, "Scan failed for config");
      const msg = err instanceof Error ? err.message : "";
      const is429 = msg.includes("429");
      const is401 = msg.includes("401");
      const is403 = msg.includes("403");

      if (is401) {
        this.session = null; // Cookies expired — refresh session
      }

      if ((is429 || is403) && proxy) {
        this.proxyPool.markBad(proxy); // Proxy blocked — blacklist it
      }

      this.consecutiveErrors++;

      // Alert on Telegram (throttle: max once per 5 min)
      const now = Date.now();
      if ((is429 || is401 || is403) && this.consecutiveErrors >= 3 && now - this.lastAlertTime > 5 * 60 * 1000) {
        this.lastAlertTime = now;
        const code = is429 ? "429 Rate Limited" : is401 ? "401 Unauthorized" : "403 Forbidden";
        const proxyInfo = this.proxyPool.hasProxies()
          ? `\n🔄 Proxy: ${this.proxyPool.size - this.proxyPool.blockedCount}/${this.proxyPool.size} aktywnych`
          : "\n⚠️ Brak proxy — potrzebne PROXY_URLS w .env";
        this.onAlert?.(`🚨 <b>Vinted blokada!</b>\n\nKod: <b>${code}</b>\nKolejnych błędów: ${this.consecutiveErrors}${proxyInfo}`);
      }

      return [];
    }
  }

  /**
   * Scan Vinted for items matching configs.
   * Processes queries in parallel batches.
   * Calls onBatch after each batch so items can be processed immediately.
   */
  async scan(
    scanConfigs: ScanConfig[],
    onBatch?: (items: RawItem[]) => Promise<void>,
  ): Promise<RawItem[]> {
    const allNewItems: RawItem[] = [];
    const concurrency = config.scanConcurrency;

    for (let i = 0; i < scanConfigs.length; i += concurrency) {
      if (settings.paused) {
        logger.info("⏸️ Vinted scan interrupted — bot paused");
        break;
      }

      // Re-check session between batches (may have been invalidated by 401)
      const session = await this.ensureSession();

      const batch = scanConfigs.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(cfg => this.scanSingleConfig(session, cfg))
      );
      const batchItems = results.flat();
      allNewItems.push(...batchItems);

      if (batchItems.length > 0 && onBatch) {
        await onBatch(batchItems);
      }

      // Jitter between batches to avoid 429 rate limits
      if (i + concurrency < scanConfigs.length) {
        await jitter(1500, 3000);
      }
    }

    return allNewItems;
  }
}

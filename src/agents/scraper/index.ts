import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import type { RawItem, ScanConfig } from "../../types.js";
import { resolveItemType } from "../../item-classifier.js";
import { extractModel } from "../../model-extractor.js";
import { createSession, withStickySession, type VintedSession } from "./session-manager.js";
import { fetchCatalogItems } from "./vinted-api.js";
import { ProxyPool } from "./proxy-pool.js";

/** Random delay between min and max ms */
function jitter(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SCAN_CONCURRENCY = 3;

export class ScraperAgent {
  private session: VintedSession | null = null;
  private proxyPool = new ProxyPool();
  private sessionCreatedAt = 0;
  private readonly sessionMaxAgeMs = 10 * 60 * 1000; // 10 min
  private consecutiveErrors = 0;
  private lastAlertTime = 0;
  onAlert?: (message: string) => void;

  /** Ensure we have a valid session, refresh if stale */
  private async ensureSession(): Promise<VintedSession> {
    const isStale =
      !this.session ||
      Date.now() - this.sessionCreatedAt > this.sessionMaxAgeMs;

    if (isStale) {
      logger.info("Refreshing Vinted session via Playwright...");
      const rawProxy = this.proxyPool.next();
      // Sticky session: same IP for entire 10-min session (LunaProxy / Proxy-Seller compatible)
      const proxy = rawProxy ? withStickySession(rawProxy, 10) : undefined;
      this.session = await createSession(proxy);
      this.sessionCreatedAt = Date.now();
    }

    return this.session!;
  }

  /** Expose session for external use (e.g., favorites sold checker) */
  async getSession(): Promise<VintedSession> {
    return this.ensureSession();
  }

  /** Scan a single config: fetch pages, dedup, persist to DB.
   *  TEMP: 1 page for non-priority, 2 pages for priority (bandwidth saving). */
  private async scanSingleConfig(session: VintedSession, scanConfig: ScanConfig): Promise<RawItem[]> {
    try {
      const page1 = await fetchCatalogItems(session, scanConfig, 1);
      const items = [...page1];

      // Priority configs get 1 extra page
      if (scanConfig.priority) {
        await jitter(800, 1500);
        const page2 = await fetchCatalogItems(session, scanConfig, 2);
        const seen = new Set(items.map(i => i.vintedId));
        const unique = page2.filter(i => !seen.has(i.vintedId));
        items.push(...unique);
      }

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
        // Normalize category: title keywords first, Vinted catalog_id fallback
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

      this.consecutiveErrors = 0;
      return newItems;
    } catch (err) {
      logger.error({ err, scanConfig }, "Scan failed for config");
      const msg = err instanceof Error ? err.message : "";
      const is429 = msg.includes("429");
      const is401 = msg.includes("401");
      const is403 = msg.includes("403");

      if (is401 || is429) {
        this.session = null;
      }

      this.consecutiveErrors++;

      // Alert on Telegram (throttle: max once per 5 min)
      const now = Date.now();
      if ((is429 || is401 || is403) && this.consecutiveErrors >= 3 && now - this.lastAlertTime > 5 * 60 * 1000) {
        this.lastAlertTime = now;
        const code = is429 ? "429 Rate Limited" : is401 ? "401 Unauthorized" : "403 Forbidden";
        this.onAlert?.(`🚨 <b>Vinted blokada!</b>\n\nKod: <b>${code}</b>\nKolejnych błędów: ${this.consecutiveErrors}\n\n⚠️ Prawdopodobnie IP zablokowane — potrzebne proxy.`);
      }

      return [];
    }
  }

  /**
   * Scan Vinted for items matching configs.
   * Processes queries in parallel batches (SCAN_CONCURRENCY).
   * Calls onBatch after each batch so items can be processed immediately.
   */
  async scan(
    scanConfigs: ScanConfig[],
    onBatch?: (items: RawItem[]) => Promise<void>,
  ): Promise<RawItem[]> {
    const allNewItems: RawItem[] = [];

    for (let i = 0; i < scanConfigs.length; i += SCAN_CONCURRENCY) {
      if (settings.paused) {
        logger.info("⏸️ Vinted scan interrupted — bot paused");
        break;
      }

      // Re-check session between batches (may have been invalidated by 401)
      const session = await this.ensureSession();

      const batch = scanConfigs.slice(i, i + SCAN_CONCURRENCY);
      const results = await Promise.all(
        batch.map(cfg => this.scanSingleConfig(session, cfg))
      );
      const batchItems = results.flat();
      allNewItems.push(...batchItems);

      if (batchItems.length > 0 && onBatch) {
        await onBatch(batchItems);
      }

      // Jitter between batches to avoid 429 rate limits
      if (i + SCAN_CONCURRENCY < scanConfigs.length) {
        await jitter(2500, 5000);
      }
    }

    return allNewItems;
  }
}

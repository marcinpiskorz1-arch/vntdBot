import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import type { RawItem, ScanConfig } from "../../types.js";
import { classifyItemType } from "../../item-classifier.js";
import { extractModel } from "../../model-extractor.js";
import { createSession, type VintedSession } from "./session-manager.js";
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

  /** Ensure we have a valid session, refresh if stale */
  private async ensureSession(): Promise<VintedSession> {
    const isStale =
      !this.session ||
      Date.now() - this.sessionCreatedAt > this.sessionMaxAgeMs;

    if (isStale) {
      logger.info("Refreshing Vinted session via Playwright...");
      const proxy = this.proxyPool.next();
      this.session = await createSession(proxy);
      this.sessionCreatedAt = Date.now();
    }

    return this.session!;
  }

  /** Expose session for external use (e.g., favorites sold checker) */
  async getSession(): Promise<VintedSession> {
    return this.ensureSession();
  }

  /** Scan a single config: fetch page 1+2, dedup, persist to DB */
  private async scanSingleConfig(session: VintedSession, scanConfig: ScanConfig): Promise<RawItem[]> {
    try {
      const page1 = await fetchCatalogItems(session, scanConfig, 1);
      await jitter(300, 800);
      const page2 = await fetchCatalogItems(session, scanConfig, 2);
      const seen = new Set(page1.map(i => i.vintedId));
      const uniquePage2 = page2.filter(i => !seen.has(i.vintedId));
      const items = [...page1, ...uniquePage2];

      // Priority configs get 1 extra page
      const extraPages = scanConfig.priority ? 1 : 0;
      for (let p = 3; p <= 2 + extraPages; p++) {
        await jitter(300, 800);
        const extra = await fetchCatalogItems(session, scanConfig, p);
        const seenAll = new Set(items.map(i => i.vintedId));
        const unique = extra.filter(i => !seenAll.has(i.vintedId));
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
        stmts.insertItem.run({
          vinted_id: item.vintedId,
          title: item.title,
          brand: item.brand,
          model: item.model || extractModel(item.brand, item.title),
          price: item.price,
          currency: item.currency,
          size: item.size || "",
          category: item.category || classifyItemType(item.title),
          condition: item.condition,
          description: item.description,
          photo_urls: JSON.stringify(item.photoUrls),
          seller_rating: item.sellerRating,
          seller_transactions: item.sellerTransactions,
          listed_at: item.listedAt,
          url: item.url,
        });
      }

      logger.info(
        { new: newItems.length, total: items.length },
        "New items saved"
      );

      return newItems;
    } catch (err) {
      logger.error({ err, scanConfig }, "Scan failed for config");
      if (err instanceof Error && err.message.includes("401")) {
        this.session = null;
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

      // Jitter between batches to avoid detection
      if (i + SCAN_CONCURRENCY < scanConfigs.length) {
        await jitter(1500, 3000);
      }
    }

    return allNewItems;
  }
}

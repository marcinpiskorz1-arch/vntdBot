import { logger } from "../../logger.js";
import { stmts } from "../../database.js";
import type { RawItem, ScanConfig } from "../../types.js";
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

  /**
   * Scan Vinted for items matching the config.
   * Returns only NEW items (not already in DB).
   */
  async scan(scanConfigs: ScanConfig[]): Promise<RawItem[]> {
    const session = await this.ensureSession();
    const allNewItems: RawItem[] = [];

    for (const scanConfig of scanConfigs) {
      try {
        // Fetch page 1 + page 2 for more coverage
        const page1 = await fetchCatalogItems(session, scanConfig, 1);
        await jitter(500, 1500);
        const page2 = await fetchCatalogItems(session, scanConfig, 2);
        const seen = new Set(page1.map(i => i.vintedId));
        const uniquePage2 = page2.filter(i => !seen.has(i.vintedId));
        const items = [...page1, ...uniquePage2];
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
            model: item.model || "",
            price: item.price,
            currency: item.currency,
            size: item.size || "",
            category: item.category,
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

        allNewItems.push(...newItems);

        // Jitter between scan configs to avoid detection
        if (scanConfigs.length > 1) {
          await jitter(2000, 5000);
        }
      } catch (err) {
        logger.error({ err, scanConfig }, "Scan failed for config");
        // On auth error, invalidate session for next attempt
        if (err instanceof Error && err.message.includes("401")) {
          this.session = null;
        }
      }
    }

    return allNewItems;
  }
}

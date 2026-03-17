import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import type { RawItem, ScanConfig } from "../../types.js";
import { classifyItemType } from "../../item-classifier.js";
import { fetchOlxOffers } from "./olx-api.js";

/** Random delay between min and max ms */
function jitter(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const OLX_CONCURRENCY = 2; // OLX rate-limits harder, keep lower than Vinted

export class OlxScraperAgent {
  /** Scan a single OLX config: fetch, dedup, persist to DB */
  private async scanSingleConfig(scanConfig: ScanConfig): Promise<RawItem[]> {
    try {
      const items = await fetchOlxOffers(scanConfig, 0, 40);

      logger.info(
        { query: scanConfig.searchText, count: items.length, source: "OLX" },
        "Fetched items from OLX",
      );

      const newItems = items.filter(
        (item) => !stmts.itemExists.get({ vinted_id: item.vintedId }),
      );

      for (const item of newItems) {
        stmts.insertItem.run({
          vinted_id: item.vintedId,
          title: item.title,
          brand: item.brand,
          model: item.model || "",
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
        { new: newItems.length, total: items.length, source: "OLX" },
        "New OLX items saved",
      );

      return newItems;
    } catch (err) {
      logger.error({ err, scanConfig, source: "OLX" }, "OLX scan failed for config");
      return [];
    }
  }

  /**
   * Scan OLX for items matching configs.
   * Processes queries in parallel batches (OLX_CONCURRENCY).
   * Calls onBatch after each batch so items can be processed immediately.
   */
  async scan(
    scanConfigs: ScanConfig[],
    onBatch?: (items: RawItem[]) => Promise<void>,
  ): Promise<RawItem[]> {
    const allNewItems: RawItem[] = [];

    for (let i = 0; i < scanConfigs.length; i += OLX_CONCURRENCY) {
      if (settings.paused) {
        logger.info("⏸️ OLX scan interrupted — bot paused");
        break;
      }

      const batch = scanConfigs.slice(i, i + OLX_CONCURRENCY);
      const results = await Promise.all(
        batch.map(cfg => this.scanSingleConfig(cfg))
      );
      const batchItems = results.flat();
      allNewItems.push(...batchItems);

      if (batchItems.length > 0 && onBatch) {
        await onBatch(batchItems);
      }

      // Jitter between batches — OLX is more aggressive with rate limiting
      if (i + OLX_CONCURRENCY < scanConfigs.length) {
        await jitter(1500, 3500);
      }
    }

    return allNewItems;
  }
}

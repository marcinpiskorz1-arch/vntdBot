import { logger } from "../../logger.js";
import { stmts } from "../../database.js";
import type { RawItem, ScanConfig } from "../../types.js";
import { fetchOlxOffers } from "./olx-api.js";

/** Random delay between min and max ms */
function jitter(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OlxScraperAgent {
  /**
   * Scan OLX.pl for items matching configs.
   * Returns only NEW items (not already in DB).
   */
  async scan(scanConfigs: ScanConfig[]): Promise<RawItem[]> {
    const allNewItems: RawItem[] = [];

    for (const scanConfig of scanConfigs) {
      try {
        // Fetch page 1 (40 items) — OLX rate-limits harder, so only 1 page
        const items = await fetchOlxOffers(scanConfig, 0, 40);

        logger.info(
          { query: scanConfig.searchText, count: items.length, source: "OLX" },
          "Fetched items from OLX",
        );

        // Deduplicate: skip items already in DB
        const newItems = items.filter(
          (item) => !stmts.itemExists.get({ vinted_id: item.vintedId }),
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
          { new: newItems.length, total: items.length, source: "OLX" },
          "New OLX items saved",
        );

        allNewItems.push(...newItems);

        // Jitter between queries — OLX is more aggressive with rate limiting
        if (scanConfigs.length > 1) {
          await jitter(1000, 3000);
        }
      } catch (err) {
        logger.error({ err, scanConfig, source: "OLX" }, "OLX scan failed for config");
      }
    }

    return allNewItems;
  }
}

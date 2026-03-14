import { db, stmts } from "../../database.js";
import { logger } from "../../logger.js";

interface PriceRow {
  price: number;
}

/** Compute median of a sorted number array */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Compute percentile (e.g. 0.25 for P25) of a sorted number array */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)]!;
}

/**
 * Recalculate median/P25 for a brand+category group and upsert into price_history.
 * Called after new items are inserted by the scraper.
 */
export function updatePriceStats(
  brand: string,
  category: string,
  model = "",
  sizeGroup = ""
): { medianPrice: number; p25Price: number; sampleCount: number } {
  const rows = stmts.getPricesForGroup.all({ brand, category }) as PriceRow[];
  const prices = rows.map((r) => r.price).sort((a, b) => a - b);

  const medianPrice = median(prices);
  const p25Price = percentile(prices, 0.25);

  stmts.upsertPriceHistory.run({
    brand,
    model,
    category,
    size_group: sizeGroup,
    median_price: medianPrice,
    p25_price: p25Price,
    sample_count: prices.length,
  });

  logger.debug(
    { brand, category, median: medianPrice, p25: p25Price, samples: prices.length },
    "Price stats updated"
  );

  return { medianPrice, p25Price, sampleCount: prices.length };
}

/**
 * Get cached price stats from price_history table.
 * Returns null if no data exists for this group.
 */
export function getPriceStats(
  brand: string,
  category: string,
  model = "",
  sizeGroup = ""
): { medianPrice: number; p25Price: number; sampleCount: number } | null {
  const row = stmts.getPriceHistory.get({
    brand,
    model,
    category,
    size_group: sizeGroup,
  }) as { median_price: number; p25_price: number; sample_count: number } | undefined;

  if (!row) return null;

  return {
    medianPrice: row.median_price,
    p25Price: row.p25_price,
    sampleCount: row.sample_count,
  };
}

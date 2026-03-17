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

/** Remove IQR outliers — keeps prices within Q1-1.5*IQR .. Q3+1.5*IQR */
function removeOutliers(sorted: number[]): number[] {
  if (sorted.length < 4) return sorted; // need at least 4 for meaningful IQR
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return sorted; // all same price, nothing to filter
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((p) => p >= lo && p <= hi);
}

/** Normalize size string into a group for price comparison */
export function normalizeSizeGroup(size: string | undefined): string {
  if (!size) return "";
  const s = size.trim().toUpperCase();

  // Shoe sizes: "42", "42 EU", "42.5", "US 10" → keep numeric part
  const shoeMatch = s.match(/(\d{2,3}(?:[.,]\d)?)/);
  if (shoeMatch) {
    // Round to whole number for grouping: 42.5 → 42
    return String(Math.floor(parseFloat(shoeMatch[1]!.replace(",", "."))));
  }

  // Clothing sizes: normalize to standard
  if (/\bXXS\b/.test(s)) return "XXS";
  if (/\bXS\b/.test(s)) return "XS";
  if (/\bXXL\b/.test(s) || /\b2XL\b/.test(s)) return "XXL";
  if (/\bXL\b/.test(s)) return "XL";
  if (/\bS\b/.test(s)) return "S";
  if (/\bM\b/.test(s)) return "M";
  if (/\bL\b/.test(s)) return "L";

  return s; // fallback: keep as-is
}

const MIN_SAMPLES_FOR_SIZE = 5;
const MIN_SAMPLES_FOR_MODEL = 10;

/**
 * Query item prices with a fallback cascade:
 *   1. model + size (if both provided)
 *   2. model only (if model provided)
 *   3. brand + category + size (if size provided)
 *   4. brand + category (final fallback)
 *
 * Returns the prices and which level matched.
 */
function queryPricesWithFallback(
  brand: string,
  category: string,
  model: string,
  sizeGroup: string,
): { rows: PriceRow[]; usedModel: string; usedSizeGroup: string } {
  // 1. model + size
  if (model && sizeGroup) {
    const rows = stmts.getPricesForModelWithSize.all({ brand, model, category, size: sizeGroup }) as PriceRow[];
    if (rows.length >= MIN_SAMPLES_FOR_MODEL) {
      return { rows, usedModel: model, usedSizeGroup: sizeGroup };
    }
  }

  // 2. model only (no size filter)
  if (model) {
    const rows = stmts.getPricesForModel.all({ brand, model, category }) as PriceRow[];
    if (rows.length >= MIN_SAMPLES_FOR_MODEL) {
      return { rows, usedModel: model, usedSizeGroup: "" };
    }
  }

  // 3. brand + category + size
  if (sizeGroup) {
    const rows = stmts.getPricesForGroupWithSize.all({ brand, category, size: sizeGroup }) as PriceRow[];
    if (rows.length >= MIN_SAMPLES_FOR_SIZE) {
      return { rows, usedModel: "", usedSizeGroup: sizeGroup };
    }
  }

  // 4. brand + category (final fallback)
  const rows = stmts.getPricesForGroup.all({ brand, category }) as PriceRow[];
  return { rows, usedModel: "", usedSizeGroup: "" };
}

/**
 * Recalculate median/P25 for a brand+model+category+size group.
 * Uses 14-day window + IQR outlier removal.
 * Falls back through model → size → brand+category cascade.
 */
export function updatePriceStats(
  brand: string,
  category: string,
  model = "",
  sizeGroup = ""
): { medianPrice: number; p25Price: number; sampleCount: number } {
  const { rows, usedModel, usedSizeGroup } = queryPricesWithFallback(brand, category, model, sizeGroup);

  const sorted = rows.map((r) => r.price).sort((a, b) => a - b);
  const cleaned = removeOutliers(sorted);

  const medianPrice = median(cleaned);
  const p25Price = percentile(cleaned, 0.25);

  stmts.upsertPriceHistory.run({
    brand,
    model: usedModel,
    category,
    size_group: usedSizeGroup,
    median_price: medianPrice,
    p25_price: p25Price,
    sample_count: cleaned.length,
  });

  logger.debug(
    {
      brand, model: usedModel, category, sizeGroup: usedSizeGroup,
      median: medianPrice, p25: p25Price,
      raw: sorted.length, cleaned: cleaned.length,
    },
    "Price stats updated"
  );

  return { medianPrice, p25Price, sampleCount: cleaned.length };
}

/**
 * Get cached price stats from price_history table.
 * Falls back through model → size → brand+category cascade.
 */
export function getPriceStats(
  brand: string,
  category: string,
  model = "",
  sizeGroup = ""
): { medianPrice: number; p25Price: number; sampleCount: number } | null {
  type PriceHistoryRow = { median_price: number; p25_price: number; sample_count: number } | undefined;

  // 1. model + size
  if (model && sizeGroup) {
    const row = stmts.getPriceHistory.get({
      brand, model, category, size_group: sizeGroup,
    }) as PriceHistoryRow;
    if (row && row.sample_count >= MIN_SAMPLES_FOR_MODEL) {
      return { medianPrice: row.median_price, p25Price: row.p25_price, sampleCount: row.sample_count };
    }
  }

  // 2. model only
  if (model) {
    const row = stmts.getPriceHistory.get({
      brand, model, category, size_group: "",
    }) as PriceHistoryRow;
    if (row && row.sample_count >= MIN_SAMPLES_FOR_MODEL) {
      return { medianPrice: row.median_price, p25Price: row.p25_price, sampleCount: row.sample_count };
    }
  }

  // 3. brand + category + size (no model)
  if (sizeGroup) {
    const row = stmts.getPriceHistory.get({
      brand, model: "", category, size_group: sizeGroup,
    }) as PriceHistoryRow;
    if (row && row.sample_count >= MIN_SAMPLES_FOR_SIZE) {
      return { medianPrice: row.median_price, p25Price: row.p25_price, sampleCount: row.sample_count };
    }
  }

  // 4. brand + category (final fallback)
  const row = stmts.getPriceHistory.get({
    brand, model: "", category, size_group: "",
  }) as PriceHistoryRow;

  if (!row) return null;
  return { medianPrice: row.median_price, p25Price: row.p25_price, sampleCount: row.sample_count };
}

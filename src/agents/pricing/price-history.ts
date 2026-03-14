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

/**
 * Recalculate median/P25 for a brand+category+size group.
 * Uses 14-day window + IQR outlier removal.
 * Falls back to brand+category if size-specific data is too sparse.
 */
export function updatePriceStats(
  brand: string,
  category: string,
  model = "",
  sizeGroup = ""
): { medianPrice: number; p25Price: number; sampleCount: number } {
  let rows: PriceRow[];
  let usedSizeGroup = sizeGroup;

  // Try size-specific first
  if (sizeGroup) {
    rows = stmts.getPricesForGroupWithSize.all({ brand, category, size: sizeGroup }) as PriceRow[];
    if (rows.length < MIN_SAMPLES_FOR_SIZE) {
      // Fallback to brand+category (no size filter)
      rows = stmts.getPricesForGroup.all({ brand, category }) as PriceRow[];
      usedSizeGroup = "";
    }
  } else {
    rows = stmts.getPricesForGroup.all({ brand, category }) as PriceRow[];
  }

  const sorted = rows.map((r) => r.price).sort((a, b) => a - b);

  // Remove outliers before computing stats
  const cleaned = removeOutliers(sorted);

  const medianPrice = median(cleaned);
  const p25Price = percentile(cleaned, 0.25);

  stmts.upsertPriceHistory.run({
    brand,
    model,
    category,
    size_group: usedSizeGroup,
    median_price: medianPrice,
    p25_price: p25Price,
    sample_count: cleaned.length,
  });

  logger.debug(
    {
      brand, category, sizeGroup: usedSizeGroup,
      median: medianPrice, p25: p25Price,
      raw: sorted.length, cleaned: cleaned.length,
    },
    "Price stats updated"
  );

  return { medianPrice, p25Price, sampleCount: cleaned.length };
}

/**
 * Get cached price stats from price_history table.
 * Tries size-specific first, falls back to brand+category.
 */
export function getPriceStats(
  brand: string,
  category: string,
  model = "",
  sizeGroup = ""
): { medianPrice: number; p25Price: number; sampleCount: number } | null {
  // Try size-specific first
  if (sizeGroup) {
    const row = stmts.getPriceHistory.get({
      brand, model, category, size_group: sizeGroup,
    }) as { median_price: number; p25_price: number; sample_count: number } | undefined;

    if (row && row.sample_count >= MIN_SAMPLES_FOR_SIZE) {
      return {
        medianPrice: row.median_price,
        p25Price: row.p25_price,
        sampleCount: row.sample_count,
      };
    }
  }

  // Fallback: brand+category without size
  const row = stmts.getPriceHistory.get({
    brand, model, category, size_group: "",
  }) as { median_price: number; p25_price: number; sample_count: number } | undefined;

  if (!row) return null;

  return {
    medianPrice: row.median_price,
    p25Price: row.p25_price,
    sampleCount: row.sample_count,
  };
}

import { config } from "../../config.js";
import { logger } from "../../logger.js";
import type { RawItem, PriceSignal } from "../../types.js";
import { classifyItemType } from "../../item-classifier.js";
import { extractModel } from "../../model-extractor.js";
import { updatePriceStats, getPriceStats, normalizeSizeGroup } from "./price-history.js";

const LOW_SAMPLE_THRESHOLD = 10;

export class PricingAgent {
  /**
   * Evaluate a single item against market prices.
   * Returns PriceSignal with discount info and confidence.
   */
  evaluate(item: RawItem): PriceSignal {
    const sizeGroup = normalizeSizeGroup(item.size);
    // Use item type from classifier when Vinted/OLX category is empty or numeric
    const itemType = item.category || classifyItemType(item.title);
    const model = item.model || extractModel(item.brand, item.title);

    // First, update stats with this item's price (size-aware, 14-day, IQR-cleaned)
    updatePriceStats(item.brand, itemType, model, sizeGroup);

    // Then get the (now updated) stats
    const stats = getPriceStats(item.brand, itemType, model, sizeGroup);

    if (!stats || stats.sampleCount < 3) {
      // Not enough data — need at least 3 samples for meaningful P25
      return {
        discountPct: 0,
        isUnderpriced: false,
        confidence: 0,
        sampleSize: stats?.sampleCount ?? 0,
        medianPrice: 0,
        p25Price: 0,
        priceDiscountScore: 0,
      };
    }

    // Use median as reference — P25 was too conservative, missing real deals
    const referencePrice = stats.medianPrice;

    // Discount calculation
    const discountPct =
      referencePrice > 0
        ? ((1 - item.price / referencePrice) * 100)
        : 0;

    const isUnderpriced = discountPct >= (1 - config.dealThreshold) * 100;

    // Confidence: 0-1, based on sample size (saturates at ~50 samples)
    const confidence = Math.min(1, stats.sampleCount / 50);

    // Price discount score: 0-10, capped
    // 0% discount = 0, 100% discount = 10
    const priceDiscountScore = Math.max(0, Math.min(10, discountPct / 10));

    logger.debug(
      {
        item: item.vintedId,
        price: item.price,
        median: stats.medianPrice,
        p25: stats.p25Price,
        refPrice: referencePrice,
        discount: discountPct.toFixed(1),
        underpriced: isUnderpriced,
        confidence: confidence.toFixed(2),
      },
      "Price signal computed"
    );

    return {
      discountPct: Math.round(discountPct * 10) / 10,
      isUnderpriced,
      confidence: Math.round(confidence * 100) / 100,
      sampleSize: stats.sampleCount,
      medianPrice: stats.medianPrice,
      p25Price: stats.p25Price,
      priceDiscountScore: Math.round(priceDiscountScore * 10) / 10,
    };
  }

  /**
   * Evaluate multiple items at once.
   * Returns array of [item, signal] tuples.
   */
  evaluateAll(items: RawItem[]): Array<[RawItem, PriceSignal]> {
    return items.map((item) => [item, this.evaluate(item)]);
  }
}

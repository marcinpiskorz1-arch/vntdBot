import Database from "better-sqlite3";
import { classifyItemType, isBrandTypeWorthNotifying } from "../src/item-classifier.js";
import { extractModel } from "../src/model-extractor.js";
import { normalizeSizeGroup } from "../src/agents/pricing/price-history.js";

const db = new Database("data/vintedbot.db");

const IDS = ["8416492265", "8409901980", "8416542632"];

interface ItemRow {
  id: number; vinted_id: string; title: string; brand: string; model: string;
  price: number; currency: string; size: string; category: string; condition: string;
  description: string; photo_urls: string; seller_rating: number; seller_transactions: number;
  listed_at: string; url: string; discovered_at: string;
}
interface PriceRow { price: number; }
interface DecRow { id: number; item_id: number; vinted_id: string; score: number; level: string; ai_reasoning: string; risk_flags: string; notified: number; user_action: string; created_at: string; }
interface PhRow { median_price: number; p25_price: number; sample_count: number; }

const getPricesWithSize = db.prepare(
  `SELECT price FROM items WHERE brand = @brand AND category = @category AND size = @size AND discovered_at >= datetime('now', '-14 days')`
);
const getPricesNoSize = db.prepare(
  `SELECT price FROM items WHERE brand = @brand AND category = @category AND discovered_at >= datetime('now', '-14 days')`
);
const getDecision = db.prepare(`SELECT * FROM decisions WHERE vinted_id = @vinted_id`);
const getPH = db.prepare(
  `SELECT median_price, p25_price, sample_count FROM price_history WHERE brand = @brand AND model = @model AND category = @category AND size_group = @size_group`
);

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, index)]!;
}
function removeOutliers(sorted: number[]): number[] {
  if (sorted.length < 4) return sorted;
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return sorted;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((p) => p >= lo && p <= hi);
}

for (const vintedId of IDS) {
  const item = db.prepare("SELECT * FROM items WHERE vinted_id = @id").get({ id: vintedId }) as ItemRow | undefined;
  if (!item) {
    console.log(`\n${"=".repeat(60)}\n${vintedId}: NOT IN DATABASE\n`);
    continue;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`ITEM: ${item.title} (${item.vinted_id})`);
  console.log(`  Brand: ${item.brand} | Price: ${item.price} ${item.currency} | Size: ${item.size} | Category: ${item.category}`);
  console.log(`  Condition: ${item.condition} | Discovered: ${item.discovered_at}`);

  // Classification
  const itemType = classifyItemType(item.title);
  const model = item.model || extractModel(item.brand, item.title);
  const sizeGroup = normalizeSizeGroup(item.size);
  console.log(`  classifyItemType: "${itemType}" | model: "${model}" | sizeGroup: "${sizeGroup}"`);

  // Brand+type gate
  const worthNotifying = isBrandTypeWorthNotifying(item.brand, itemType);
  console.log(`  isBrandTypeWorthNotifying("${item.brand}", "${itemType}"): ${worthNotifying}`);

  // Pricing simulation — try size-specific first
  let rows: PriceRow[];
  let usedSize = sizeGroup;
  if (sizeGroup) {
    rows = getPricesWithSize.all({ brand: item.brand, category: item.category, size: sizeGroup }) as PriceRow[];
    if (rows.length < 5) {
      console.log(`  Size-specific samples (${rows.length}) < 5, falling back to no-size`);
      rows = getPricesNoSize.all({ brand: item.brand, category: item.category }) as PriceRow[];
      usedSize = "";
    }
  } else {
    rows = getPricesNoSize.all({ brand: item.brand, category: item.category }) as PriceRow[];
  }
  const sorted = rows.map(r => r.price).sort((a, b) => a - b);
  const cleaned = removeOutliers(sorted);
  const medianPrice = median(cleaned);
  const p25Price = percentile(cleaned, 0.25);

  console.log(`\n  PRICING (brand="${item.brand}", cat="${item.category}", size="${usedSize}"):`);
  console.log(`    Raw samples: ${sorted.length} | After IQR: ${cleaned.length}`);
  console.log(`    Median: ${medianPrice} PLN | P25: ${p25Price} PLN`);
  console.log(`    Item price: ${item.price} PLN`);

  const referencePrice = medianPrice;
  const discountPct = referencePrice > 0 ? ((1 - item.price / referencePrice) * 100) : 0;
  const dealThreshold = 0.35;
  const isUnderpriced = discountPct >= (1 - dealThreshold) * 100;
  // (1 - 0.35) * 100 = 65  =>  needs 65% discount!

  // Wait, let me re-read: isUnderpriced = discountPct >= (1 - dealThreshold) * 100
  // dealThreshold = 0.35 → (1-0.35)*100 = 65 → need 65% discount? That seems extremely high
  // Actually re-check: config says 0.35, and the formula is discountPct >= (1 - 0.35) * 100 = 65%
  // That can't be right... Let me check again
  
  console.log(`    Discount: ${discountPct.toFixed(1)}%`);
  console.log(`    dealThreshold: ${dealThreshold} → isUnderpriced threshold: ${(1-dealThreshold)*100}%`);
  console.log(`    isUnderpriced: ${isUnderpriced}`);

  // Also check cached price_history
  const ph = getPH.get({ brand: item.brand, model, category: item.category, size_group: usedSize }) as PhRow | undefined;
  if (ph) {
    console.log(`\n  CACHED price_history: median=${ph.median_price}, p25=${ph.p25_price}, samples=${ph.sample_count}`);
    const cachedDiscount = ph.median_price > 0 ? ((1 - item.price / ph.median_price) * 100) : 0;
    console.log(`    Cached discount: ${cachedDiscount.toFixed(1)}%`);
  } else {
    console.log(`\n  NO cached price_history for (brand="${item.brand}", model="${model}", cat="${item.category}", size="${usedSize}")`);
  }

  // Check decision
  const dec = getDecision.get({ vinted_id: vintedId }) as DecRow | undefined;
  if (dec) {
    console.log(`\n  DECISION: score=${dec.score}, level="${dec.level}", notified=${dec.notified}`);
    console.log(`    reasoning: ${dec.ai_reasoning?.slice(0, 200)}`);
  } else {
    console.log(`\n  NO DECISION RECORD`);
    if (!worthNotifying) {
      console.log(`    → Reason: isBrandTypeWorthNotifying returned false`);
    } else if (!isUnderpriced) {
      console.log(`    → Reason: Item not underpriced (discount ${discountPct.toFixed(1)}% < threshold ${(1-dealThreshold)*100}%)`);
    } else {
      console.log(`    → Reason: UNKNOWN — should have been scored`);
    }
  }

  // Price distribution info
  if (cleaned.length > 0) {
    console.log(`\n  Price distribution (cleaned): min=${cleaned[0]}, max=${cleaned[cleaned.length-1]}, count=${cleaned.length}`);
    const buckets = [0, 30, 50, 75, 100, 150, 200, 300, 500, 1000, Infinity];
    const hist: string[] = [];
    for (let i = 0; i < buckets.length - 1; i++) {
      const count = cleaned.filter(p => p >= buckets[i]! && p < buckets[i+1]!).length;
      if (count > 0) hist.push(`${buckets[i]}-${buckets[i+1] === Infinity ? "+" : buckets[i+1]}: ${count}`);
    }
    console.log(`    Histogram: ${hist.join(" | ")}`);
  }
}

db.close();

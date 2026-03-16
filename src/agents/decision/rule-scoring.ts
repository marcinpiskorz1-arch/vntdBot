import type { RawItem, PriceSignal, AiAnalysis } from "../../types.js";

// ============================================================
// Brand tiers — derived from scan-configs.ts search targets
// ============================================================

const PREMIUM_BRANDS = new Set([
  "nike", "jordan", "adidas", "new balance", "the north face", "patagonia",
  "arc'teryx", "arcteryx", "salomon", "apple", "sony", "nintendo", "lego",
  "ray-ban", "seiko", "supreme",
  "gucci", "prada", "yeezy",
]);

const MID_BRANDS = new Set([
  "under armour", "asics", "vans", "puma", "reebok", "converse", "columbia",
  "jbl", "garmin", "samsung", "kindle", "mammut", "salewa", "la sportiva",
  "carhartt", "helly hansen", "fjallraven", "timberland", "dr. martens",
  "petzl", "nalgene", "osprey", "deuter", "jack wolfskin", "merrell",
  "brooks", "hoka", "on running", "saucony",
]);

// ============================================================
// Condition mapping
// ============================================================

const CONDITION_MAP: Record<string, number> = {
  // Polish (Vinted PL)
  "nowy z metką": 9, "nowy z metkami": 9,
  "nowy bez metki": 8, "nowy bez metek": 8,
  "bardzo dobry": 7,
  "dobry": 5,
  "zadowalający": 3,
  // English
  "new_with_tags": 9, "new with tags": 9,
  "new_no_tags": 8, "new without tags": 8, "new no tags": 8,
  "very_good": 7, "very good": 7,
  "good": 5,
  "satisfactory": 3, "acceptable": 3,
  // Vinted API status codes
  "1": 9, // new with tags
  "2": 8, // new without tags
  "3": 7, // very good
  "4": 5, // good
  "5": 3, // satisfactory
  // OLX
  "nowy": 9, "nowe": 9,
  "używane": 5, "używany": 5,
};

// ============================================================
// Size popularity — popular sizes sell faster
// ============================================================

const POPULAR_SHOE_SIZES = new Set(["41", "42", "43", "44", "45"]);
const AVERAGE_SHOE_SIZES = new Set(["39", "40", "46"]);
const POPULAR_CLOTHING = new Set(["M", "L", "XL"]);
const AVERAGE_CLOTHING = new Set(["S", "XXL"]);

// ============================================================
// Pure scoring functions
// ============================================================

/** Get brand tier score (0-10) */
export function getBrandTier(brand: string): { score: number; tier: string } {
  const b = brand.toLowerCase().trim();
  if (!b) return { score: 2, tier: "unknown" };
  if (PREMIUM_BRANDS.has(b)) return { score: 8, tier: "premium" };
  if (MID_BRANDS.has(b)) return { score: 5, tier: "mid" };
  // Check partial matches for multi-word brands (only b.includes(p), not reverse)
  for (const p of PREMIUM_BRANDS) {
    if (b.includes(p)) return { score: 8, tier: "premium" };
  }
  for (const m of MID_BRANDS) {
    if (b.includes(m)) return { score: 5, tier: "mid" };
  }
  return { score: 2, tier: "budget" };
}

/** Get condition score (0-10) from condition string */
export function getConditionScore(condition: string): { score: number; label: string } {
  const c = condition.toLowerCase().trim();
  if (!c) return { score: 4, label: "nieznany" };
  // Exact match
  if (CONDITION_MAP[c] !== undefined) {
    return { score: CONDITION_MAP[c], label: condition };
  }
  // Partial match
  for (const [key, score] of Object.entries(CONDITION_MAP)) {
    if (c.includes(key)) return { score, label: condition };
  }
  return { score: 4, label: condition };
}

/** Get size popularity bonus (+0 to +0.3 after scaling) */
export function getSizeBonus(size: string | undefined): number {
  if (!size) return 0;
  const s = size.trim().toUpperCase();

  // Shoe sizes — extract numeric part
  const shoeMatch = s.match(/(\d{2,3})/);
  if (shoeMatch) {
    const num = shoeMatch[1]!;
    if (POPULAR_SHOE_SIZES.has(num)) return 1.0;
    if (AVERAGE_SHOE_SIZES.has(num)) return 0.5;
    return 0;
  }

  // Clothing sizes
  if (POPULAR_CLOTHING.has(s)) return 1.0;
  if (AVERAGE_CLOTHING.has(s)) return 0.5;
  return 0;
}

/** Get seller trust bonus (+0 to +0.25 after scaling) */
export function getSellerBonus(sellerRating: number, sellerTransactions: number): number {
  if (sellerRating >= 4.5 && sellerTransactions >= 20) return 0.5;
  if (sellerRating >= 4.0 && sellerTransactions >= 10) return 0.3;
  return 0;
}

/** Calculate estimated profit from pure price data (no AI needed) */
export function calculateProfit(itemPrice: number, referencePrice: number): number {
  if (referencePrice <= 0) return 0;
  const shippingCost = 15;
  const vintedFee = referencePrice * 0.05;
  return Math.round(referencePrice - itemPrice - shippingCost - vintedFee);
}

// ============================================================
// Main rule-based scoring
// ============================================================

const SHIPPING_KEYWORDS = /(?:^|\b)(wysyłk[aę]|paczkomat|inpost|orlen paczk|dpd|poczt[aą]|kurier)/i;
const PICKUP_KEYWORDS = /(?:^|\b)(tylko odbio|odbi[oó]r osobi|nie wysy[łl]am)/i;

export interface RuleScoreConfig {
  lowSamplePenalty: number;
  notifyThreshold: number;
  hotThreshold: number;
  hotMinProfit: number;
  minProfitToNotify: number;
}

export interface RuleScoreResult {
  score: number;
  level: "ignore" | "notify" | "hot";
  reasons: string[];
  syntheticAi: AiAnalysis;
}

/**
 * Pure rule-based scoring — no AI, no API calls.
 * Produces a score + synthetic AiAnalysis for compatibility with Decision/Telegram.
 */
export function computeRuleScore(
  item: RawItem,
  pricing: PriceSignal,
  cfg: RuleScoreConfig,
): RuleScoreResult {
  const reasons: string[] = [];

  // Components
  const brand = getBrandTier(item.brand);
  const condition = getConditionScore(item.condition);
  const sizeBonus = getSizeBonus(item.size);
  const sellerBonus = getSellerBonus(item.sellerRating, item.sellerTransactions);
  const profit = calculateProfit(item.price, pricing.medianPrice);

  // Weighted score: 60% price + 15% brand + 15% condition + small bonuses
  let score =
    0.60 * pricing.priceDiscountScore +
    0.15 * brand.score +
    0.15 * condition.score +
    sizeBonus * 0.3 +
    sellerBonus * 0.5;

  // Low sample penalty
  if (pricing.sampleSize < 10) {
    score *= cfg.lowSamplePenalty;
    reasons.push(`⚠️ Mała baza danych (${pricing.sampleSize} próbek) — score × ${cfg.lowSamplePenalty}`);
  }

  // Shipping bonus / pickup penalty
  const itemText = `${item.title} ${item.description}`.toLowerCase();
  if (SHIPPING_KEYWORDS.test(itemText)) {
    score += 0.3;
    reasons.push("📦 Wysyłka dostępna (+0.3)");
  }
  if (PICKUP_KEYWORDS.test(itemText)) {
    score -= 0.5;
    reasons.push("🚫 Tylko odbiór osobisty (-0.5)");
  }

  // Explainability
  if (pricing.discountPct > 0) {
    reasons.push(
      `💰 ${pricing.discountPct.toFixed(0)}% poniżej rynku (P25: ${pricing.p25Price} PLN)`
    );
  }
  if (brand.score >= 7) reasons.push(`🏷️ Marka ${brand.tier} (${brand.score}/10)`);
  if (condition.score >= 7) reasons.push(`✅ Stan: ${condition.label} (${condition.score}/10)`);
  if (sizeBonus > 0) reasons.push(`📏 Popularny rozmiar (+${sizeBonus})`);
  if (sellerBonus > 0) reasons.push(`👤 Zaufany sprzedawca (+${sellerBonus})`);
  if (profit > 0) reasons.push(`💵 Szacowany zysk: ~${profit} PLN`);

  // Clamp to 0-10 before level determination
  score = Math.round(Math.max(0, Math.min(10, score)) * 10) / 10;

  // Determine level
  let level: RuleScoreResult["level"] = "ignore";
  if (score >= cfg.hotThreshold && profit >= cfg.hotMinProfit) {
    level = "hot";
    reasons.unshift("🔥 HOT DEAL — wysoki score + duży zysk");
  } else if (score >= cfg.notifyThreshold && profit >= cfg.minProfitToNotify) {
    level = "notify";
  } else if (score >= cfg.notifyThreshold && profit < cfg.minProfitToNotify) {
    reasons.push(`⛔ Zysk za mały (${profit} PLN < ${cfg.minProfitToNotify} PLN)`);
  }

  // Build synthetic AiAnalysis for Decision/Telegram compatibility
  const syntheticAi: AiAnalysis = {
    resalePotential: brand.score,
    conditionConfidence: condition.score,
    brandLiquidity: brand.score,
    estimatedProfit: profit,
    suggestedPrice: pricing.medianPrice > 0 ? Math.round(pricing.medianPrice * 0.90) : item.price,
    riskFlags: [],
    reasoning: `Ocena automatyczna: ${item.brand || "?"} (${brand.tier}), stan: ${condition.label}, rozmiar: ${item.size || "?"}`,
  };

  return { score, level, reasons, syntheticAi };
}

// ============================================================
// Photo verification detection — vague titles need AI with vision
// ============================================================

const PHOTO_VERIFY_MIN_SCORE = 6.0;
const MAX_TITLE_WORDS = 3;

/**
 * Items that scored well but have vague/short titles need AI photo verification.
 * Only triggers for items ≥ 6 (notify threshold) with < 3 words in the title.
 * This keeps AI calls very rare but catches junk with generic titles like "Nike", "Jordan buty".
 */
export function needsPhotoVerification(title: string, score: number): boolean {
  if (score < PHOTO_VERIFY_MIN_SCORE) return false;
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  return wordCount < MAX_TITLE_WORDS;
}

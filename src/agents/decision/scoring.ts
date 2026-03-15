import type { RawItem, PriceSignal, AiAnalysis } from "../../types.js";

const SHIPPING_KEYWORDS = /(?:^|\b)(wysyłk[aę]|paczkomat|inpost|orlen paczk|dpd|poczt[aą]|kurier)/i;
const PICKUP_KEYWORDS = /(?:^|\b)(tylko odbio|odbi[oó]r osobi|nie wysy[łl]am)/i;

export interface ScoreWeights {
  priceDiscount: number;
  resalePotential: number;
  conditionConfidence: number;
  brandLiquidity: number;
}

export interface ScoreConfig {
  weights: ScoreWeights;
  lowSamplePenalty: number;
  notifyThreshold: number;
  hotThreshold: number;
  hotMinProfit: number;
  minProfitToNotify: number;
}

export interface ScoreResult {
  score: number;
  level: "ignore" | "notify" | "hot";
  reasons: string[];
}

/** Pure scoring function — no DB, no config imports. Fully testable. */
export function computeScore(
  item: RawItem,
  pricing: PriceSignal,
  ai: AiAnalysis,
  cfg: ScoreConfig,
): ScoreResult {
  const { weights, lowSamplePenalty } = cfg;
  const reasons: string[] = [];

  // 4-component weighted score
  let score =
    weights.priceDiscount * pricing.priceDiscountScore +
    weights.resalePotential * ai.resalePotential +
    weights.conditionConfidence * ai.conditionConfidence +
    weights.brandLiquidity * ai.brandLiquidity;

  // Low sample penalty
  if (pricing.sampleSize < 10) {
    score *= lowSamplePenalty;
    reasons.push(
      `⚠️ Mała baza danych (${pricing.sampleSize} próbek) — score × ${lowSamplePenalty}`
    );
  }

  // Risk flag penalty: -0.3 per flag (excluding missing_details and inflated_median)
  const penaltyFlags = ai.riskFlags.filter(f => f !== "missing_details" && f !== "inflated_median");
  if (penaltyFlags.length > 0) {
    const penalty = penaltyFlags.length * 0.3;
    score = Math.max(0, score - penalty);
    reasons.push(`🚩 ${penaltyFlags.length} flag ryzyka: ${penaltyFlags.join(", ")}`);
  }

  // Inflated median penalty
  if (ai.riskFlags.includes("inflated_median")) {
    score *= 0.6;
    reasons.push("⚠️ Mediana zawyżona vs cena detaliczna (score ×0.6)");
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

  // Explainability reasons
  if (pricing.discountPct > 0) {
    reasons.push(
      `💰 ${pricing.discountPct.toFixed(0)}% poniżej ${pricing.sampleSize < 10 ? "P25" : "mediany"} (${pricing.medianPrice} PLN)`
    );
  }
  if (ai.resalePotential >= 7) reasons.push(`📈 Wysoki potencjał odsprzedaży (${ai.resalePotential}/10)`);
  if (ai.conditionConfidence >= 7) reasons.push(`✅ Dobry stan potwierdzon (${ai.conditionConfidence}/10)`);
  if (ai.brandLiquidity >= 7) reasons.push(`🏷️ Marka sprzedaje się szybko (${ai.brandLiquidity}/10)`);
  if (ai.estimatedProfit > 0) reasons.push(`💵 Szacowany zysk: ~${ai.estimatedProfit} PLN`);

  // Determine level
  let level: ScoreResult["level"] = "ignore";
  if (score >= cfg.hotThreshold && ai.estimatedProfit >= cfg.hotMinProfit) {
    level = "hot";
    reasons.unshift("🔥 HOT DEAL — wysoki score + duży zysk");
  } else if (score >= cfg.notifyThreshold && ai.estimatedProfit >= cfg.minProfitToNotify) {
    level = "notify";
  } else if (score >= cfg.notifyThreshold && ai.estimatedProfit < cfg.minProfitToNotify) {
    reasons.push(`⛔ Zysk za mały (${ai.estimatedProfit} PLN < ${cfg.minProfitToNotify} PLN)`);
  }

  // Clamp
  score = Math.round(Math.max(0, Math.min(10, score)) * 10) / 10;

  return { score, level, reasons };
}

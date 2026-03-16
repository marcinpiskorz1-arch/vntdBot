import { describe, it, expect } from "vitest";
import { mockItem, mockSignal } from "./helpers.js";
import { mockAi } from "./helpers.js";
import {
  getBrandTier,
  getConditionScore,
  getSizeBonus,
  getSellerBonus,
  calculateProfit,
  computeRuleScore,
  needsPhotoVerification,
  type RuleScoreConfig,
  type RuleScoreResult,
} from "../src/agents/decision/rule-scoring.js";

// ============================================================
// Brand tier
// ============================================================
describe("getBrandTier", () => {
  it("returns premium for Nike", () => {
    expect(getBrandTier("Nike")).toEqual({ score: 8, tier: "premium" });
  });
  it("returns premium for jordan (case-insensitive)", () => {
    expect(getBrandTier("JORDAN")).toEqual({ score: 8, tier: "premium" });
  });
  it("returns mid for Under Armour", () => {
    expect(getBrandTier("Under Armour")).toEqual({ score: 5, tier: "mid" });
  });
  it("returns mid for JBL", () => {
    expect(getBrandTier("JBL")).toEqual({ score: 5, tier: "mid" });
  });
  it("returns budget for unknown brand", () => {
    expect(getBrandTier("XYZ NoName")).toEqual({ score: 2, tier: "budget" });
  });
  it("returns unknown for empty string", () => {
    expect(getBrandTier("")).toEqual({ score: 2, tier: "unknown" });
  });
  it("handles partial match: 'The North Face'", () => {
    expect(getBrandTier("The North Face")).toEqual({ score: 8, tier: "premium" });
  });
});

// ============================================================
// Condition mapping
// ============================================================
describe("getConditionScore", () => {
  it("maps 'Nowy z metką' to 9", () => {
    expect(getConditionScore("Nowy z metką").score).toBe(9);
  });
  it("maps 'Bardzo dobry' to 7", () => {
    expect(getConditionScore("Bardzo dobry").score).toBe(7);
  });
  it("maps 'Dobry' to 5", () => {
    expect(getConditionScore("Dobry").score).toBe(5);
  });
  it("maps 'Zadowalający' to 3", () => {
    expect(getConditionScore("Zadowalający").score).toBe(3);
  });
  it("maps 'good' (English) to 5", () => {
    expect(getConditionScore("good").score).toBe(5);
  });
  it("maps 'new_with_tags' to 9", () => {
    expect(getConditionScore("new_with_tags").score).toBe(9);
  });
  it("returns 4 for unknown condition", () => {
    expect(getConditionScore("???").score).toBe(4);
  });
  it("returns 4 for empty", () => {
    expect(getConditionScore("").score).toBe(4);
  });
});

// ============================================================
// Size popularity
// ============================================================
describe("getSizeBonus", () => {
  it("returns 1.0 for shoe size 43", () => {
    expect(getSizeBonus("43")).toBe(1.0);
  });
  it("returns 1.0 for shoe size '42 EU'", () => {
    expect(getSizeBonus("42 EU")).toBe(1.0);
  });
  it("returns 0.5 for shoe size 40", () => {
    expect(getSizeBonus("40")).toBe(0.5);
  });
  it("returns 0 for shoe size 36", () => {
    expect(getSizeBonus("36")).toBe(0);
  });
  it("returns 1.0 for clothing L", () => {
    expect(getSizeBonus("L")).toBe(1.0);
  });
  it("returns 0.5 for clothing S", () => {
    expect(getSizeBonus("S")).toBe(0.5);
  });
  it("returns 0 for XXS", () => {
    expect(getSizeBonus("XXS")).toBe(0);
  });
  it("returns 0 for undefined", () => {
    expect(getSizeBonus(undefined)).toBe(0);
  });
});

// ============================================================
// Seller trust
// ============================================================
describe("getSellerBonus", () => {
  it("returns 0.5 for rating >= 4.5 and >= 20 transactions", () => {
    expect(getSellerBonus(4.8, 50)).toBe(0.5);
  });
  it("returns 0.3 for rating >= 4.0 and >= 10 transactions", () => {
    expect(getSellerBonus(4.2, 15)).toBe(0.3);
  });
  it("returns 0 for low rating", () => {
    expect(getSellerBonus(3.5, 50)).toBe(0);
  });
  it("returns 0 for few transactions", () => {
    expect(getSellerBonus(4.8, 5)).toBe(0);
  });
});

// ============================================================
// Profit calculation
// ============================================================
describe("calculateProfit", () => {
  it("computes profit = median - price - shipping - fee", () => {
    // median 200, price 100, shipping 15, fee 10 (5% of 200) = 75
    expect(calculateProfit(100, 200)).toBe(75);
  });
  it("returns 0 when median is 0", () => {
    expect(calculateProfit(100, 0)).toBe(0);
  });
  it("returns negative for overpriced item", () => {
    expect(calculateProfit(180, 200)).toBeLessThan(0);
  });
});

// ============================================================
// Full rule-based scoring
// ============================================================
const defaultCfg: RuleScoreConfig = {
  lowSamplePenalty: 0.9,
  notifyThreshold: 6.0,
  hotThreshold: 9.0,
  hotMinProfit: 50,
  minProfitToNotify: 35,
};

describe("computeRuleScore", () => {
  it("scores a premium brand good-condition item highly", () => {
    const item = mockItem({ brand: "Nike", condition: "Bardzo dobry", size: "43", sellerRating: 4.8, sellerTransactions: 30 });
    const signal = mockSignal({ priceDiscountScore: 7, discountPct: 70, medianPrice: 300, p25Price: 250, sampleSize: 40 });
    const result = computeRuleScore(item, signal, defaultCfg);
    // 0.6*7 + 0.15*8 + 0.15*7 + 0.3*1.0 (size) + 0.5*0.5 (seller) = 4.2 + 1.2 + 1.05 + 0.3 + 0.25 = 7.0
    expect(result.score).toBeGreaterThanOrEqual(6.5);
    expect(result.syntheticAi).toBeDefined();
    expect(result.syntheticAi.reasoning).toContain("Nike");
  });

  it("scores a budget brand low", () => {
    const item = mockItem({ brand: "NoName", condition: "Dobry", size: "36" });
    const signal = mockSignal({ priceDiscountScore: 5, medianPrice: 100, p25Price: 75, sampleSize: 30 });
    const result = computeRuleScore(item, signal, defaultCfg);
    // 0.6*5 + 0.15*2 + 0.15*5 + 0 + 0 = 3.0 + 0.3 + 0.75 = 4.05
    expect(result.score).toBeLessThan(5);
    expect(result.level).toBe("ignore");
  });

  it("applies low sample penalty", () => {
    const item = mockItem({ brand: "Nike" });
    const signal = mockSignal({ priceDiscountScore: 6, sampleSize: 5, medianPrice: 200, p25Price: 150 });
    const noPenalty = computeRuleScore(item, { ...signal, sampleSize: 20 }, defaultCfg);
    const withPenalty = computeRuleScore(item, signal, defaultCfg);
    expect(withPenalty.score).toBeLessThan(noPenalty.score);
  });

  it("adds shipping bonus", () => {
    const item = mockItem({ description: "Wysyłka InPost paczkomat" });
    const signal = mockSignal({ priceDiscountScore: 6, medianPrice: 200, p25Price: 150 });
    const result = computeRuleScore(item, signal, defaultCfg);
    expect(result.reasons.some(r => r.includes("Wysyłka"))).toBe(true);
  });

  it("applies pickup penalty", () => {
    const item = mockItem({ description: "Tylko odbiór osobisty Kraków" });
    const signal = mockSignal({ priceDiscountScore: 6, medianPrice: 200, p25Price: 150 });
    const result = computeRuleScore(item, signal, defaultCfg);
    expect(result.reasons.some(r => r.includes("odbiór osobisty"))).toBe(true);
  });

  it("returns 'hot' for high score + high profit", () => {
    const item = mockItem({ brand: "Nike", condition: "Nowy z metką", size: "43", sellerRating: 4.9, sellerTransactions: 50 });
    const signal = mockSignal({ priceDiscountScore: 10, discountPct: 80, medianPrice: 500, p25Price: 400, sampleSize: 50 });
    const result = computeRuleScore(item, signal, defaultCfg);
    expect(result.level).toBe("hot");
    expect(result.syntheticAi.estimatedProfit).toBeGreaterThanOrEqual(50);
  });

  it("returns 'notify' for moderate score + enough profit", () => {
    const item = mockItem({ brand: "Nike", condition: "Bardzo dobry", size: "42", sellerRating: 4.5, sellerTransactions: 20 });
    const signal = mockSignal({ priceDiscountScore: 8, discountPct: 60, medianPrice: 250, p25Price: 200, sampleSize: 30 });
    const result = computeRuleScore(item, signal, defaultCfg);
    expect(result.level).toBe("notify");
  });

  it("returns 'ignore' when profit too small", () => {
    const item = mockItem({ brand: "Nike", price: 80 });
    const signal = mockSignal({ priceDiscountScore: 7, medianPrice: 100, p25Price: 80, sampleSize: 30 });
    const result = computeRuleScore(item, signal, defaultCfg);
    // profit = 80 - 80 - 15 - 4 = -19 → too small
    expect(result.level).toBe("ignore");
  });

  it("clamps score to 0-10 range", () => {
    const item = mockItem({ brand: "Nike", condition: "Nowy z metką", size: "43", sellerRating: 5.0, sellerTransactions: 100 });
    const signal = mockSignal({ priceDiscountScore: 10, medianPrice: 1000, p25Price: 800, sampleSize: 100 });
    const result = computeRuleScore(item, signal, defaultCfg);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("syntheticAi has valid structure", () => {
    const item = mockItem();
    const signal = mockSignal({ medianPrice: 200, p25Price: 150 });
    const result = computeRuleScore(item, signal, defaultCfg);
    const ai = result.syntheticAi;
    expect(ai.resalePotential).toBeGreaterThanOrEqual(0);
    expect(ai.conditionConfidence).toBeGreaterThanOrEqual(0);
    expect(ai.brandLiquidity).toBeGreaterThanOrEqual(0);
    expect(typeof ai.estimatedProfit).toBe("number");
    expect(typeof ai.suggestedPrice).toBe("number");
    expect(Array.isArray(ai.riskFlags)).toBe(true);
    expect(typeof ai.reasoning).toBe("string");
  });
});

// ============================================================
// Photo verification detection
// ============================================================
describe("needsPhotoVerification", () => {
  it("returns true for short title (1 word) with high score", () => {
    expect(needsPhotoVerification("Nike", 7.5)).toBe(true);
  });

  it("returns true for 2-word title with high score", () => {
    expect(needsPhotoVerification("Jordan buty", 8.0)).toBe(true);
  });

  it("returns false for 3-word title (clear enough)", () => {
    expect(needsPhotoVerification("Adidas nowe skor", 7.0)).toBe(false);
  });

  it("returns false for 4+ word title (clear enough)", () => {
    expect(needsPhotoVerification("Nike Air Max 90", 8.0)).toBe(false);
  });

  it("returns false for long descriptive title", () => {
    expect(needsPhotoVerification("The North Face kurtka puchowa M", 9.0)).toBe(false);
  });

  it("returns false when score below 6", () => {
    expect(needsPhotoVerification("Nike", 5.9)).toBe(false);
  });

  it("returns true when score is exactly 6", () => {
    expect(needsPhotoVerification("Nike", 6.0)).toBe(true);
  });

  it("returns false when score is 0", () => {
    expect(needsPhotoVerification("Nike", 0)).toBe(false);
  });

  it("handles empty title", () => {
    expect(needsPhotoVerification("", 8.0)).toBe(true);
  });

  it("handles whitespace-padded title", () => {
    expect(needsPhotoVerification("  Nike  ", 7.5)).toBe(true);
  });
});

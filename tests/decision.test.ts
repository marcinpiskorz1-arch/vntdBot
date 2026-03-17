import { describe, it, expect } from "vitest";
import {
  computeRuleScore,
  type RuleScoreConfig,
} from "../src/agents/decision/rule-scoring.js";
import { formatNotification } from "../src/agents/telegram/formatters.js";
import { mockItem, mockSignal, mockAi } from "./helpers.js";

const cfg: RuleScoreConfig = {
  lowSamplePenalty: 0.9,
  notifyThreshold: 6.0,
  hotThreshold: 9.0,
  hotMinProfit: 50,
  minProfitToNotify: 35,
};

// ============================================================
// Tests that were previously for computeScore (AI-weighted)
// are now validating the only scoring path: computeRuleScore
// ============================================================

describe("computeRuleScore — decision levels", () => {
  it("returns 'hot' for high-value premium brand with big profit", () => {
    const item = mockItem({
      brand: "Nike",
      condition: "Nowy z metką",
      size: "43",
      sellerRating: 4.9,
      sellerTransactions: 50,
    });
    const signal = mockSignal({
      priceDiscountScore: 10,
      discountPct: 80,
      p25Price: 400,
      sampleSize: 50,
    });
    const result = computeRuleScore(item, signal, cfg);
    expect(result.level).toBe("hot");
    expect(result.reasons[0]).toContain("HOT DEAL");
  });

  it("returns 'ignore' when profit is too small despite high score", () => {
    const item = mockItem({ brand: "Nike", price: 80 });
    const signal = mockSignal({
      priceDiscountScore: 7,
      p25Price: 80,
      sampleSize: 30,
    });
    const result = computeRuleScore(item, signal, cfg);
    expect(result.level).toBe("ignore");
  });

  it("returns 'ignore' when score is low", () => {
    const item = mockItem({ brand: "NoName", condition: "Dobry", size: "36" });
    const signal = mockSignal({
      priceDiscountScore: 3,
      p25Price: 75,
      sampleSize: 30,
    });
    const result = computeRuleScore(item, signal, cfg);
    expect(result.level).toBe("ignore");
  });
});

describe("computeRuleScore — synthetic AI compatibility", () => {
  it("produces AiAnalysis with valid structure", () => {
    const result = computeRuleScore(mockItem(), mockSignal({ p25Price: 200 }), cfg);
    const ai = result.syntheticAi;
    expect(ai.resalePotential).toBeGreaterThanOrEqual(0);
    expect(ai.conditionConfidence).toBeGreaterThanOrEqual(0);
    expect(ai.brandLiquidity).toBeGreaterThanOrEqual(0);
    expect(typeof ai.estimatedProfit).toBe("number");
    expect(typeof ai.suggestedPrice).toBe("number");
    expect(Array.isArray(ai.riskFlags)).toBe(true);
    expect(typeof ai.reasoning).toBe("string");
  });

  it("suggestedPrice uses P25 (not median)", () => {
    const result = computeRuleScore(
      mockItem(),
      mockSignal({ p25Price: 200, medianPrice: 300 }),
      cfg,
    );
    // suggestedPrice should be ~180 (P25 * 0.90), not ~270 (median * 0.90)
    expect(result.syntheticAi.suggestedPrice).toBe(180);
  });

  it("profit is calculated from P25", () => {
    // P25=200, price=100, shipping=15, fee=10 → profit=75
    const result = computeRuleScore(
      mockItem({ price: 100 }),
      mockSignal({ p25Price: 200, medianPrice: 300 }),
      cfg,
    );
    expect(result.syntheticAi.estimatedProfit).toBe(75);
  });
});

// ============================================================
// formatNotification — labels
// ============================================================

describe("formatNotification — labels", () => {
  it("shows '📦 Okazja' for notify decisions", () => {
    const decision = {
      score: 6.5,
      level: "notify" as const,
      reasons: [],
      item: mockItem(),
      pricing: mockSignal(),
      ai: mockAi(),
    };
    const payload = formatNotification(decision);
    expect(payload.scoreLine).toContain("📦 Okazja");
  });

  it("shows '🔥 HOT DEAL' for hot decisions", () => {
    const decision = {
      score: 9.5,
      level: "hot" as const,
      reasons: [],
      item: mockItem(),
      pricing: mockSignal(),
      ai: mockAi(),
    };
    const payload = formatNotification(decision);
    expect(payload.scoreLine).toContain("🔥 HOT DEAL");
  });
});

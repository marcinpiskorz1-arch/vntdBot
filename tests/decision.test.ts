import { describe, it, expect } from "vitest";
import { computeScore, type ScoreConfig } from "../src/agents/decision/scoring.js";
import { mockItem, mockSignal, mockAi } from "./helpers.js";

/** Default config matching production defaults */
const cfg: ScoreConfig = {
  weights: { priceDiscount: 0.4, resalePotential: 0.3, conditionConfidence: 0.2, brandLiquidity: 0.1 },
  lowSamplePenalty: 0.9,
  notifyThreshold: 6.0,
  hotThreshold: 9.0,
  hotMinProfit: 50,
  minProfitToNotify: 35,
};

describe("computeScore — base scoring", () => {
  it("computes weighted score from 4 components", () => {
    const result = computeScore(
      mockItem(),
      mockSignal({ priceDiscountScore: 8 }),
      mockAi({ resalePotential: 7, conditionConfidence: 6, brandLiquidity: 5 }),
      cfg,
    );
    // 0.4*8 + 0.3*7 + 0.2*6 + 0.1*5 = 3.2 + 2.1 + 1.2 + 0.5 = 7.0
    expect(result.score).toBe(7.0);
  });

  it("clamps score to 0-10", () => {
    const result = computeScore(
      mockItem(),
      mockSignal({ priceDiscountScore: 10 }),
      mockAi({ resalePotential: 10, conditionConfidence: 10, brandLiquidity: 10 }),
      cfg,
    );
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("computeScore — penalties", () => {
  it("applies low sample penalty when sampleSize < 10", () => {
    const normal = computeScore(
      mockItem(),
      mockSignal({ sampleSize: 30, priceDiscountScore: 5 }),
      mockAi(),
      cfg,
    );
    const lowSample = computeScore(
      mockItem(),
      mockSignal({ sampleSize: 5, priceDiscountScore: 5 }),
      mockAi(),
      cfg,
    );
    expect(lowSample.score).toBeLessThan(normal.score);
    expect(lowSample.reasons.some(r => r.includes("Mała baza"))).toBe(true);
  });

  it("applies risk flag penalty (-0.3 per flag)", () => {
    const clean = computeScore(mockItem(), mockSignal(), mockAi({ riskFlags: [] }), cfg);
    const risky = computeScore(
      mockItem(),
      mockSignal(),
      mockAi({ riskFlags: ["fake_branding", "suspicious_price"] }),
      cfg,
    );
    expect(risky.score).toBeLessThan(clean.score);
  });

  it("ignores missing_details in risk penalty", () => {
    const withMissing = computeScore(
      mockItem(),
      mockSignal(),
      mockAi({ riskFlags: ["missing_details"] }),
      cfg,
    );
    const clean = computeScore(mockItem(), mockSignal(), mockAi({ riskFlags: [] }), cfg);
    // missing_details should NOT cause penalty
    expect(withMissing.score).toBe(clean.score);
  });

  it("applies inflated_median penalty (score * 0.6)", () => {
    const normal = computeScore(mockItem(), mockSignal(), mockAi({ riskFlags: [] }), cfg);
    const inflated = computeScore(
      mockItem(),
      mockSignal(),
      mockAi({ riskFlags: ["inflated_median"] }),
      cfg,
    );
    // inflated score should be ~60% of normal
    expect(inflated.score).toBeLessThan(normal.score * 0.7);
  });
});

describe("computeScore — shipping", () => {
  it("gives shipping bonus (+0.3)", () => {
    const withShipping = computeScore(
      mockItem({ description: "Wysyłka InPost paczkomat" }),
      mockSignal(),
      mockAi(),
      cfg,
    );
    const plain = computeScore(mockItem(), mockSignal(), mockAi(), cfg);
    expect(withShipping.score).toBeGreaterThan(plain.score);
  });

  it("applies pickup penalty (-0.5)", () => {
    const signal = mockSignal({ priceDiscountScore: 8 });
    const ai = mockAi({ resalePotential: 8, conditionConfidence: 8, brandLiquidity: 8 });
    const pickupOnly = computeScore(
      mockItem({ description: "Tylko odbiór osobisty" }),
      signal,
      ai,
      cfg,
    );
    const plain = computeScore(mockItem(), signal, ai, cfg);
    expect(pickupOnly.score).toBeLessThan(plain.score);
  });
});

describe("computeScore — level determination", () => {
  it("returns 'hot' for high score + high profit", () => {
    const result = computeScore(
      mockItem(),
      mockSignal({ priceDiscountScore: 10 }),
      mockAi({ resalePotential: 10, conditionConfidence: 10, brandLiquidity: 10, estimatedProfit: 100 }),
      cfg,
    );
    expect(result.level).toBe("hot");
    expect(result.reasons[0]).toContain("HOT DEAL");
  });

  it("returns 'notify' for decent score + decent profit", () => {
    const result = computeScore(
      mockItem(),
      mockSignal({ priceDiscountScore: 8 }),
      mockAi({ resalePotential: 7, conditionConfidence: 6, brandLiquidity: 5, estimatedProfit: 50 }),
      cfg,
    );
    // score = 0.4*8 + 0.3*7 + 0.2*6 + 0.1*5 = 7.0 >= 6.0, profit 50 >= 35
    expect(result.level).toBe("notify");
  });

  it("returns 'ignore' for low score", () => {
    const result = computeScore(
      mockItem(),
      mockSignal({ priceDiscountScore: 2 }),
      mockAi({ resalePotential: 3, conditionConfidence: 2, brandLiquidity: 1, estimatedProfit: 10 }),
      cfg,
    );
    expect(result.level).toBe("ignore");
  });

  it("returns 'ignore' when score is good but profit too low", () => {
    const result = computeScore(
      mockItem(),
      mockSignal({ priceDiscountScore: 8 }),
      mockAi({ resalePotential: 7, conditionConfidence: 6, brandLiquidity: 5, estimatedProfit: 20 }),
      cfg,
    );
    // score 7.0 >= 6.0, but profit 20 < 35
    expect(result.level).toBe("ignore");
    expect(result.reasons.some(r => r.includes("Zysk za mały"))).toBe(true);
  });
});

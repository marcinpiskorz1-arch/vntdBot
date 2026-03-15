import { config } from "../../config.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import { logger } from "../../logger.js";
import type { RawItem, PriceSignal, AiAnalysis, Decision } from "../../types.js";
import { computeScore } from "./scoring.js";

export class DecisionAgent {
  /**
   * The ONLY place in the system that makes a buy/notify/ignore decision.
   * Combines algorithmic price signal (40%) + Gemini scores (60%).
   */
  decide(item: RawItem, pricing: PriceSignal, ai: AiAnalysis): Decision {
    const result = computeScore(item, pricing, ai, {
      weights: config.weights,
      lowSamplePenalty: config.lowSamplePenalty,
      notifyThreshold: settings.notifyThreshold,
      hotThreshold: settings.hotThreshold,
      hotMinProfit: settings.hotMinProfit,
      minProfitToNotify: 35,
    });

    const decision: Decision = {
      score: result.score,
      level: result.level,
      reasons: result.reasons,
      item,
      pricing,
      ai,
    };

    // Save to DB
    this.persist(decision);

    logger.info(
      {
        item: item.vintedId,
        score: result.score,
        level: result.level,
        reasons: result.reasons.slice(0, 3),
      },
      "Decision made"
    );

    return decision;
  }

  /** Persist decision to database */
  private persist(decision: Decision): void {
    try {
      // Get internal DB id for the item
      const row = stmts.getItemByVintedId.get({
        vinted_id: decision.item.vintedId,
      }) as { id: number } | undefined;

      if (!row) return;

      stmts.insertDecision.run({
        item_id: row.id,
        vinted_id: decision.item.vintedId,
        score: decision.score,
        level: decision.level,
        ai_reasoning: decision.ai.reasoning,
        risk_flags: JSON.stringify(decision.ai.riskFlags),
        notified: decision.level !== "ignore" ? 1 : 0,
      });
    } catch (err) {
      logger.error({ err, item: decision.item.vintedId }, "Failed to persist decision");
    }
  }
}

// ============================================================
// Standalone test: npx tsx src/agents/decision/index.ts
// ============================================================
if (process.argv[1]?.includes("decision")) {
  const agent = new DecisionAgent();

  const mockItem: RawItem = {
    vintedId: "test-decision-1",
    title: "Nike Air Max 90 OG Infrared",
    brand: "Nike",
    price: 45,
    currency: "PLN",
    category: "shoes",
    condition: "Dobry",
    description: "Świetny stan, mało noszone",
    photoUrls: [],
    sellerRating: 4.8,
    sellerTransactions: 25,
    listedAt: "2026-03-13",
    url: "https://www.vinted.pl/items/test-decision-1",
  };

  const mockSignal: PriceSignal = {
    discountPct: 63,
    isUnderpriced: true,
    confidence: 0.7,
    sampleSize: 35,
    medianPrice: 120,
    p25Price: 85,
    priceDiscountScore: 6.3,
  };

  const mockAi: AiAnalysis = {
    resalePotential: 8,
    conditionConfidence: 7,
    brandLiquidity: 9,
    estimatedProfit: 60,
    suggestedPrice: 120,
    riskFlags: [],
    reasoning: "Nike Air Max 90 Infrared to klasyk. Cena bardzo atrakcyjna. Powinien zejść szybko za ~120 PLN.",
  };

  const decision = agent.decide(mockItem, mockSignal, mockAi);
  console.log("\n✅ Decision:");
  console.log(JSON.stringify({ score: decision.score, level: decision.level, reasons: decision.reasons }, null, 2));
}

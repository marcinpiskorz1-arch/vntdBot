import { config } from "../../config.js";
import { stmts } from "../../database.js";
import { logger } from "../../logger.js";
import type { RawItem, PriceSignal, AiAnalysis, Decision } from "../../types.js";

const { weights, notifyThreshold, hotThreshold, hotMinProfit, lowSamplePenalty } = config;

export class DecisionAgent {
  /**
   * The ONLY place in the system that makes a buy/notify/ignore decision.
   * Combines algorithmic price signal (40%) + Gemini scores (60%).
   */
  decide(item: RawItem, pricing: PriceSignal, ai: AiAnalysis): Decision {
    // 4-component weighted score
    let score =
      weights.priceDiscount * pricing.priceDiscountScore +
      weights.resalePotential * ai.resalePotential +
      weights.conditionConfidence * ai.conditionConfidence +
      weights.brandLiquidity * ai.brandLiquidity;

    const reasons: string[] = [];

    // Low sample penalty
    if (pricing.sampleSize < 10) {
      score *= lowSamplePenalty;
      reasons.push(
        `⚠️ Mała baza danych (${pricing.sampleSize} próbek) — score × ${lowSamplePenalty}`
      );
    }

    // Risk flag penalty: -0.3 per flag (excluding missing_details — normal on Vinted)
    const penaltyFlags = ai.riskFlags.filter(f => f !== "missing_details");
    if (penaltyFlags.length > 0) {
      const penalty = penaltyFlags.length * 0.3;
      score = Math.max(0, score - penalty);
      reasons.push(`🚩 ${penaltyFlags.length} flag ryzyka: ${penaltyFlags.join(", ")}`);
    }

    // Build explainability reasons
    if (pricing.discountPct > 0) {
      reasons.push(
        `💰 ${pricing.discountPct.toFixed(0)}% poniżej ${pricing.sampleSize < 10 ? "P25" : "mediany"} (${pricing.medianPrice} PLN)`
      );
    }

    if (ai.resalePotential >= 7) {
      reasons.push(`📈 Wysoki potencjał odsprzedaży (${ai.resalePotential}/10)`);
    }
    if (ai.conditionConfidence >= 7) {
      reasons.push(`✅ Dobry stan potwierdzon (${ai.conditionConfidence}/10)`);
    }
    if (ai.brandLiquidity >= 7) {
      reasons.push(`🏷️ Marka sprzedaje się szybko (${ai.brandLiquidity}/10)`);
    }
    if (ai.estimatedProfit > 0) {
      reasons.push(`💵 Szacowany zysk: ~${ai.estimatedProfit} PLN`);
    }

    // Minimum profit gate — not worth the effort below 35 PLN
    const MIN_PROFIT_TO_NOTIFY = 35;

    // Determine level
    let level: Decision["level"] = "ignore";
    if (score >= hotThreshold && ai.estimatedProfit >= hotMinProfit) {
      level = "hot";
      reasons.unshift("🔥 HOT DEAL — wysoki score + duży zysk");
    } else if (score >= notifyThreshold && ai.estimatedProfit >= MIN_PROFIT_TO_NOTIFY) {
      level = "notify";
    } else if (score >= notifyThreshold && ai.estimatedProfit < MIN_PROFIT_TO_NOTIFY) {
      reasons.push(`⛔ Zysk za mały (${ai.estimatedProfit} PLN < ${MIN_PROFIT_TO_NOTIFY} PLN)`);
    }

    // Clamp final score
    score = Math.round(Math.max(0, Math.min(10, score)) * 10) / 10;

    const decision: Decision = {
      score,
      level,
      reasons,
      item,
      pricing,
      ai,
    };

    // Save to DB
    this.persist(decision);

    logger.info(
      {
        item: item.vintedId,
        score,
        level,
        reasons: reasons.slice(0, 3),
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

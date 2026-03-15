import { config } from "../../config.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import { logger } from "../../logger.js";
import type { RawItem, PriceSignal, AiAnalysis, Decision } from "../../types.js";
import { computeScore } from "./scoring.js";
import { computeRuleScore } from "./rule-scoring.js";

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
      minProfitToNotify: settings.minProfitToNotify,
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

  /**
   * Rule-based decision — no AI, uses brand/condition/size/seller heuristics.
   * Produces a synthetic AiAnalysis for Telegram compatibility.
   */
  decideWithRules(item: RawItem, pricing: PriceSignal): Decision {
    const result = computeRuleScore(item, pricing, {
      lowSamplePenalty: config.lowSamplePenalty,
      notifyThreshold: settings.notifyThreshold,
      hotThreshold: settings.hotThreshold,
      hotMinProfit: settings.hotMinProfit,
      minProfitToNotify: settings.minProfitToNotify,
    });

    const decision: Decision = {
      score: result.score,
      level: result.level,
      reasons: result.reasons,
      item,
      pricing,
      ai: result.syntheticAi,
    };

    this.persist(decision);

    logger.info(
      {
        item: item.vintedId,
        score: result.score,
        level: result.level,
        reasons: result.reasons.slice(0, 3),
      },
      "Decision made (rule-based)"
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

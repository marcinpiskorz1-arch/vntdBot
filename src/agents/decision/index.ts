import { config } from "../../config.js";
import { settings } from "../../settings.js";
import { stmts } from "../../database.js";
import { logger } from "../../logger.js";
import type { RawItem, PriceSignal, Decision } from "../../types.js";
import { computeRuleScore, type RuleScoreConfig } from "./rule-scoring.js";

export class DecisionAgent {
  /**
   * Rule-based decision — no AI, uses brand/condition/size/seller heuristics.
   * Produces a synthetic AiAnalysis for Telegram compatibility.
   */
  decideWithRules(item: RawItem, pricing: PriceSignal, configOverrides?: Partial<RuleScoreConfig>): Decision {
    const result = computeRuleScore(item, pricing, {
      lowSamplePenalty: config.lowSamplePenalty,
      notifyThreshold: settings.notifyThreshold,
      hotThreshold: settings.hotThreshold,
      hotMinProfit: settings.hotMinProfit,
      minProfitToNotify: settings.minProfitToNotify,
      ...configOverrides,
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

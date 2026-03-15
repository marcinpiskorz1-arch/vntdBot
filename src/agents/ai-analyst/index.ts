import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import { botState } from "../../bot-state.js";
import type { RawItem, PriceSignal, AiAnalysis } from "../../types.js";
import { getStructuredModel } from "./gemini-client.js";
import { aiAnalysisSchema, systemPrompt, buildItemPrompt } from "./prompts.js";

/** Reset daily counter if date changed (midnight rollover) */
function checkDailyReset(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (botState.daily.date !== today) {
    logger.info({ previousCalls: botState.daily.aiCalls, date: botState.daily.date }, "🔄 Daily AI counter reset (new day)");
    botState.daily.aiCalls = 0;
    botState.daily.date = today;
  }
}

/** Check if daily AI call limit has been reached */
function isDailyLimitReached(): boolean {
  checkDailyReset();
  return botState.daily.aiCalls >= settings.dailyAiLimit;
}

export class AiAnalystAgent {
  private _model: ReturnType<typeof getStructuredModel> | null = null;

  private get model() {
    if (!this._model) {
      this._model = getStructuredModel(aiAnalysisSchema);
    }
    return this._model;
  }

  /**
   * Analyze a single item. Only called when isUnderpriced === true.
   * Returns structured AiAnalysis from Gemini.
   */
  async analyze(item: RawItem, signal: PriceSignal): Promise<AiAnalysis> {
    // Check daily limit BEFORE making the API call
    if (isDailyLimitReached()) {
      logger.warn({ dailyCalls: botState.daily.aiCalls, limit: settings.dailyAiLimit }, "🛑 Daily AI limit reached — skipping analysis");
      return {
        resalePotential: 3,
        conditionConfidence: 3,
        brandLiquidity: 3,
        estimatedProfit: 0,
        suggestedPrice: item.price,
        riskFlags: ["daily_limit_reached"],
        reasoning: "Dzienny limit wywołań AI został osiągnięty. Ocena konserwatywna.",
      };
    }

    const userPrompt = buildItemPrompt(
      item.title,
      item.description,
      item.brand,
      item.price,
      item.condition,
      item.size || "",
      signal.medianPrice,
      signal.sampleSize
    );

    // Build content parts — text only (no photos to save Gemini tokens/cost)
    const parts: Array<{ text: string }> = [
      { text: userPrompt },
    ];

    try {
      const result = await this.model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Rozumiem. Jestem gotowy do analizy ofert z Vinted." }] },
          { role: "user", parts },
        ],
      });

      const text = result.response.text();
      const parsed = JSON.parse(text) as AiAnalysis;

      // Track daily API call
      botState.daily.aiCalls++;

      // Clamp scores to 0-10 range
      parsed.resalePotential = clamp(parsed.resalePotential, 0, 10);
      parsed.conditionConfidence = clamp(parsed.conditionConfidence, 0, 10);
      parsed.brandLiquidity = clamp(parsed.brandLiquidity, 0, 10);

      logger.info(
        {
          item: item.vintedId,
          resale: parsed.resalePotential,
          condition: parsed.conditionConfidence,
          liquidity: parsed.brandLiquidity,
          profit: parsed.estimatedProfit,
          flags: parsed.riskFlags,
        },
        "AI analysis complete"
      );

      return parsed;
    } catch (err) {
      logger.error({ err, item: item.vintedId }, "Gemini analysis failed");

      // Return conservative fallback — don't crash the pipeline
      return {
        resalePotential: 3,
        conditionConfidence: 3,
        brandLiquidity: 3,
        estimatedProfit: 0,
        suggestedPrice: item.price,
        riskFlags: ["ai_analysis_failed"],
        reasoning: "Analiza AI nie powiodła się. Ocena konserwatywna.",
      };
    }
  }

  /**
   * Batch analyze multiple items (optimization: fewer API calls).
   * Falls back to individual calls if batch fails.
   */
  async analyzeAll(
    items: Array<[RawItem, PriceSignal]>
  ): Promise<Array<[RawItem, PriceSignal, AiAnalysis]>> {
    const results: Array<[RawItem, PriceSignal, AiAnalysis]> = [];

    for (const [item, signal] of items) {
      // Check if paused mid-batch — stop burning Gemini tokens immediately
      if (settings.paused) {
        logger.info({ processed: results.length, skipped: items.length - results.length }, "⏸️ AI analysis interrupted — bot paused");
        break;
      }
      // Check daily limit mid-batch
      if (isDailyLimitReached()) {
        logger.warn({ processed: results.length, skipped: items.length - results.length, dailyCalls: botState.daily.aiCalls }, "🛑 Daily AI limit reached mid-batch — stopping");
        break;
      }
      const analysis = await this.analyze(item, signal);
      results.push([item, signal, analysis]);
      // 0.5s delay between Gemini calls to avoid 429 rate limits
      if (items.length > 1) await new Promise(r => setTimeout(r, 500));
    }

    return results;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

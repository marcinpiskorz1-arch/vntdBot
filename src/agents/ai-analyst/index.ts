import { logger } from "../../logger.js";
import { settings } from "../../settings.js";
import type { RawItem, PriceSignal, AiAnalysis } from "../../types.js";
import { getStructuredModel } from "./gemini-client.js";
import { aiAnalysisSchema, systemPrompt, buildItemPrompt } from "./prompts.js";

export class AiAnalystAgent {
  private model = getStructuredModel(aiAnalysisSchema);

  /**
   * Analyze a single item. Only called when isUnderpriced === true.
   * Returns structured AiAnalysis from Gemini.
   */
  async analyze(item: RawItem, signal: PriceSignal): Promise<AiAnalysis> {
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

// ============================================================
// Standalone test: npx tsx src/agents/ai-analyst/index.ts
// ============================================================
if (process.argv[1]?.includes("ai-analyst")) {
  const agent = new AiAnalystAgent();

  const mockItem: RawItem = {
    vintedId: "test-ai-1",
    title: "Nike Air Max 90 OG Infrared",
    brand: "Nike",
    price: 120,
    currency: "PLN",
    size: "43",
    category: "shoes",
    condition: "Dobry",
    description:
      "Buty Nike Air Max 90 w kolorze Infrared. Noszone kilka razy, dobry stan. Rozmiar 43. Pudełko w zestawie.",
    photoUrls: [],
    sellerRating: 4.8,
    sellerTransactions: 25,
    listedAt: "2026-03-13",
    url: "https://www.vinted.pl/items/test-ai-1",
  };

  const mockSignal: PriceSignal = {
    discountPct: 52,
    isUnderpriced: true,
    confidence: 0.6,
    sampleSize: 30,
    medianPrice: 250,
    p25Price: 180,
    priceDiscountScore: 5.2,
  };

  agent
    .analyze(mockItem, mockSignal)
    .then((analysis) => {
      console.log("\n✅ AI Analysis result:");
      console.log(JSON.stringify(analysis, null, 2));
    })
    .catch((err) => {
      console.error("❌ AI Analyst test failed:", err);
      process.exit(1);
    });
}
